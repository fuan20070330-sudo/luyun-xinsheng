'use strict';

const { extractDocument } = require('./document-service');
const { verifyFacts } = require('./verification-service');
const { signPassport, verifyPassport } = require('./passport-service');
const { createRateLimiter } = require('./rate-limit');
const EvidenceGate = require('../../shared/evidence-gate');
const {
  setSessionCookies,
  clearSessionCookies,
  tokenFromRequest,
  csrfValid,
  applySecurityHeaders
} = require('./http-security');

const COLLECTIONS = {
  history: 'jobs',
  jobs: 'jobs',
  brands: 'brands',
  reviews: 'reviews',
  publish: 'publishRecords',
  documents: 'documents'
};

function sendJson(response, status, value) {
  if (response.headersSent) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(value));
}

function errorPayload(error) {
  return { ok: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message || '服务端处理失败。' } };
}

function readJsonBody(request, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > (maxBytes || 8 * 1024 * 1024)) {
        reject(Object.assign(new Error('请求内容过大。'), { code: 'PAYLOAD_TOO_LARGE', status: 413 }));
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!chunks.length) { resolve({}); return; }
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); }
      catch (error) { reject(Object.assign(new Error('请求内容不是合法 JSON。'), { code: 'INVALID_JSON', status: 400 })); }
    });
    request.on('error', reject);
  });
}

function wantsToken(env) { return String(env.AUTH_RETURN_TOKEN || '').toLowerCase() === 'true'; }
function cookieEnabled(env) { return String(env.AUTH_COOKIE_ENABLED || 'true').toLowerCase() !== 'false'; }

