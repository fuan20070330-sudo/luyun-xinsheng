/**
 * 老字号叙事工坊前端配置。
 * 部署到 GitHub Pages 后，只需把 gatewayUrl 改成独立 WebSocket 网关地址。
 * 示例：gatewayUrl: "wss://luyun-gateway.example.com/ws"
 * 前端不会、也不应保存任何模型 API Key。
 */
(function () {
  'use strict';

  var isLocal = ['localhost', '127.0.0.1', '::1'].indexOf(window.location.hostname) !== -1;
  var query = new URLSearchParams(window.location.search);
  var configuredGateway = query.get('gateway') || '';

  window.LUYUN_CONFIG = Object.freeze({
    gatewayUrl: configuredGateway || (isLocal ? 'ws://127.0.0.1:8787/ws' : ''),
    protocolVersion: 'luyun-gateway/1.0',
    connectTimeoutMs: isLocal ? 1800 : 4500,
    requestTimeoutMs: 12000,
    reconnect: {
      enabled: false,
      maxAttempts: 1,
      baseDelayMs: 1000
    },
    demoDelayScale: isLocal ? 0.55 : 1,
    appVersion: '1.0.0'
  });
}());

