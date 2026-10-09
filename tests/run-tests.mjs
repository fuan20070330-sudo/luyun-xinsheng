import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../shared/generator.js');
const { FrameParser, encodeFrame, OPCODES } = require('../server/src/ws-frame.js');
const { createServer } = require('../server/src/server.js');
const { PostgresStore } = require('../server/src/postgres-store.js');
const { responsesEndpoint, chatEndpoint, extractResponseText, buildPrompt } = require('../server/src/ai-adapter.js');

const materials = [
  '品牌档案（模拟）第1条：鲁香斋始创于1918年，品牌创立初期以山东传统糕点制作为业。',
  '传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。',
  '品牌资料登记信息显示，鲁香斋为山东老字号。',
  '目前产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。',
  '品牌强调保留传统口感，并在合规范围内优化产品含糖量。',
  '受访记录（模拟）第1条：品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。',
  '受访记录（模拟）第2条：品牌方希望节令礼盒成为家庭分享的入口，但不承诺保健功效。'
].join('\n');

function testEngine() {
  const facts = engine.extractFacts(materials, { sourceName: '鲁香斋模拟品牌档案' });
  assert.ok(facts.length >= 7, '应生成不少于 7 条事实');
  assert.ok(facts.filter((fact) => fact.status !== '待核实').length >= 7);
  assert.ok(facts.every((fact) => fact.evidenceLevel && Object.prototype.hasOwnProperty.call(fact, 'sourceHash') && fact.sourceAuthority && fact.verificationStatus && fact.extractionConfidence >= 0));
  assert.deepEqual([...new Set(facts.map((fact) => fact.category))].sort(), engine.CATEGORIES.slice().sort());
  const conflictMaterials = '品牌档案：品牌始创于1918年。\n品牌档案：品牌创立于1920年。';
  const conflictFacts = engine.extractFacts(conflictMaterials, { sourceName: '冲突测试' });
  assert.equal(engine.detectConflicts(conflictFacts).length, 1);
  const boundary = engine.detectRisks({
    materials,
    constraints: '把“宫廷御用”“国家级非遗”“降血糖”写成确定事实，行业第一。',
    theme: '宫廷御用点心，国家级非遗工艺，吃了可以降血糖',
    goal: '突出保健效果',
    facts
  });
  const highTerms = boundary.filter((risk) => risk.level === 'high').map((risk) => risk.term);
  assert.ok(highTerms.includes('宫廷御用'));
  assert.ok(highTerms.includes('国家级非遗'));
  assert.ok(highTerms.includes('降血糖'));
  const artifacts = engine.generateContent({
    brand: { name: '鲁香斋（模拟品牌）', type: '山东传统糕点老字号' },
    facts,
    risks: boundary,
    platform: 'xiaohongshu',
    contentType: 'package',
    audience: '25-35岁城市消费者',
    theme: '一块枣泥酥里的山东老味道',
    goal: '建立品牌记忆点',
    constraints: '只使用事实库内容',
    promotionMethods: ['品牌故事线', '文化知识科普'],
    modelInfo: { model: 'test-local', promptVersion: engine.PROMPT_VERSION },
    isDemo: true
  });
  assert.equal(artifacts.length, 4);
  assert.ok(artifacts.every((artifact) => artifact.content.length > 100));
  assert.deepEqual(artifacts.map((artifact) => artifact.id), ['story', 'calendar', 'copy', 'youth']);
  assert.ok(artifacts.every((artifact) => artifact.facts.length > 0));
  assert.ok(artifacts.every((artifact) => artifact.methods.length === 2));
  assert.ok(artifacts.every((artifact) => artifact.quality && artifact.quality.score >= 0 && artifact.variants && artifact.variants.titles.length >= 1));
  assert.equal(engine.runRoleReview({ facts, risks: boundary, theme: '测试主题', platformName: '小红书' }).length, 5);
  assert.match(artifacts[0].content, /F00\d/);
  return { facts: facts.length, verified: facts.filter((fact) => fact.status !== '待核实').length, highRisks: highTerms.length, artifacts: artifacts.length };
}

function testFrameCodec() {
  const payload = Buffer.from('中文 WebSocket 帧');
  const framed = encodeFrame(payload, { mask: true, maskKey: Buffer.from([1, 2, 3, 4]) });
  const frames = new FrameParser().push(framed);
  assert.equal(frames.length, 1);
  assert.equal(frames[0].payload.toString('utf8'), payload.toString('utf8'));
}

