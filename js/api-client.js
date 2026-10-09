(function (root) {
  'use strict';

  var DEFAULT_TOKEN_KEY = 'luyun-auth-token-v1';
  var DEFAULT_CSRF_KEY = 'luyun-csrf-token-v1';

  function ApiError(message, code, status) {
    this.name = 'ApiError';
    this.message = message || '接口请求失败';
    this.code = code || 'API_ERROR';
    this.status = status || 0;
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function ApiClient(options) {
    options = options || {};
    this.baseUrl = String(options.baseUrl || '').replace(/\/+$/, '');
    this.tokenKey = options.tokenKey || DEFAULT_TOKEN_KEY;
    this.csrfKey = options.csrfKey || DEFAULT_CSRF_KEY;
    this.timeoutMs = options.timeoutMs || 12000;
    this.token = '';
    this.csrfToken = '';
    try {
      this.token = window.localStorage.getItem(this.tokenKey) || '';
      this.csrfToken = window.localStorage.getItem(this.csrfKey) || '';
    } catch (error) {}
  }

  ApiClient.prototype.enabled = function () { return !!this.baseUrl; };
  ApiClient.prototype.setToken = function (token) {
    this.token = token || '';
    try { this.token ? window.localStorage.setItem(this.tokenKey, this.token) : window.localStorage.removeItem(this.tokenKey); } catch (error) {}
    return this;
  };
  ApiClient.prototype.setCsrfToken = function (token) {
    this.csrfToken = token || '';
    try { this.csrfToken ? window.localStorage.setItem(this.csrfKey, this.csrfToken) : window.localStorage.removeItem(this.csrfKey); } catch (error) {}
    return this;
  };
  ApiClient.prototype.setSession = function (payload) {
    if (payload && payload.token) this.setToken(payload.token);
    if (payload && payload.csrfToken) this.setCsrfToken(payload.csrfToken);
    return this;
  };
  ApiClient.prototype.clearSession = function () { this.setToken(''); this.setCsrfToken(''); return this; };
  ApiClient.prototype.clearToken = function () { return this.clearSession(); };

  ApiClient.prototype.request = function (path, options) {
    options = options || {};
    var self = this;
    if (!this.enabled()) return Promise.reject(new ApiError('未配置服务端 API 地址。', 'API_OFFLINE', 0));
    var controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var timer = window.setTimeout(function () { if (controller) controller.abort(); }, this.timeoutMs);
    var method = options.method || 'GET';
    var headers = Object.assign({ 'Content-Type': 'application/json' }, options.headers || {});
    if (this.token) headers.Authorization = 'Bearer ' + this.token;
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && this.csrfToken) headers['X-CSRF-Token'] = this.csrfToken;
    return window.fetch(this.baseUrl + path, {
      method: method,
      headers: headers,
      body: options.body == null ? undefined : JSON.stringify(options.body),
      signal: controller ? controller.signal : undefined,
      credentials: 'include'
    }).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (payload) {
        if (!response.ok || payload.ok === false) {
          var detail = payload.error || {};
          if (response.status === 401) self.clearSession();
          throw new ApiError(detail.message || ('HTTP ' + response.status), detail.code || 'HTTP_ERROR', response.status);
        }
        if (payload.csrfToken) self.setCsrfToken(payload.csrfToken);
        return payload;
      });
    }).catch(function (error) {
      if (error instanceof ApiError) throw error;
      if (error && error.name === 'AbortError') throw new ApiError('服务端请求超时。', 'API_TIMEOUT', 0);
      throw new ApiError('服务端暂不可用。', 'API_OFFLINE', 0);
    }).finally(function () { window.clearTimeout(timer); });
  };

  ApiClient.prototype.register = function (email, password, role) {
    return this.request('/api/auth/register', { method: 'POST', body: { email: email, password: password, role: role } }).then(function (payload) { this.setSession(payload); return payload; }.bind(this));
  };
  ApiClient.prototype.login = function (email, password) {
    return this.request('/api/auth/login', { method: 'POST', body: { email: email, password: password } }).then(function (payload) { this.setSession(payload); return payload; }.bind(this));
  };
  ApiClient.prototype.me = function () { return this.request('/api/auth/me').then(function (payload) { this.setSession(payload); return payload; }.bind(this)); };
  ApiClient.prototype.changePassword = function (oldPassword, newPassword) { return this.request('/api/auth/password', { method: 'POST', body: { oldPassword: oldPassword, newPassword: newPassword } }); };
  ApiClient.prototype.logout = function () {
    var self = this;
    return this.request('/api/auth/logout', { method: 'POST' }).catch(function () { return { ok: true }; }).finally(function () { self.clearSession(); });
  };
  ApiClient.prototype.listHistory = function () { return this.request('/api/history').then(function (payload) { return payload.records || []; }); };
  ApiClient.prototype.saveHistory = function (record) { return this.request('/api/history', { method: 'POST', body: { record: record } }).then(function (payload) { return payload.record; }); };
  ApiClient.prototype.deleteHistory = function (id) { return this.request('/api/history/' + encodeURIComponent(id), { method: 'DELETE' }); };
  ApiClient.prototype.listBrands = function () { return this.request('/api/brands').then(function (payload) { return payload.records || []; }); };
  ApiClient.prototype.listReviews = function () { return this.request('/api/reviews').then(function (payload) { return payload.records || []; }); };
  ApiClient.prototype.listPublish = function () { return this.request('/api/publish').then(function (payload) { return payload.records || []; }); };
  ApiClient.prototype.listDocuments = function () { return this.request('/api/documents').then(function (payload) { return payload.records || []; }); };
  ApiClient.prototype.saveBrand = function (record) { return this.request('/api/brands', { method: 'POST', body: { record: record } }).then(function (payload) { return payload.record; }); };
  ApiClient.prototype.saveReview = function (record) { return this.request('/api/reviews', { method: 'POST', body: { record: record } }).then(function (payload) { return payload.record; }); };
  ApiClient.prototype.savePublish = function (record) { return this.request('/api/publish', { method: 'POST', body: { record: record } }).then(function (payload) { return payload.record; }); };
  ApiClient.prototype.saveDocument = function (record) { return this.request('/api/documents', { method: 'POST', body: { record: record } }).then(function (payload) { return payload.record; }); };
  ApiClient.prototype.verifyFacts = function (facts, brandName) { return this.request('/api/verification/facts', { method: 'POST', body: { facts: facts || [], brandName: brandName || '' } }).then(function (payload) { return payload; }); };
  ApiClient.prototype.extractDocument = function (file) {
    return file.arrayBuffer().then(function (buffer) {
      var bytes = new Uint8Array(buffer);
      var binary = '';
      for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
      return { name: file.name, type: file.type || 'application/octet-stream', base64: window.btoa(binary) };
    }).then(function (body) { return this.request('/api/documents/extract', { method: 'POST', body: body }); }.bind(this)).then(function (payload) { return payload.document; });
  };

  root.LuyunApi = { create: function (options) { return new ApiClient(options); }, ApiClient: ApiClient, ApiError: ApiError, DEFAULT_TOKEN_KEY: DEFAULT_TOKEN_KEY, DEFAULT_CSRF_KEY: DEFAULT_CSRF_KEY };
}(window));