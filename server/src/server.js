'use strict';

const http = require('http');
const path = require('path');
const { LuyunGateway } = require('./gateway');
const { JsonStore } = require('./data-store');
const { createAuthService } = require('./auth-service');
const { createApi } = require('./api');

function createServer(env = process.env) {
  const dataFile = env.DATA_FILE || path.join(process.cwd(), 'data', 'luyun-store.json');
  const store = env.STORE || new JsonStore({ file: dataFile });
  const auth = createAuthService(store);
  const api = createApi({ store, auth, env });
  let gateway;

  const server = http.createServer((request, response) => {
    const origin = request.headers.origin || '';
    const allowed = String(env.ALLOWED_ORIGIN || '*');
    const allowOrigin = allowed === '*' ? '*' : allowed.split(',').map((item) => item.trim()).includes(origin) ? origin : '';
    response.setHeader('Access-Control-Allow-Origin', allowOrigin || 'null');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
    response.setHeader('Access-Control-Max-Age', '86400');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    api.handle(request, response).then((handled) => {
      if (handled) return;
      if (request.url === '/healthz' && request.method === 'GET') {
        response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        response.end(JSON.stringify({ ok: true, service: 'luyun-xinsheng-gateway', protocol: 'luyun-gateway/2.0', stats: store.stats(), time: new Date().toISOString() }));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({
        ok: true,
        service: '老字号叙事工坊网关',
        protocol: 'luyun-gateway/2.0',
        websocket: '/ws',
        health: '/healthz',
        api: '/api',
        auth: ['/api/auth/register', '/api/auth/login', '/api/auth/logout', '/api/auth/me'],
        data: ['/api/history', '/api/brands', '/api/reviews', '/api/publish', '/api/documents'],
        aiAdapter: gateway && gateway.adapter.enabled ? 'remote' : 'local-fallback'
      }));
    }).catch((error) => {
      response.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: false, error: { code: 'INTERNAL_ERROR', message: error.message } }));
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
  server.listen(port, '0.0.0.0', () => {
    const address = server.address();
    console.log('[luyun-gateway] listening on http://0.0.0.0:' + address.port + ' (/ws, /api)');
    console.log('[luyun-gateway] AI adapter: ' + (gateway.adapter.enabled ? 'remote' : 'local deterministic fallback'));
    console.log('[luyun-gateway] data store: ' + store.file);
  });
  const shutdown = () => {
    gateway.close();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 3000).unref();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

module.exports = { createServer };