function connectWs(port) {
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1');
    const key = crypto.randomBytes(16).toString('base64');
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    const parser = new FrameParser();
    const queue = [];
    const waiters = [];
    function dispatch(message) {
      if (message.event === 'error') {
        if (!waiters.length) { queue.push(message); return; }
        const error = new Error(message.payload.message);
        waiters.splice(0).forEach((waiter) => waiter.reject(error));
        return;
      }
      const index = waiters.findIndex((waiter) => waiter.event === message.event);
      if (index >= 0) {
        const waiter = waiters.splice(index, 1)[0];
        waiter.resolve(message);
      } else {
        queue.push(message);
      }
    }
    function waitFor(event, timeoutMs = 5000) {
      const queuedError = queue.find((message) => message.event === 'error');
      if (queuedError) { queue.splice(queue.indexOf(queuedError), 1); return Promise.reject(new Error(queuedError.payload.message)); }
      const existing = queue.find((message) => message.event === event);
      if (existing) {
        queue.splice(queue.indexOf(existing), 1);
        return Promise.resolve(existing);
      }
      return new Promise((resolveWait, rejectWait) => {
        const waiter = { event, resolve: resolveWait, reject: rejectWait };
        waiters.push(waiter);
        setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) waiters.splice(index, 1);
          rejectWait(new Error('等待事件超时：' + event));
        }, timeoutMs).unref();
      });
    }
    function sendJson(value) {
      socket.write(encodeFrame(JSON.stringify(value), { mask: true }));
    }
    socket.on('connect', () => {
      socket.write([
        'GET /ws HTTP/1.1',
        'Host: 127.0.0.1:' + port,
        'Upgrade: websocket',
        'Connection: Upgrade',
        'Sec-WebSocket-Key: ' + key,
        'Sec-WebSocket-Version: 13',
        '\r\n'
      ].join('\r\n'));
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const marker = buffer.indexOf('\r\n\r\n');
        if (marker < 0) return;
        const header = buffer.slice(0, marker).toString('utf8');
        if (!/HTTP\/1\.1 101/.test(header)) { reject(new Error(header)); return; }
        buffer = buffer.slice(marker + 4);
        upgraded = true;
        resolve({ socket, sendJson, waitFor });
      }
      if (!buffer.length) return;
      const frames = parser.push(buffer);
      buffer = Buffer.alloc(0);
      frames.forEach((frame) => {
        if (frame.opcode === OPCODES.PING) { socket.write(encodeFrame(frame.payload, { mask: true, opcode: OPCODES.PONG })); return; }
        if (frame.opcode === OPCODES.TEXT) dispatch(JSON.parse(frame.payload.toString('utf8')));
      });
    });
    socket.on('error', reject);
    socket.setTimeout(8000, () => reject(new Error('WebSocket 连接超时')));
  });
}

async function testGateway() {
  const { server, gateway } = createServer({ ALLOWED_ORIGIN: '*', WS_HEARTBEAT_MS: '60000', DATA_FILE: ':memory:' });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  try {
    const health = await new Promise((resolve, reject) => {
      http.get('http://127.0.0.1:' + port + '/healthz', (response) => {
        let body = '';
        response.on('data', (chunk) => { body += chunk; });
        response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
      }).on('error', reject);
    });
    assert.equal(health.status, 200);
    assert.equal(health.body.ok, true);
    const client = await connectWs(port);
    const ready = await client.waitFor('connection.ready');
    assert.equal(ready.payload.protocol, 'luyun-gateway/2.0');
    client.sendJson({
      event: 'brand.ingest', requestId: 'brand-test',
      payload: { brand: { id: 'test-brand', name: '鲁香斋（模拟品牌）', type: '糕点', tone: '真诚', materials, isDemo: true }, sourceName: '自动化测试资料' }
    });
    const brandReady = await client.waitFor('brand.ready');
    assert.ok(brandReady.payload.facts.length >= 7);
    client.sendJson({
      event: 'content.generate', requestId: 'job-test',
      payload: {
        brand: brandReady.payload.brand, facts: brandReady.payload.facts, platform: 'matrix', platformName: '多平台矩阵',
        contentType: 'campaign', contentTypeName: '跨平台传播方案', audience: '年轻消费者', theme: '一块老味道',
        goal: '形成内容矩阵', constraints: '不得添加功效承诺', promotionMethods: ['品牌故事线', '节点内容日历'], isDemo: true
      }
    });
    const job = await client.waitFor('job.ready');
    assert.equal(job.payload.artifacts.length, 4);
    assert.ok(job.payload.artifacts.every((artifact) => artifact.methods.length === 2));
    assert.equal(job.payload.roleReviews.length, 5);
    assert.ok(job.payload.risks.length >= 0);
    client.sendJson({
      event: 'review.update', requestId: 'review-test',
      payload: { jobId: job.payload.jobId, artifactId: 'story', action: 'accept', reviewer: '自动化测试员', before: job.payload.artifacts[0].content, after: '', note: '测试审核' }
    });
    const review = await client.waitFor('review.saved');
    assert.equal(review.payload.reviewer, '自动化测试员');
    client.socket.end();
    gateway.close();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
  return { port, health: true, websocket: true, job: true, review: true };
}

async function apiJson(base, path, options, token) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, options && options.headers || {});
  if (token) headers.Authorization = 'Bearer ' + token;
  const response = await fetch(base + path, Object.assign({}, options || {}, { headers }));
  const payload = await response.json();
  const setCookie = response.headers.get('set-cookie') || '';
  return { status: response.status, payload, setCookie };
}

