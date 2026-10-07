(function (root) {
  'use strict';

  function createId(prefix) {
    return (prefix || 'req') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }

  function GatewayClient(options) {
    this.options = options || {};
    this.url = this.options.url || '';
    this.protocolVersion = this.options.protocolVersion || 'luyun-gateway/1.0';
    this.status = 'idle';
    this.socket = null;
    this.pending = new Map();
    this.listeners = { status: [], event: [] };
  }

  GatewayClient.prototype.on = function (type, listener) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(listener);
    return this;
  };

  GatewayClient.prototype.emit = function (type, payload) {
    (this.listeners[type] || []).forEach(function (listener) {
      try { listener(payload); } catch (error) { console.error('Gateway listener failed', error); }
    });
  };

  GatewayClient.prototype.setStatus = function (status, detail) {
    if (this.status === status && !detail) return;
    this.status = status;
    this.emit('status', { status: status, detail: detail || '' });
  };

  GatewayClient.prototype.connect = function () {
    var self = this;
    if (!this.url) {
      this.setStatus('local', '未配置网关地址');
      return Promise.resolve(false);
    }
    if (!('WebSocket' in window)) {
      this.setStatus('disconnected', '浏览器不支持 WebSocket');
      return Promise.resolve(false);
    }
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      return Promise.resolve(this.socket.readyState === WebSocket.OPEN);
    }
    this.setStatus('connecting', '正在连接 ' + this.url);
    return new Promise(function (resolve) {
      var settled = false;
      var socket;
      try { socket = new WebSocket(self.url); } catch (error) {
        self.setStatus('disconnected', error.message);
        resolve(false);
        return;
      }
      self.socket = socket;
      var timer = window.setTimeout(function () {
        if (settled) return;
        settled = true;
        try { socket.close(); } catch (ignore) {}
        self.setStatus('disconnected', '连接超时');
        resolve(false);
      }, self.options.connectTimeoutMs || 4500);

      socket.onopen = function () {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        self.setStatus('connected', '实时网关已连接');
        resolve(true);
      };
      socket.onmessage = function (messageEvent) {
        self.handleMessage(messageEvent.data);
      };
      socket.onerror = function () {
        if (!settled) {
          settled = true;
          window.clearTimeout(timer);
          self.setStatus('disconnected', '网关不可达');
          resolve(false);
        }
      };
      socket.onclose = function (event) {
        var detail = event && event.code ? '连接关闭（' + event.code + '）' : '连接已关闭';
        self.setStatus('disconnected', detail);
        self.rejectPending(new Error('WebSocket 连接已关闭'));
      };
    });
  };

  GatewayClient.prototype.handleMessage = function (raw) {
    var message;
    try { message = JSON.parse(raw); } catch (error) { return; }
    this.emit('event', message);
    if (!message.requestId || !this.pending.has(message.requestId)) return;
    var pending = this.pending.get(message.requestId);
    if (message.event === 'error') {
      window.clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      pending.reject(new Error((message.payload && message.payload.message) || '网关处理失败'));
      return;
    }
    if (pending.onEvent) pending.onEvent(message);
    if (message.event === pending.resolveEvent) {
      window.clearTimeout(pending.timer);
      this.pending.delete(message.requestId);
      pending.resolve(message.payload);
    }
  };

  GatewayClient.prototype.request = function (event, payload, resolveEvent, onEvent, timeoutMs) {
    var self = this;
    if (!this.isConnected()) return Promise.reject(new Error('GATEWAY_OFFLINE'));
    var requestId = createId(event.replace('.', '-'));
    return new Promise(function (resolve, reject) {
      var timer = window.setTimeout(function () {
        self.pending.delete(requestId);
        reject(new Error('网关响应超时'));
      }, timeoutMs || self.options.requestTimeoutMs || 12000);
      self.pending.set(requestId, { resolve: resolve, reject: reject, onEvent: onEvent, resolveEvent: resolveEvent, timer: timer });
      self.socket.send(JSON.stringify({
        event: event,
        requestId: requestId,
        protocol: self.protocolVersion,
        payload: payload || {}
      }));
    });
  };

  GatewayClient.prototype.send = function (event, payload) {
    if (!this.isConnected()) return false;
    this.socket.send(JSON.stringify({
      event: event,
      requestId: createId(event.replace('.', '-')),
      protocol: this.protocolVersion,
      payload: payload || {}
    }));
    return true;
  };

  GatewayClient.prototype.ping = function () {
    return this.send('ping', { at: new Date().toISOString() });
  };

  GatewayClient.prototype.isConnected = function () {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  };

  GatewayClient.prototype.rejectPending = function (error) {
    this.pending.forEach(function (pending) {
      window.clearTimeout(pending.timer);
      pending.reject(error);
    });
    this.pending.clear();
  };

  GatewayClient.prototype.close = function () {
    if (this.socket) {
      try { this.socket.close(1000, 'client shutdown'); } catch (ignore) {}
    }
    this.socket = null;
    this.rejectPending(new Error('客户端已关闭'));
    this.setStatus('disconnected', '连接已关闭');
  };

  root.LuyunGateway = {
    create: function (options) { return new GatewayClient(options); },
    GatewayClient: GatewayClient
  };
}(window));
