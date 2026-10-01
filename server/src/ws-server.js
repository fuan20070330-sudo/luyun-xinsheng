'use strict';

const { randomUUID } = require('crypto');
const { FrameParser, encodeFrame, OPCODES, handshakeAccept } = require('./ws-frame');

class WebSocketConnection {
  constructor(socket, options = {}) {
    this.id = randomUUID();
    this.socket = socket;
    this.parser = new FrameParser({ maxPayload: options.maxPayload || 2 * 1024 * 1024 });
    this.onMessage = options.onMessage || (() => {});
    this.onClose = options.onClose || (() => {});
    this.fragments = [];
    this.alive = true;
    this.closed = false;
    socket.on('data', (chunk) => this.handleData(chunk));
    socket.on('close', () => this.finish());
    socket.on('error', () => this.finish());
    socket.on('end', () => this.finish());
  }

  handleData(chunk) {
    let frames;
    try { frames = this.parser.push(chunk); } catch (error) { this.close(1009, error.message); return; }
    frames.forEach((frame) => this.handleFrame(frame));
  }

  handleFrame(frame) {
    if (frame.opcode === OPCODES.PING) { this.sendFrame(frame.payload, OPCODES.PONG); return; }
    if (frame.opcode === OPCODES.PONG) { this.alive = true; return; }
    if (frame.opcode === OPCODES.CLOSE) { this.close(1000, 'peer closed'); return; }
    if (frame.opcode === OPCODES.CONTINUATION || frame.opcode === OPCODES.TEXT || frame.opcode === OPCODES.BINARY) {
      if (frame.opcode !== OPCODES.CONTINUATION) this.fragments = [{ opcode: frame.opcode, payload: frame.payload }];
      else if (this.fragments.length) this.fragments.push({ opcode: OPCODES.CONTINUATION, payload: frame.payload });
      if (frame.fin) {
        const first = this.fragments[0];
        const combined = Buffer.concat(this.fragments.map((item) => item.payload));
        this.fragments = [];
        if (first && first.opcode === OPCODES.TEXT) this.onMessage(combined.toString('utf8'), this);
      }
    }
  }

  sendText(text) { return this.sendFrame(Buffer.from(String(text || ''), 'utf8'), OPCODES.TEXT); }
  sendJson(value) { return this.sendText(JSON.stringify(value)); }
  sendFrame(payload, opcode) {
    if (this.closed || this.socket.destroyed) return false;
    try { return this.socket.write(encodeFrame(payload, { opcode })); } catch (error) { this.finish(); return false; }
  }
  ping() { this.alive = false; this.sendFrame(Buffer.from('luyun-heartbeat'), OPCODES.PING); }
  close(code = 1000, reason = '') {
    if (this.closed) return;
    const reasonBuffer = Buffer.from(String(reason).slice(0, 120), 'utf8');
    const payload = Buffer.alloc(2 + reasonBuffer.length);
    payload.writeUInt16BE(code, 0);
    reasonBuffer.copy(payload, 2);
    this.sendFrame(payload, OPCODES.CLOSE);
    this.closed = true;
    this.socket.end();
  }
  finish() {
    if (this.finished) return;
    this.closed = true;
    this.finished = true;
    this.onClose(this);
  }
}

class WebSocketServer {
  constructor(options) {
    options = options || {};
    this.path = options.path || '/ws';
    this.server = options.server;
    this.allowedOrigins = options.allowedOrigins || ['*'];
    this.onConnection = options.onConnection || (() => {});
    this.onError = options.onError || (() => {});
    this.onMessage = options.onMessage || (() => {});
    this.maxPayload = options.maxPayload || 2 * 1024 * 1024;
    this.clients = new Set();
    this.heartbeat = null;
    this.server.on('upgrade', (request, socket, head) => this.handleUpgrade(request, socket, head));
  }

  originAllowed(origin) {
    if (this.allowedOrigins.includes('*')) return true;
    if (!origin) return true;
    return this.allowedOrigins.includes(origin);
  }

  handleUpgrade(request, socket, head) {
    const pathname = new URL(request.url, 'http://gateway.local').pathname;
    const key = request.headers['sec-websocket-key'];
    const upgrade = String(request.headers.upgrade || '').toLowerCase();
    if (pathname !== this.path || upgrade !== 'websocket' || !key) {
      socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    if (!this.originAllowed(request.headers.origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\nOrigin not allowed');
      socket.destroy();
      return;
    }
    const response = [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Accept: ' + handshakeAccept(key),
      '\r\n'
    ].join('\r\n');
    socket.write(response);
    if (head && head.length) socket.unshift(head);
    const connection = new WebSocketConnection(socket, {
      onMessage: (message) => this.handleMessage(connection, message),
      onClose: () => {
        this.clients.delete(connection);
        this.onConnection(connection, 'close');
      },
      maxPayload: this.maxPayload
    });
    connection.remoteAddress = socket.remoteAddress;
    this.clients.add(connection);
    this.onConnection(connection, 'open');
  }

  handleMessage(connection, raw) {
    let message;
    try { message = JSON.parse(raw); } catch (error) {
      this.onError(connection, new Error('消息必须是合法 JSON'));
      return;
    }
    try { this.onMessage(connection, message); } catch (error) { this.onError(connection, error); }
  }

  startHeartbeat(intervalMs = 30000) {
    if (this.heartbeat) return;
    this.heartbeat = setInterval(() => {
      this.clients.forEach((client) => {
        if (!client.alive) { client.close(1001, 'heartbeat timeout'); return; }
        client.ping();
      });
    }, intervalMs);
    this.heartbeat.unref();
  }

  close() {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.clients.forEach((client) => client.close(1001, 'server shutdown'));
    this.clients.clear();
  }
}

module.exports = { WebSocketServer, WebSocketConnection };