async function testApi() {
  const bundle = createServer({ ALLOWED_ORIGIN: '*', WS_HEARTBEAT_MS: '60000', DATA_FILE: ':memory:', AUTH_RETURN_TOKEN: 'true', AUTH_COOKIE_ENABLED: 'true', COOKIE_SAME_SITE: 'Lax' });
  await new Promise((resolve) => bundle.server.listen(0, '127.0.0.1', resolve));
  const port = bundle.server.address().port;
  const base = 'http://127.0.0.1:' + port;
  try {
    const health = await fetch(base + '/api/health').then((response) => response.json());
    assert.equal(health.ok, true);
    const registered = await apiJson(base, '/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'api-test@example.com', password: 'safe-pass-123', role: '内容编辑' }) });
    assert.equal(registered.status, 201);
    assert.ok(registered.payload.token);
    assert.match(registered.setCookie, /luyun_session=.*HttpOnly/i);
    const storedUser = bundle.store.findUserByEmail('api-test@example.com');
    assert.match(storedUser.passwordHash, /^scrypt\$/);
    assert.equal(storedUser.passwordHash.includes('safe-pass-123'), false);
    const token = registered.payload.token;
    const cookie = String(registered.setCookie || '').split(';')[0];
    const csrf = registered.payload.csrfToken;
    const csrfBlocked = await apiJson(base, '/api/history', { method: 'POST', headers: { Cookie: cookie }, body: JSON.stringify({ record: { id: 'cookie-blocked', artifacts: [] } }) });
    assert.equal(csrfBlocked.status, 403);
    const csrfAllowed = await apiJson(base, '/api/history', { method: 'POST', headers: { Cookie: cookie, 'X-CSRF-Token': csrf }, body: JSON.stringify({ record: { id: 'cookie-allowed', artifacts: [] } }) });
    assert.equal(csrfAllowed.status, 201);
    const me = await apiJson(base, '/api/auth/me', {}, token);
    assert.equal(me.status, 200);
    assert.equal(me.payload.user.email, 'api-test@example.com');
    const changed = await apiJson(base, '/api/auth/password', { method: 'POST', body: JSON.stringify({ oldPassword: 'safe-pass-123', newPassword: 'new-safe-pass-456' }) }, token);
    assert.equal(changed.status, 200);
    const oldLogin = await apiJson(base, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'api-test@example.com', password: 'safe-pass-123' }) });
    assert.equal(oldLogin.status, 401);
    const newLogin = await apiJson(base, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'api-test@example.com', password: 'new-safe-pass-456' }) });
    assert.equal(newLogin.status, 200);
    const saved = await apiJson(base, '/api/history', { method: 'POST', body: JSON.stringify({ record: { id: 'api-job-1', brand: { name: '测试品牌' }, artifacts: [{ id: 'story', content: '测试内容 [F001]' }] } }) }, token);
    assert.equal(saved.status, 201);
    const list = await apiJson(base, '/api/history', {}, token);
    assert.equal(list.payload.records.length, 2);
    const verified = await apiJson(base, '/api/verification/facts', { method: 'POST', body: JSON.stringify({ facts: [{ id: 'F001', statement: '品牌始创于1918年', sourceAuthority: '用户整理资料' }] }) }, token);
    assert.equal(verified.status, 200);
    assert.equal(verified.payload.configured, false);
    assert.equal(verified.payload.facts[0].verificationStatus, '待核验');
    const extracted = await apiJson(base, '/api/documents/extract', { method: 'POST', body: JSON.stringify({ name: '证据.txt', type: 'text/plain', base64: Buffer.from('品牌始创于1918年。').toString('base64') }) }, token);
    assert.equal(extracted.status, 200);
    assert.match(extracted.payload.document.text, /1918/);
    assert.match(extracted.payload.document.hash, /^[a-f0-9]{64}$/);
    const wrong = await apiJson(base, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'api-test@example.com', password: 'wrong-pass' }) });
    assert.equal(wrong.status, 401);
    await apiJson(base, '/api/auth/register', { method: 'POST', body: JSON.stringify({ email: 'lock-test@example.com', password: 'lock-pass-123' }) });
    for (let i = 0; i < 5; i += 1) await apiJson(base, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'lock-test@example.com', password: 'bad-pass' }) });
    const locked = await apiJson(base, '/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'lock-test@example.com', password: 'lock-pass-123' }) });
    assert.equal(locked.status, 423);
    const loggedOut = await apiJson(base, '/api/auth/logout', { method: 'POST' }, token);
    assert.equal(loggedOut.status, 200);
    const expired = await apiJson(base, '/api/auth/me', {}, token);
    assert.equal(expired.status, 401);
    return { health: true, register: true, login: true, changePassword: true, httpOnlyCookie: true, csrf: true, accountLockout: true, history: true, documentExtraction: true, verificationPending: true, invalidPassword: true, logout: true };
  } finally {
    bundle.gateway.close();
    await new Promise((resolve) => bundle.server.close(resolve));
  }
}