function createApi(options) {
  const store = options.store;
  const auth = options.auth;
  const env = options.env || {};
  const registerLimiter = createRateLimiter({ windowMs: 60 * 60 * 1000, max: Number(env.REGISTER_RATE_LIMIT || 10) });
  const loginLimiter = createRateLimiter({ windowMs: 15 * 60 * 1000, max: Number(env.LOGIN_RATE_LIMIT || 20) });

  function workspaceRole(workspace, user) {
    if (!workspace || !user) return '';
    if (workspace.ownerId === user.id || workspace.ownerEmail === user.email) return 'owner';
    const member = (workspace.members || []).find((item) => String(item.email || '').toLowerCase() === String(user.email || '').toLowerCase());
    return member ? member.role : '';
  }

  async function accessibleWorkspaces(user) {
    const workspaces = await store.listAllRecords('workspaces', 1000);
    return workspaces.map((workspace) => Object.assign({}, workspace, { myRole: workspaceRole(workspace, user) })).filter((workspace) => workspace.myRole);
  }

  async function sessionResponse(response, request, result) {
    if (cookieEnabled(env)) setSessionCookies(response, request, env, result.token, result.csrfToken);
    const payload = { ok: true, user: result.user, csrfToken: result.csrfToken, authMode: cookieEnabled(env) ? 'cookie' : 'bearer' };
    if (wantsToken(env)) payload.token = result.token;
    return payload;
  }

  async function handle(request, response) {
    const url = new URL(request.url, 'http://gateway.local');
    const path = url.pathname;
    if (!path.startsWith('/api/')) return false;
    applySecurityHeaders(response);
    try {
      if (path === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, service: 'luyun-api', protocol: 'luyun-api/2.0', stats: await store.stats(), time: new Date().toISOString() });
        return true;
      }

      if (path === '/api/auth/register' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const limited = registerLimiter.check(request, body.email);
        if (!limited.allowed) { response.setHeader('Retry-After', Math.ceil(limited.retryAfterMs / 1000)); throw Object.assign(new Error('注册请求过于频繁，请稍后再试。'), { code: 'RATE_LIMITED', status: 429 }); }
        registerLimiter.consume(request, body.email);
        body.userAgent = request.headers['user-agent'] || '';
        const result = await auth.register(body);
        sendJson(response, 201, await sessionResponse(response, request, result));
        return true;
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const limited = loginLimiter.check(request, body.email);
        if (!limited.allowed) { response.setHeader('Retry-After', Math.ceil(limited.retryAfterMs / 1000)); throw Object.assign(new Error('登录请求过于频繁，请稍后再试。'), { code: 'RATE_LIMITED', status: 429 }); }
        loginLimiter.consume(request, body.email);
        body.userAgent = request.headers['user-agent'] || '';
        const result = await auth.login(body);
        loginLimiter.reset(request, body.email);
        sendJson(response, 200, await sessionResponse(response, request, result));
        return true;
      }

      if (path === '/api/passport/verify' && request.method === 'GET') {
        const passportId = url.searchParams.get('id') || '';
        const record = passportId ? await store.getAnyRecord('passports', passportId) : null;
        if (!record || !record.passport) throw Object.assign(new Error('内容护照不存在。'), { code: 'NOT_FOUND', status: 404 });
        const verification = verifyPassport(record.passport, env);
        sendJson(response, 200, { ok: true, valid: verification.valid, verification: verification, passport: record.passport });
        return true;
      }
      const token = tokenFromRequest(request);
      const authenticated = await auth.authenticate(token);
      const bearerRequest = /^Bearer\s+/i.test(String(request.headers.authorization || ''));
      const unsafe = !['GET', 'HEAD', 'OPTIONS'].includes(request.method);
      if (authenticated && unsafe && !bearerRequest && !csrfValid(request, authenticated.session)) {
        throw Object.assign(new Error('CSRF 校验失败，请刷新页面后重试。'), { code: 'CSRF_FAILED', status: 403 });
      }

      if (path === '/api/auth/logout' && request.method === 'POST') {
        if (authenticated) await auth.logout(token);
        if (cookieEnabled(env)) clearSessionCookies(response, request, env);
        sendJson(response, 200, { ok: true });
        return true;
      }
      if (path === '/api/auth/password' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const user = await auth.changePassword(token, body.oldPassword, body.newPassword);
        sendJson(response, 200, { ok: true, user });
        return true;
      }
      if (path === '/api/auth/me' && request.method === 'GET') {
        if (!authenticated) throw Object.assign(new Error('登录已过期。'), { code: 'UNAUTHORIZED', status: 401 });
        sendJson(response, 200, { ok: true, user: authenticated.user, csrfToken: authenticated.session.csrfToken, authMode: cookieEnabled(env) ? 'cookie' : 'bearer' });
        return true;
      }
      if (!authenticated) throw Object.assign(new Error('请先登录。'), { code: 'UNAUTHORIZED', status: 401 });
      const userId = authenticated.user.id;

      if (path === '/api/collaboration/workspaces' && request.method === 'GET') {
        const workspaces = await accessibleWorkspaces(authenticated.user);
        const ids = new Set(workspaces.map((workspace) => workspace.id));
        const comments = (await store.listAllRecords('collabComments', 1000)).filter((item) => ids.has(item.workspaceId));
        const approvals = (await store.listAllRecords('collabApprovals', 1000)).filter((item) => ids.has(item.workspaceId));
        sendJson(response, 200, { ok: true, workspaces, comments, approvals });
        return true;
      }
      if (path === '/api/collaboration/workspaces' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const input = body.workspace || body;
        const existing = input.id ? await store.getAnyRecord('workspaces', input.id) : null;
        if (existing && existing.ownerId !== userId) throw Object.assign(new Error('只有协作空间所有者可以修改成员。'), { code: 'FORBIDDEN', status: 403 });
        const members = (Array.isArray(input.members) ? input.members : []).map((item) => ({
          email: String(item.email || '').trim().toLowerCase(),
          role: ['editor', 'reviewer', 'brand_owner'].includes(item.role) ? item.role : 'editor'
        })).filter((item) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(item.email));
        const workspace = {
          id: String(input.id || ('ws-' + Date.now().toString(36))),
          name: String(input.name || '品牌协作空间').slice(0, 100),
          ownerId: userId,
          ownerEmail: authenticated.user.email,
          members,
          snapshot: input.snapshot || existing && existing.snapshot || null,
          status: input.status || existing && existing.status || 'draft',
          createdAt: existing && existing.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        sendJson(response, existing ? 200 : 201, { ok: true, workspace: await store.putRecord('workspaces', userId, workspace) });
        return true;
      }
      if (path === '/api/collaboration/comments' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const workspace = await store.getAnyRecord('workspaces', body.workspaceId || '');
        const role = workspaceRole(workspace, authenticated.user);
        if (!workspace || !role) throw Object.assign(new Error('无权访问该协作空间。'), { code: 'FORBIDDEN', status: 403 });
        if (!String(body.text || '').trim()) throw Object.assign(new Error('评论内容不能为空。'), { code: 'EMPTY_COMMENT', status: 400 });
        const comment = { id: 'comment-' + Date.now().toString(36), workspaceId: workspace.id, text: String(body.text).slice(0, 2000), target: String(body.target || '整体文稿').slice(0, 120), authorEmail: authenticated.user.email, authorRole: role, createdAt: new Date().toISOString() };
        sendJson(response, 201, { ok: true, comment: await store.putRecord('collabComments', userId, comment) });
        return true;
      }
      if (path === '/api/collaboration/approvals' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const workspace = await store.getAnyRecord('workspaces', body.workspaceId || '');
        const role = workspaceRole(workspace, authenticated.user);
        if (!workspace || !role) throw Object.assign(new Error('无权访问该协作空间。'), { code: 'FORBIDDEN', status: 403 });
        const action = ['submit', 'request_changes', 'approve'].includes(body.action) ? body.action : 'submit';
        if (action === 'approve' && ['owner', 'reviewer', 'brand_owner'].indexOf(role) === -1) throw Object.assign(new Error('当前角色没有最终批准权限。'), { code: 'FORBIDDEN', status: 403 });
        let gate = null;
        if (action === 'approve') {
          gate = EvidenceGate.build(Object.assign({}, workspace.snapshot || {}, { verificationConfigured: !!(env.OFFICIAL_VERIFICATION_URL || env.OFFICIAL_REGISTRY_URL) }));
          if (gate.status === 'blocked') throw Object.assign(new Error('证据门禁未通过，不能批准发布。'), { code: 'EVIDENCE_GATE_BLOCKED', status: 409, evidenceGate: gate });
        }
        const approval = { id: 'approval-' + Date.now().toString(36), workspaceId: workspace.id, action, note: String(body.note || '').slice(0, 1000), authorEmail: authenticated.user.email, authorRole: role, evidenceGate: gate, createdAt: new Date().toISOString() };
        await store.putRecord('collabApprovals', userId, approval);
        workspace.status = action === 'approve' ? 'approved' : action === 'request_changes' ? 'changes_requested' : 'in_review';
        workspace.updatedAt = new Date().toISOString();
        await store.putRecord('workspaces', workspace.ownerId, workspace);
        sendJson(response, 201, { ok: true, approval, workspace });
        return true;
      }
      if (path === '/api/account/export' && request.method === 'GET') {
        const collections = ['jobs', 'brands', 'reviews', 'publishRecords', 'documents', 'passports', 'revisionHistory', 'workspaces', 'collabComments', 'collabApprovals'];
        const data = {};
        for (const collection of collections) data[collection] = await store.listRecords(collection, userId, 1000);
        sendJson(response, 200, { ok: true, exportedAt: new Date().toISOString(), user: authenticated.user, data });
        return true;
      }
      if (path === '/api/account' && request.method === 'DELETE') {
        const body = await readJsonBody(request);
        if (body.confirmation !== 'DELETE') throw Object.assign(new Error('请输入 DELETE 确认删除账号。'), { code: 'CONFIRMATION_REQUIRED', status: 400 });
        await auth.logout(token);
        await store.deleteUserAccount(userId);
        if (cookieEnabled(env)) clearSessionCookies(response, request, env);
        sendJson(response, 200, { ok: true, deleted: true });
        return true;
      }

      if (path === '/api/passport/sign' && request.method === 'POST') {
        const body = await readJsonBody(request);
        if (!body.passport || !body.passport.id) throw Object.assign(new Error('缺少内容护照。'), { code: 'INVALID_PASSPORT', status: 400 });
        const signed = signPassport(body.passport, env);
        await store.putRecord('passports', userId, { id: signed.id, passport: signed });
        sendJson(response, 201, { ok: true, passport: signed });
        return true;
      }
      if (path === '/api/verification/facts' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const verified = await verifyFacts(body.facts || [], env, { brandName: body.brandName || '' });
        sendJson(response, 200, { ok: true, configured: verified.configured, officialRegistryConfigured: verified.officialRegistryConfigured, publicSources: verified.publicSources, facts: verified.facts });
        return true;
      }
      if (path === '/api/documents/extract' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const extracted = await extractDocument(body, env);
        sendJson(response, 200, { ok: true, document: extracted });
        return true;
      }
      if ((path === '/api/history' || path === '/api/jobs') && request.method === 'GET') {
        sendJson(response, 200, { ok: true, records: await store.listRecords(COLLECTIONS.history, userId, Number(url.searchParams.get('limit') || 100)) });
        return true;
      }
      if ((path === '/api/history' || path === '/api/jobs') && request.method === 'POST') {
        const body = await readJsonBody(request);
        const record = body.record || body;
        sendJson(response, 201, { ok: true, record: await store.putRecord(COLLECTIONS.history, userId, record) });
        return true;
      }
      if (path.startsWith('/api/history/') && request.method === 'GET') {
        const record = await store.getRecord(COLLECTIONS.history, userId, decodeURIComponent(path.slice('/api/history/'.length)));
        if (!record) throw Object.assign(new Error('历史记录不存在。'), { code: 'NOT_FOUND', status: 404 });
        sendJson(response, 200, { ok: true, record });
        return true;
      }
      if (path.startsWith('/api/history/') && request.method === 'DELETE') {
        const deleted = await store.deleteRecord(COLLECTIONS.history, userId, decodeURIComponent(path.slice('/api/history/'.length)));
        if (!deleted) throw Object.assign(new Error('历史记录不存在。'), { code: 'NOT_FOUND', status: 404 });
        sendJson(response, 200, { ok: true });
        return true;
      }

      const collectionMatch = path.match(/^\/api\/(brands|reviews|publish|documents)(?:\/([^/]+))?$/);
      if (collectionMatch) {
        const collection = COLLECTIONS[collectionMatch[1]];
        const id = collectionMatch[2] ? decodeURIComponent(collectionMatch[2]) : '';
        if (request.method === 'GET' && !id) {
          sendJson(response, 200, { ok: true, records: await store.listRecords(collection, userId, Number(url.searchParams.get('limit') || 100)) });
          return true;
        }
        if (request.method === 'GET' && id) {
          const record = await store.getRecord(collection, userId, id);
          if (!record) throw Object.assign(new Error('记录不存在。'), { code: 'NOT_FOUND', status: 404 });
          sendJson(response, 200, { ok: true, record });
          return true;
        }
        if (request.method === 'POST' && !id) {
          const body = await readJsonBody(request);
          sendJson(response, 201, { ok: true, record: await store.putRecord(collection, userId, body.record || body) });
          return true;
        }
        if (request.method === 'DELETE' && id) {
          const deleted = await store.deleteRecord(collection, userId, id);
          if (!deleted) throw Object.assign(new Error('记录不存在。'), { code: 'NOT_FOUND', status: 404 });
          sendJson(response, 200, { ok: true });
          return true;
        }
      }

      if (path === '/api/stats' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, stats: await store.stats() });
        return true;
      }
      throw Object.assign(new Error('接口不存在。'), { code: 'NOT_FOUND', status: 404 });
    } catch (error) {
      sendJson(response, error.status || 500, errorPayload(error));
      return true;
    }
  }

  return { handle };
}

module.exports = { createApi, readJsonBody };
