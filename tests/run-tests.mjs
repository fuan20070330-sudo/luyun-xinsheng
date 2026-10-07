import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const engine = require('../shared/generator.js');
const { FrameParser, encodeFrame, OPCODES } = require('../server/src/ws-frame.js');
const { createServer } = require('../server/src/server.js');
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
  assert.deepEqual([...new Set(facts.map((fact) => fact.category))].sort(), engine.CATEGORIES.slice().sort());
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
  const { server, gateway } = createServer({ ALLOWED_ORIGIN: '*', WS_HEARTBEAT_MS: '60000' });
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
    assert.equal(ready.payload.protocol, 'luyun-gateway/1.0');
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
const gatewayResult = await testGateway().catch((error) => { console.error('gateway test failed:', error.stack || error.message); process.exit(1); });
console.log(JSON.stringify({ ok: true, engine: engineResult, gateway: gatewayResult }, null, 2));
process.exit(0);