async function testPostgresStore() {
  let pgMem;
  try { pgMem = require('pg-mem'); }
  catch (error) { try { pgMem = require('../server/node_modules/pg-mem'); } catch (fallback) { return { skipped: true, reason: 'pg-mem not installed' }; } }
  const db = pgMem.newDb();
  const adapter = db.adapters.createPg();
  const store = new PostgresStore({ Pool: adapter.Pool });
  await store.ready;
  const user = await store.createUser({ email: 'postgres@example.com', passwordHash: 'scrypt$test$hash', role: '管理员' });
  assert.ok(user && user.id);
  const session = await store.createSession(user, 60000);
  const authenticated = await store.getSession(session.token);
  assert.equal(authenticated.user.email, 'postgres@example.com');
  assert.ok(session.csrfToken);
  const saved = await store.putRecord('jobs', user.id, { id: 'pg-job', brand: { name: 'PostgreSQL 测试品牌' } });
  assert.equal(saved.id, 'pg-job');
  const records = await store.listRecords('jobs', user.id, 10);
  assert.equal(records.length, 1);
  const stats = await store.stats();
  assert.equal(stats.users, 1);
  assert.equal(stats.jobs, 1);
  await store.close();
  return { users: stats.users, jobs: stats.jobs, session: true, csrf: true };
}

function testAdvancedAdapter() {
  assert.equal(responsesEndpoint('https://api.openai.com/v1'), 'https://api.openai.com/v1/responses');
  assert.equal(chatEndpoint('https://example.com/v1'), 'https://example.com/v1/chat/completions');
  assert.equal(extractResponseText({ output_text: '{"story":"ok"}' }), '{"story":"ok"}');
  assert.equal(extractResponseText({ output: [{ content: [{ type: 'output_text', text: 'nested' }] }] }), 'nested');
  const prompt = buildPrompt({ brand: { name: '测试品牌', type: '老字号', tone: '克制' }, facts: [{ id: 'F001', category: '历史', text: '成立于1918年', source: '档案', status: '已确认' }], promotionMethods: [], performanceFeedback: [] }, []);
  assert.match(prompt.system, /自然、具体、克制/);
  assert.match(prompt.system, /不能补写年份/);
  assert.match(prompt.user, /F001/);
}
testAdvancedAdapter();
testFrameCodec();
const engineResult = testEngine();
const postgresResult = await testPostgresStore().catch((error) => { console.error('postgres test failed:', error.stack || error.message); process.exit(1); });
const apiResult = await testApi().catch((error) => { console.error('api test failed:', error.stack || error.message); process.exit(1); });
const gatewayResult = await testGateway().catch((error) => { console.error('gateway test failed:', error.stack || error.message); process.exit(1); });
console.log(JSON.stringify({ ok: true, engine: engineResult, postgres: postgresResult, api: apiResult, gateway: gatewayResult }, null, 2));
process.exit(0);















