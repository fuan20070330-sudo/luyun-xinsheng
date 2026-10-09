'use strict';

const { extractDocument } = require('./document-service');
const { verifyFacts } = require('./verification-service');
const { createRateLimiter } = require('./rate-limit');
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

      if (path === '/api/verification/facts' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const verified = await verifyFacts(body.facts || [], env);
        sendJson(response, 200, { ok: true, configured: verified.configured, facts: verified.facts });
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