'use strict';

const http = require('http');
const { LuyunGateway } = require('./gateway');

function createServer(env = process.env) {
  const server = http.createServer((request, response) => {
    const origin = request.headers.origin || '';
    const allowed = String(env.ALLOWED_ORIGIN || '*');
    const allowOrigin = allowed === '*' ? '*' : allowed.split(',').map((item) => item.trim()).includes(origin) ? origin : '';
    response.setHeader('Access-Control-Allow-Origin', allowOrigin || 'null');
    response.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    response.setHeader('Cache-Control', 'no-store');
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return; }
    if (request.url === '/healthz') {
      response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      response.end(JSON.stringify({ ok: true, service: 'luyun-xinsheng-gateway', protocol: 'luyun-gateway/1.0', time: new Date().toISOString() }));
      return;
    }
    response.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({
      ok: true,
      service: '鲁韵新声 WebSocket 网关',
      protocol: 'luyun-gateway/1.0',
      websocket: '/ws',
      health: '/healthz',
      note: '前端静态站点由 GitHub Pages 托管。'
    }));
  });
  server.keepAliveTimeout = 65000;
  server.headersTimeout = 70000;
  const gateway = new LuyunGateway({ server, env });
  return { server, gateway };
}

if (require.main === module) {
  const port = Number(process.env.PORT || 8787);
  const { server, gateway } = createServer(process.env);
  server.listen(port, '0.0.0.0', () => {
    const address = server.address();
    console.log('[luyun-gateway] listening on http://0.0.0.0:' + address.port + ' (/ws)');
    console.log('[luyun-gateway] AI adapter: ' + (gateway.adapter.enabled ? 'remote' : 'local deterministic fallback'));
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
