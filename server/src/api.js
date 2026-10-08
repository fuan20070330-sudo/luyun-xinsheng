'use strict';

const { clone } = require('./data-store');
const { extractDocument } = require('./document-service');

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

function tokenFrom(request) {
  const header = String(request.headers.authorization || '');
  return /^Bearer\s+/i.test(header) ? header.replace(/^Bearer\s+/i, '').trim() : '';
}

function createApi(options) {
  const store = options.store;
  const auth = options.auth;
  const env = options.env || {};

  async function handle(request, response) {
    const url = new URL(request.url, 'http://gateway.local');
    const path = url.pathname;
    if (!path.startsWith('/api/')) return false;
    try {
      if (path === '/api/health' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, service: 'luyun-api', protocol: 'luyun-api/1.0', stats: store.stats(), time: new Date().toISOString() });
        return true;
      }

      if (path === '/api/auth/register' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const result = await auth.register(body);
        sendJson(response, 201, { ok: true, token: result.token, user: result.user });
        return true;
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const result = await auth.login(body);
        sendJson(response, 200, { ok: true, token: result.token, user: result.user });
        return true;
      }

      const token = tokenFrom(request);
      const authenticated = auth.authenticate(token);
      if (path === '/api/auth/logout' && request.method === 'POST') {
        auth.logout(token);
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
        sendJson(response, 200, { ok: true, user: authenticated.user });
        return true;
      }
      if (!authenticated) throw Object.assign(new Error('请先登录。'), { code: 'UNAUTHORIZED', status: 401 });
      const userId = authenticated.user.id;

      if (path === '/api/documents/extract' && request.method === 'POST') {
        const body = await readJsonBody(request);
        const extracted = await extractDocument(body, env);
        sendJson(response, 200, { ok: true, document: extracted });
        return true;
      }
      if ((path === '/api/history' || path === '/api/jobs') && request.method === 'GET') {
        sendJson(response, 200, { ok: true, records: store.listRecords(COLLECTIONS.history, userId, Number(url.searchParams.get('limit') || 100)) });
        return true;
      }
      if ((path === '/api/history' || path === '/api/jobs') && request.method === 'POST') {
        const body = await readJsonBody(request);
        const record = body.record || body;
        const saved = store.putRecord(COLLECTIONS.history, userId, record);
        sendJson(response, 201, { ok: true, record: saved });
        return true;
      }
      if (path.startsWith('/api/history/') && request.method === 'GET') {
        const record = store.getRecord(COLLECTIONS.history, userId, decodeURIComponent(path.slice('/api/history/'.length)));
        if (!record) throw Object.assign(new Error('历史记录不存在。'), { code: 'NOT_FOUND', status: 404 });
        sendJson(response, 200, { ok: true, record });
        return true;
      }
      if (path.startsWith('/api/history/') && request.method === 'DELETE') {
        const deleted = store.deleteRecord(COLLECTIONS.history, userId, decodeURIComponent(path.slice('/api/history/'.length)));
        if (!deleted) throw Object.assign(new Error('历史记录不存在。'), { code: 'NOT_FOUND', status: 404 });
        sendJson(response, 200, { ok: true });
        return true;
      }

      const collectionMatch = path.match(/^\/api\/(brands|reviews|publish|documents)(?:\/([^/]+))?$/);
      if (collectionMatch) {
        const collection = COLLECTIONS[collectionMatch[1]];
        const id = collectionMatch[2] ? decodeURIComponent(collectionMatch[2]) : '';
        if (request.method === 'GET' && !id) {
          sendJson(response, 200, { ok: true, records: store.listRecords(collection, userId, Number(url.searchParams.get('limit') || 100)) });
          return true;
        }
        if (request.method === 'GET' && id) {
          const record = store.getRecord(collection, userId, id);
          if (!record) throw Object.assign(new Error('记录不存在。'), { code: 'NOT_FOUND', status: 404 });
          sendJson(response, 200, { ok: true, record });
          return true;
        }
        if (request.method === 'POST' && !id) {
          const body = await readJsonBody(request);
          const record = body.record || body;
          const saved = store.putRecord(collection, userId, record);
          sendJson(response, 201, { ok: true, record: saved });
          return true;
        }
        if (request.method === 'DELETE' && id) {
          const deleted = store.deleteRecord(collection, userId, id);
          if (!deleted) throw Object.assign(new Error('记录不存在。'), { code: 'NOT_FOUND', status: 404 });
          sendJson(response, 200, { ok: true });
          return true;
        }
      }

      if (path === '/api/stats' && request.method === 'GET') {
        sendJson(response, 200, { ok: true, stats: store.stats() });
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

module.exports = { createApi, readJsonBody, tokenFrom };