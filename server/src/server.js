'use strict';

const http = require('http');
const { LuyunGateway } = require('./gateway');
const { createStore } = require('./store');
const { createAuthService } = require('./auth-service');
const { createApi } = require('./api');
const { applySecurityHeaders } = require('./http-security');

function createServer(env = process.env) {
  const store = createStore(env);
  const auth = createAuthService(store);
  const api = createApi({ store, auth, env });
  let gateway;

  const server = http.createServer((request, response) => {
    const origin = request.headers.origin || '';
    const allowed = String(env.ALLOWED_ORIGIN || '*');
    const allowedOrigins = allowed === '*' ? ['*'] : allowed.split(',').map((item) => item.trim()).filter(Boolean);
    const originAllowed = allowedOrigins.includes('*') || allowedOrigins.includes(origin);
    const allowOrigin = allowedOrigins.includes('*') ? (origin || '*') : (originAllowed ? origin : '');
    if (allowOrigin) response.setHeader('Access-Control-Allow-Origin', allowOrigin);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Credentials', 'true');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With, X-CSRF-Token');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('Cache-Control', 'no-store');
    applySecurityHeaders(response);
    if (request.method === 'OPTIONS') {
      if (!originAllowed) { response.writeHead(403); response.end(); return; }
      response.writeHead(204); response.end(); return;
    }
    Promise.resolve(store.ready).then(() => api.handle(request, response)).then(async (handled) => {
      if (handled) return;
      if (request.url === '/healthz' && request.method === 'GET') {
        const stats = await store.stats();
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: true, service: 'luyun-xinsheng-gateway', protocol: 'luyun-gateway/2.0', storage: store.file, stats, time: new Date().toISOString() }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        service: '老字号叙事工坊网关',
        protocol: 'luyun-gateway/2.0',
        storage: store.file,
        websocket: '/ws', health: '/healthz', api: '/api',
        auth: ['/api/auth/register', '/api/auth/login', '/api/auth/logout', '/api/auth/me', '/api/auth/password'],
        data: ['/api/history', '/api/brands', '/api/reviews', '/api/publish', '/api/documents'],
        aiAdapter: gateway && gateway.adapter.enabled ? 'remote' : 'local-fallback'
      }));
    }).catch((error) => {
      response.writeHead(error.status || 500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: { code: error.code || 'INTERNAL_ERROR', message: error.message } }));
    });
  });

  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;
  gateway = new LuyunGateway({ server, env, store, auth });
  return { server, gateway, store, auth, api };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const { server, gateway, store } = createServer(process.env);
  Promise.resolve(store.ready).then(() => server.listen(port, '0.0.0.0', () => {
    const address = server.address();
    console.log('[luyun-gateway] listening on http://0.0.0.0:' + address.port + ' (/ws, /api)');
    console.log('[luyun-gateway] AI adapter: ' + (gateway.adapter.enabled ? 'remote' : 'local deterministic fallback'));
    console.log('[luyun-gateway] data store: ' + store.file);
  })).catch((error) => { console.error('[luyun-gateway] failed to initialize', error); process.exit(1); });
  const shutdown = () => {
    gateway.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createServer };