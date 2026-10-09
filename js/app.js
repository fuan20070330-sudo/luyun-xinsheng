(function (window, document) {
  'use strict';

  var Engine = window.LuyunEngine;
  var Renderer = window.LuyunRenderer;
  var Data = window.LUYUN_DATA;
  var Config = window.LUYUN_CONFIG;
  var $ = function (id) { return document.getElementById(id); };
  var $$ = function (selector) { return Array.prototype.slice.call(document.querySelectorAll(selector)); };
  var delay = function (ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); };
  var scale = Config.demoDelayScale || 1;
  var Api = window.LuyunApi.create({
    baseUrl: Config.apiBaseUrl,
    timeoutMs: Config.apiTimeoutMs
  });
  var gateway = window.LuyunGateway.create({
    url: Config.gatewayUrl,
    protocolVersion: Config.protocolVersion,
    connectTimeoutMs: Config.connectTimeoutMs,
    requestTimeoutMs: Config.requestTimeoutMs
  });

  var state = {
    brand: null,
    facts: [],
    risks: [],
    artifacts: [],
    tasks: [],
    reviews: [],
    metrics: { facts: 0, jobs: 0, reviews: 0 },
    currentJobId: '',
    pendingOnly: false,
    transportMode: '本地处理模式',
    lastEvent: '--',
    user: '',
    currentStep: 1,
    unlockedStep: 1,
    initialized: false
  };

  var STORAGE_KEY_PREFIX = 'luyun-narrative-studio-v2:account:';
  var LEGACY_STORAGE_KEY = 'luyun-narrative-studio-v2';
  var LEGACY_MIGRATION_KEY = 'luyun-narrative-studio-v2:legacy-migrated';
  var HISTORY_LIMIT = 30;
  var AUTH_STORAGE_KEY = 'luyun-auth-accounts-v1';
  var PBKDF2_ITERATIONS = 150000;
  var currentAuthMode = 'login';
  var historyReturnFocus = null;

  function accountKey(account) {
    return STORAGE_KEY_PREFIX + encodeURIComponent(String(account || '').trim().toLowerCase());
  }

  function cloneData(value) {
    try { return JSON.parse(JSON.stringify(value)); } catch (error) { return value; }
  }

  function applySavedState(saved) {
    saved = saved || {};
    state.brandLibrary = saved.brandLibrary || {};
    state.tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
    state.reviews = Array.isArray(saved.reviews) ? saved.reviews : [];
    state.publishRecords = Array.isArray(saved.publishRecords) ? saved.publishRecords : [];
    state.history = Array.isArray(saved.history) ? saved.history : [];
    state.documents = Array.isArray(saved.documents) ? saved.documents : [];
    state.metrics = saved.metrics || { facts: 0, jobs: state.tasks.length, reviews: state.reviews.length };
  }

  function loadAccountState(account) {
    state.accountId = String(account || '').trim().toLowerCase();
    state.accountName = String(account || '').trim();
    var saved = {};
    try {
      var accountRaw = window.localStorage.getItem(accountKey(state.accountId));
      if (accountRaw) {
        saved = JSON.parse(accountRaw);
      } else {
        var legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
        if (legacyRaw && !window.localStorage.getItem(LEGACY_MIGRATION_KEY)) {
          saved = JSON.parse(legacyRaw);
          window.localStorage.setItem(LEGACY_MIGRATION_KEY, state.accountId);
        }
      }
    } catch (error) { saved = {}; }
    applySavedState(saved);
  }

  function persistState() {
    if (!state.accountId) return;
    try {
      window.localStorage.setItem(accountKey(state.accountId), JSON.stringify({
        accountName: state.accountName,
        brandLibrary: state.brandLibrary,
        tasks: state.tasks.slice(0, 50),
        reviews: state.reviews.slice(0, 100),
        publishRecords: state.publishRecords.slice(0, 100),
        history: state.history.slice(0, HISTORY_LIMIT),
        documents: state.documents.slice(0, 100),
        metrics: state.metrics
      }));
    } catch (error) {}
  }

  function clearAccountState() {
    state.accountId = '';
    state.accountName = '';
    state.brand = null;
    state.facts = [];
    state.risks = [];
    state.artifacts = [];
    state.roleReviews = [];
    state.brandLibrary = {};
    state.tasks = [];
    state.reviews = [];
    state.publishRecords = [];
    state.history = [];
    state.documents = [];
    state.conflicts = [];
    state.historyQuery = '';
    state.historyStatus = '';
    state.remoteReady = false;
    state.remoteAuth = false;
    state.metrics = { facts: 0, jobs: 0, reviews: 0 };
    state.currentJobId = '';
    state.pendingOnly = false;
  }

  function rememberCurrentBrand() {
    if (!state.brand) return;
    state.brandLibrary[state.brand.id] = { brand: state.brand, facts: state.facts, updatedAt: now() };
    persistState();
    if (Api.enabled() && state.remoteAuth) Api.saveBrand({ id: state.brand.id, brand: state.brand, facts: state.facts, updatedAt: now() }).catch(function () {});
  }

  function renderBrandOptions() {
    var select = $('brand-select');
    if (!select) return;
    var options = [];
    Object.keys(state.brandLibrary).forEach(function (id) {
      var item = state.brandLibrary[id];
      if (item && item.brand) options.push('<option value="' + id + '">' + item.brand.name + '</option>');
    });
    options.push('<option value="new">+ 新建品牌</option>');
    select.innerHTML = options.join('');
  }
  function uid(prefix) {
    return (prefix || 'job') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function now() { return new Date().toISOString(); }
  function selected(name) { return document.querySelector('input[name="' + name + '"]:checked'); }
  function platformName(value) { return Data.labelMaps.platform[value] || value; }
  function typeName(value) { return Data.labelMaps.contentType[value] || value; }
  function selectedPromotionMethods() {
    return $$('input[name="promotionMethod"]:checked').map(function (input) {
      var item = Data.promotionMethods[input.value] || {};
      return { id: input.value, title: item.title || input.value };
    });
  }

  function renderMethodGrid() {
    var grid = $('method-grid');
    if (!grid || !Data.promotionMethods) return;
    grid.innerHTML = Object.keys(Data.promotionMethods).map(function (id) {
      var method = Data.promotionMethods[id];
      return '<label class="method-card"><input type="checkbox" name="promotionMethod" value="' + id + '"' + (method.defaultSelected ? ' checked' : '') + '><strong>' + method.title + '</strong><small>' + method.summary + '<br><em>参考：' + method.source + '</em></small></label>';
    }).join('');
  }

  function showStep(step) {
    step = Number(step || 1);
    if (!state.user && step !== 1) step = 1;
    if (state.user && step > state.unlockedStep) { toast('请先完成当前步骤，再进入后一页。', 'warning'); step = state.currentStep || 1; }
    state.currentStep = step;
    $$('.app-step').forEach(function (page) { page.classList.toggle('is-active', Number(page.getAttribute('data-step')) === step); });
    $$('.step-nav [data-page]').forEach(function (button) {
      var page = Number(button.getAttribute('data-page'));
      button.classList.toggle('is-active', page === step);
      button.disabled = !state.user || page > state.unlockedStep;
    });
    var main = $('app-main');
    if (main) main.scrollTop = 0;
    window.scrollTo(0, 0);
  }

  function resetToEntry() {
    persistState();
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    if (window.location.hash) history.replaceState(null, '', window.location.pathname + window.location.search);
    closeHistory();
    state.user = '';
    clearAccountState();
    state.currentStep = 1;
    state.unlockedStep = 1;
    document.body.setAttribute('data-authenticated', 'false');
    $('login-screen').hidden = false;
    $('app-shell').hidden = true;
    showStep(1);
    window.scrollTo(0, 0);
  }
  function mergeById(localRecords, remoteRecords) {
    var merged = {};
    (localRecords || []).concat(remoteRecords || []).forEach(function (record) {
      if (!record) return;
      var id = record.id || record.jobId || record.brand && record.brand.id;
      if (id) merged[id] = record;
    });
    return Object.keys(merged).map(function (id) { return merged[id]; });
  }

  function syncRemoteState() {
    if (!Api.enabled() || !state.remoteAuth) return Promise.resolve(false);
    return Promise.all([Api.listHistory(), Api.listBrands(), Api.listReviews(), Api.listPublish(), Api.listDocuments()]).then(function (results) {
      state.history = mergeById(state.history, results[0] || []).sort(function (a, b) { return String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)); }).slice(0, HISTORY_LIMIT);
      (results[1] || []).forEach(function (record) {
        var brand = record.brand || record;
        if (brand && brand.id) state.brandLibrary[brand.id] = { brand: brand, facts: record.facts || [], updatedAt: record.updatedAt || now() };
      });
      state.reviews = mergeById(state.reviews, results[2] || []).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 100);
      state.publishRecords = mergeById(state.publishRecords, results[3] || []).sort(function (a, b) { return String(b.createdAt).localeCompare(String(a.createdAt)); }).slice(0, 100);
      state.documents = mergeById(state.documents, results[4] || []).slice(0, 100);
      state.metrics.jobs = Math.max(state.metrics.jobs || 0, state.history.length);
      state.metrics.reviews = Math.max(state.metrics.reviews || 0, state.reviews.length);
      state.remoteReady = true;
      renderAll();
      persistState();
      return true;
    }).catch(function () {
      state.remoteReady = false;
      return false;
    });
  }

  function showApp(user) {
    state.user = String(user || '当前用户').trim();
    loadAccountState(state.user);
    state.remoteAuth = state.remoteAuth || !!(Api.enabled() && (Api.token || Api.csrfToken));
    state.unlockedStep = 1;
    document.body.setAttribute('data-authenticated', 'true');
    $('current-user').textContent = state.user;
    $('login-screen').hidden = true;
    $('app-shell').hidden = false;
    renderBrandOptions();
    $('brand-select').value = 'new';
    clearBrandFields();
    renderAll();
    showStep(1);
    if (state.remoteAuth) syncRemoteState();
  }

  function logout() {
    persistState();
    if (Api.enabled() && state.remoteAuth) Api.logout().catch(function () {});
    closeHistory();
    clearAccountState();
    state.user = '';
    state.currentStep = 1;
    state.unlockedStep = 1;
    document.body.setAttribute('data-authenticated', 'false');
    $('app-shell').hidden = true;
    $('login-screen').hidden = false;
    $('login-password').value = '';
    if ($('register-password-confirm')) $('register-password-confirm').value = '';
    setAuthMode('login');
    $('login-email').focus();
  }

  function normalizeEmail(value) {
    return String(value || '').trim().toLowerCase();
  }

  function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  function readAuthAccounts() {
    try { return JSON.parse(window.localStorage.getItem(AUTH_STORAGE_KEY) || '{}') || {}; }
    catch (error) { return {}; }
  }

  function writeAuthAccounts(accounts) {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(accounts));
  }

  function bytesToBase64(bytes) {
    var binary = '';
    for (var i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]);
    return window.btoa(binary);
  }

  function base64ToBytes(value) {
    var binary = window.atob(value);
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  function randomSalt() {
    var salt = new Uint8Array(16);
    window.crypto.getRandomValues(salt);
    return bytesToBase64(salt);
  }

  async function hashPassword(password, saltBase64) {
    var encoder = new TextEncoder();
    var keyMaterial = await window.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    var bits = await window.crypto.subtle.deriveBits({
      name: 'PBKDF2',
      salt: base64ToBytes(saltBase64),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    }, keyMaterial, 256);
    return bytesToBase64(new Uint8Array(bits));
  }

  function sameDigest(first, second) {
    if (!first || !second || first.length !== second.length) return false;
    var difference = 0;
    for (var i = 0; i < first.length; i += 1) difference |= first.charCodeAt(i) ^ second.charCodeAt(i);
    return difference === 0;
  }

  function setAuthMode(mode) {
    currentAuthMode = mode === 'register' ? 'register' : 'login';
    var registering = currentAuthMode === 'register';
    if ($('auth-tab-login')) {
      $('auth-tab-login').classList.toggle('is-active', !registering);
      $('auth-tab-login').setAttribute('aria-selected', String(!registering));
    }
    if ($('auth-tab-register')) {
      $('auth-tab-register').classList.toggle('is-active', registering);
      $('auth-tab-register').setAttribute('aria-selected', String(registering));
    }
    if ($('confirm-password-field')) $('confirm-password-field').hidden = !registering;
    if ($('auth-submit')) $('auth-submit').textContent = registering ? '注册并进入' : '邮箱登录';
    if ($('login-password')) $('login-password').setAttribute('autocomplete', registering ? 'new-password' : 'current-password');
    if ($('password-hint')) $('password-hint').textContent = registering ? '至少 8 位，建议同时包含字母和数字。' : '请输入注册时设置的密码。';
    if ($('login-note')) $('login-note').textContent = registering ? '注册只保存在当前浏览器中，不发送短信或邮件验证码。' : '账号数据保存在当前浏览器中，不发送短信或邮件验证码。';
  }

  async function handleAuthSubmit(event) {
    if (event) event.preventDefault();
    var email = normalizeEmail($('login-email').value);
    var password = $('login-password').value;
    var confirmPassword = $('register-password-confirm').value;
    var emailField = $('login-email');
    var passwordField = $('login-password');
    var confirmField = $('register-password-confirm');
    [emailField, passwordField, confirmField].forEach(function (field) { if (field) field.classList.remove('is-invalid'); });
    var valid = true;
    if (!isValidEmail(email)) { emailField.classList.add('is-invalid'); valid = false; }
    if (password.length < 8) { passwordField.classList.add('is-invalid'); valid = false; }
    if (currentAuthMode === 'register' && password !== confirmPassword) { confirmField.classList.add('is-invalid'); valid = false; }
    if (!valid) {
      toast('请检查邮箱、密码和确认密码，密码至少 8 位。', 'warning');
      return;
    }
    if (!window.crypto || !window.crypto.subtle) {
      toast('当前浏览器不支持安全密码存储，请使用最新版 Chrome、Edge 或 Safari。', 'error');
      return;
    }
    if (Api.enabled()) {
      setBusy($('auth-submit'), true);
      try {
        var remoteResult = currentAuthMode === 'register'
          ? await Api.register(email, password, $('login-role').value)
          : await Api.login(email, password);
        state.remoteAuth = true;
        showApp(remoteResult.user.email || email);
        toast(currentAuthMode === 'register' ? '云端账号注册成功。' : '云端账号登录成功。');
        return;
      } catch (error) {
        if (error.code !== 'API_OFFLINE' && error.code !== 'API_TIMEOUT') {
          toast(error.message || '邮箱服务暂不可用。', 'warning');
          return;
        }
        state.remoteAuth = false;
        toast('服务端账号暂不可用，已切换到当前浏览器本地账号模式。', 'warning');
      } finally {
        setBusy($('auth-submit'), false);
      }
    }
    var accounts = readAuthAccounts();
    if (currentAuthMode === 'register') {
      if (accounts[email]) {
        toast('该邮箱已经注册，请直接登录。', 'warning');
        setAuthMode('login');
        return;
      }
      setBusy($('auth-submit'), true);
      try {
        var salt = randomSalt();
        var passwordHash = await hashPassword(password, salt);
        accounts[email] = { email: email, salt: salt, passwordHash: passwordHash, createdAt: now() };
        writeAuthAccounts(accounts);
        showApp(email);
        toast('注册成功，账号数据会独立保存在当前浏览器。');
      } catch (error) {
        toast('注册失败，请稍后重试。', 'error');
      } finally {
        setBusy($('auth-submit'), false);
      }
      return;
    }
    var account = accounts[email];
    if (!account) {
      toast('该邮箱尚未注册，请先切换到“注册新账号”。', 'warning');
      return;
    }
    setBusy($('auth-submit'), true);
    try {
      var digest = await hashPassword(password, account.salt);
      if (!sameDigest(digest, account.passwordHash)) {
        passwordField.classList.add('is-invalid');
        toast('邮箱或密码不正确。', 'warning');
        return;
      }
      showApp(email);
      toast('登录成功。');
    } catch (error) {
      toast('登录失败，请稍后重试。', 'error');
    } finally {
      setBusy($('auth-submit'), false);
    }
  }

  async function changePassword() {
    var oldPassword = window.prompt('请输入当前密码：');
    if (oldPassword == null) return;
    var newPassword = window.prompt('请输入新密码（至少 8 位）：');
    if (newPassword == null) return;
    if (newPassword.length < 8) { toast('新密码至少需要 8 位。', 'warning'); return; }
    if (Api.enabled() && state.remoteAuth) {
      try {
        await Api.changePassword(oldPassword, newPassword);
        toast('服务端密码已修改。');
      } catch (error) {
        toast(error.message || '修改密码失败。', 'warning');
      }
      return;
    }
    var accounts = readAuthAccounts();
    var account = accounts[state.accountId];
    if (!account) { toast('当前账号没有本地密码记录。', 'warning'); return; }
    try {
      var currentHash = await hashPassword(oldPassword, account.salt);
      if (!sameDigest(currentHash, account.passwordHash)) { toast('当前密码不正确。', 'warning'); return; }
      var salt = randomSalt();
      account.salt = salt;
      account.passwordHash = await hashPassword(newPassword, salt);
      account.updatedAt = now();
      writeAuthAccounts(accounts);
      toast('本地账号密码已修改。');
    } catch (error) {
      toast('修改密码失败。', 'error');
    }
  }

  function toast(message, kind) {
    var region = $('toast-region');
    var item = document.createElement('div');
    item.className = 'toast';
    item.setAttribute('data-kind', kind || 'info');
    item.textContent = message;
    region.appendChild(item);
    window.setTimeout(function () { item.remove(); }, 4200);
  }

  function markConnection(status, detail) {
    if (status === 'connecting') Renderer.setConnection('connecting', '连接中', '探测网关', Config.protocolVersion);
    if (status === 'connected') Renderer.setConnection('connected', '已连接', '实时网关', Config.protocolVersion);
    if (status === 'local') Renderer.setConnection('local', '本地处理', '无需网关', Config.protocolVersion);
    if (status === 'disconnected') Renderer.setConnection('disconnected', '已断开', '本地处理', Config.protocolVersion);
    if (detail) $('last-event').textContent = detail;
  }

  function setBusy(element, busy) {
    if (!element) return;
    element.disabled = !!busy;
    document.body.classList.toggle('is-busy', !!busy);
  }

  function setProgress(stage, percent, message) {
    var keys = ['brand', 'retrieve', 'generate', 'verify', 'store'];
    var normalized = stage === 'ingest' ? 'brand' : stage;
    var index = keys.indexOf(normalized);
    if ($('progress-percent')) $('progress-percent').textContent = Math.max(0, Math.min(100, percent || 0)) + '%';
    if ($('progress-bar')) $('progress-bar').style.width = Math.max(0, Math.min(100, percent || 0)) + '%';
    $$('#progress-list li').forEach(function (item, itemIndex) {
      item.classList.toggle('is-done', itemIndex < index || percent >= 100);
      item.classList.toggle('is-active', itemIndex === index && percent < 100);
    });
    if (message) appendStream(message);
    var pipelineStage = normalized === 'brand' ? 'ingest' : normalized === 'store' ? 'review' : normalized;
    Renderer.updatePipeline(pipelineStage);
  }

  function appendStream(message) {
    var stream = $('stream-window');
    if (!message || !$('stream-window')) return;
    if (stream.querySelector('.stream-placeholder')) stream.textContent = '';
    var line = document.createElement('div');
    line.textContent = '› ' + message;
    stream.appendChild(line);
    stream.scrollTop = stream.scrollHeight;
  }

  function updateLastEvent(message) {
    state.lastEvent = message.event || 'unknown';
    $('last-event').textContent = state.lastEvent;
    if ($('last-sync')) $('last-sync').textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  function renderAll() {
    Renderer.renderFacts(state);
    Renderer.renderRisks(state);
    Renderer.renderArtifacts(state);
    Renderer.renderTasks(state);
    Renderer.renderReviews(state);
    Renderer.renderRoleReviews(state);
    Renderer.renderPublishRecords(state);
    Renderer.renderDocuments(state);
    Renderer.renderHistory(state);
    Renderer.renderMetrics(state);
  }

  function createHistoryRecord(payload, result) {
    var highRisk = (state.risks || []).filter(function (risk) { return risk.level === 'high'; }).length;
    return {
      id: state.currentJobId || result.jobId || uid('history'),
      jobId: state.currentJobId || result.jobId || '',
      accountId: state.accountId,
      accountName: state.accountName,
      createdAt: result.createdAt || now(),
      updatedAt: now(),
      brand: cloneData(state.brand || payload.brand),
      facts: cloneData(state.facts || []),
      risks: cloneData(state.risks || []),
      artifacts: cloneData(state.artifacts || []),
      versions: [{ version: 1, artifacts: cloneData(state.artifacts || []), createdAt: now(), note: 'AI 初始稿' }],
      roleReviews: cloneData(state.roleReviews || []),
      modelInfo: cloneData(result.modelInfo || {}),
      mode: state.transportMode,
      platform: payload.platform,
      platformName: payload.platformName,
      contentType: payload.contentType,
      contentTypeName: payload.contentTypeName,
      audience: payload.audience,
      theme: payload.theme,
      goal: payload.goal,
      constraints: payload.constraints,
      promotionMethods: cloneData(payload.promotionMethods || []),
      reviewCount: 0,
      status: highRisk ? '已拦截待修改' : '待品牌确认',
      metrics: {
        facts: (state.facts || []).filter(function (fact) { return fact.status !== '待核实'; }).length,
        artifacts: (state.artifacts || []).length,
        risks: (state.risks || []).length,
        highRisk: highRisk
      }
    };
  }

  function syncHistoryRecord() {
    var record = state.history.filter(function (item) { return item.jobId === state.currentJobId; })[0];
    if (!record) return;
    record.updatedAt = now();
    record.brand = cloneData(state.brand);
    record.facts = cloneData(state.facts || []);
    record.risks = cloneData(state.risks || []);
    var nextArtifacts = cloneData(state.artifacts || []);
    var lastVersion = (record.versions || [])[(record.versions || []).length - 1];
    if (!lastVersion || JSON.stringify(lastVersion.artifacts) !== JSON.stringify(nextArtifacts)) {
      record.versions = (record.versions || []).concat([{ version: (record.versions || []).length + 1, artifacts: nextArtifacts, createdAt: now(), note: '人工审核后版本' }]).slice(-20);
    }
    record.artifacts = nextArtifacts;
    record.roleReviews = cloneData(state.roleReviews || []);
    record.reviewCount = state.reviews.filter(function (review) { return review.jobId === state.currentJobId; }).length;
    var task = state.tasks.filter(function (item) { return item.jobId === state.currentJobId; })[0];
    if (task) record.status = task.status;
  }

  function openHistory() {
    Renderer.renderHistory(state);
    var drawer = $('history-drawer');
    if (!drawer) return;
    drawer.hidden = false;
    historyReturnFocus = document.activeElement;
    document.body.classList.add('history-open');
    var closeButton = drawer.querySelector('button[data-action="close-history"]');
    if (closeButton) closeButton.focus();
  }

  function closeHistory() {
    var drawer = $('history-drawer');
    if (!drawer) return;
    drawer.hidden = true;
    document.body.classList.remove('history-open');
    if (historyReturnFocus && historyReturnFocus.focus) historyReturnFocus.focus();
    historyReturnFocus = null;
  }

  function viewHistoryRecord(recordId) {
    var record = state.history.filter(function (item) { return item.id === recordId; })[0];
    if (!record || !record.artifacts || !record.artifacts.length) {
      toast('这条历史记录没有可查看的完整内容。', 'warning');
      return;
    }
    state.currentJobId = record.jobId || record.id;
    state.brand = cloneData(record.brand);
    state.facts = cloneData(record.facts || []);
    state.risks = cloneData(record.risks || []);
    state.artifacts = cloneData(record.artifacts || []);
    state.roleReviews = cloneData(record.roleReviews || []);
    state.metrics.facts = state.facts.filter(function (fact) { return fact.status !== '待核实'; }).length;
    state.metrics.jobs = state.tasks.length;
    state.metrics.reviews = state.reviews.length;
    state.unlockedStep = Math.max(state.unlockedStep, 5);
    closeHistory();
    renderAll();
    showStep(5);
    toast('已打开历史生成记录：' + ((record.brand && record.brand.name) || '未命名品牌'));
  }

  function deleteHistoryRecord(recordId) {
    var record = state.history.filter(function (item) { return item.id === recordId; })[0];
    if (!record) return;
    if (!window.confirm('确定删除这条历史生成记录吗？删除后不可恢复。')) return;
    state.history = state.history.filter(function (item) { return item.id !== recordId; });
    persistState();
    if (Api.enabled() && state.remoteAuth) Api.deleteHistory(recordId).catch(function () {});
    renderAll();
    toast('历史生成记录已删除。');
  }

  function validateFields(ids) {
    var valid = true;
    ids.forEach(function (id) {
      var field = $(id);
      var empty = !String(field.value || '').trim();
      field.classList.toggle('is-invalid', empty);
      if (empty) valid = false;
    });
    if (!valid) toast('请先补全标为红色的必填字段。', 'warning');
    return valid;
  }

  function collectBrand() {
    var historyProducts = $('brand-materials').value.trim();
    var interviews = $('interview-notes').value.trim();
    return {
      id: ($('brand-select').value === 'new' ? 'brand-' + Date.now() : $('brand-select').value),
      name: $('brand-name').value.trim(),
      type: $('brand-type').value.trim(),
      tone: $('brand-tone').value.trim(),
      materials: historyProducts + (interviews ? '\n' + interviews : ''),
      interviews: interviews,
      isDemo: false
    };
  }

  function performanceFeedback() {
    return state.publishRecords.slice(0, 5).map(function (record) {
      return record.platform + ':' + (record.impressions || 0) + '曝光/' + (record.likes || 0) + '赞/' + (record.saves || 0) + '藏';
    });
  }
  function collectGeneration() {
    var platform = selected('platform').value;
    var contentType = selected('contentType').value;
    return {
      brand: state.brand || collectBrand(),
      facts: state.facts,
      platform: platform,
      platformName: platformName(platform),
      contentType: contentType,
      contentTypeName: typeName(contentType),
      audience: $('target-audience').value.trim(),
      theme: $('campaign-theme').value.trim(),
      goal: $('content-goal').value.trim(),
      constraints: $('content-constraints').value.trim(),
      promotionMethods: selectedPromotionMethods().map(function (method) { return method.title; }),
      promotionMethodIds: selectedPromotionMethods().map(function (method) { return method.id; }),
      performanceFeedback: performanceFeedback(),
      isDemo: !!(state.brand && state.brand.isDemo)
    };
  }

  function localRequest(event, payload, onEvent) {
    state.transportMode = '本地处理模式';
    if (event === 'brand.ingest') {
      return delay(100 * scale).then(function () {
        var materials = (payload.brand && payload.brand.materials) || payload.materials || '';
        var sourceDocument = payload.sourceDocument || (state.documents && state.documents[0]) || null;
        var facts = Engine.extractFacts(materials, { sourceName: payload.sourceName || '品牌资料', sourceDocument: sourceDocument });
        var result = { brandId: payload.brand.id, brand: payload.brand, facts: facts, mode: 'local' };
        if (onEvent) onEvent({ event: 'brand.ready', payload: result });
        return result;
      });
    }
    if (event === 'content.generate') {
      var stages = [
        { stage: 'retrieve', percent: 18, message: '从知识库召回品牌事实与未核实线索' },
        { stage: 'generate', percent: 38, message: '本地处理引擎生成品牌故事、内容日历、多平台文案和年轻化表达方案' },
        { stage: 'verify', percent: 70, message: '逐句扫描医疗功效、非遗身份、文化正统性、荣誉和年份' },
        { stage: 'store', percent: 90, message: '整理事实引用、助手初稿和品牌方确认证据' }
      ];
      var result = null;
      var chain = delay(170 * scale);
      stages.forEach(function (stage) {
        chain = chain.then(function () {
          if (onEvent) onEvent({ event: 'job.progress', payload: stage });
          if (stage.stage === 'generate') {
            var preview = '正在组织标题、事实引用和平台语气…';
            if (onEvent) onEvent({ event: 'content.delta', payload: { text: preview } });
          }
          return delay(170 * scale);
        });
      });
      return chain.then(function () {
        var risks = Engine.detectRisks({
          materials: payload.brand.materials,
          constraints: payload.constraints,
          theme: payload.theme,
          goal: payload.goal,
          facts: payload.facts
        });
        var modelInfo = { model: 'local-rule-engine', mode: '本地处理模式', promptVersion: Engine.PROMPT_VERSION };
        var artifacts = Engine.generateContent({
          brand: payload.brand, facts: payload.facts, risks: risks, platform: payload.platform,
          contentType: payload.contentType, audience: payload.audience, theme: payload.theme,
          goal: payload.goal, constraints: payload.constraints, modelInfo: modelInfo, isDemo: payload.isDemo
        });
        var roleReviews = Engine.runRoleReview({ facts: payload.facts, risks: risks, theme: payload.theme, platformName: payload.platformName });
        result = { jobId: uid('job'), brand: payload.brand, facts: payload.facts, risks: risks, artifacts: artifacts, roleReviews: roleReviews, modelInfo: modelInfo, createdAt: now(), mode: 'local' };
        if (onEvent) onEvent({ event: 'content.delta', payload: { text: artifacts[0].content.slice(0, 96).replace(/\n/g, ' ') + '…' } });
        if (onEvent) onEvent({ event: 'job.ready', payload: result });
        return result;
      });
    }
    if (event === 'review.update') {
      return delay(90 * scale).then(function () {
        var result = {
          reviewId: uid('review'), jobId: payload.jobId, artifactId: payload.artifactId,
          action: payload.action, reviewer: payload.reviewer || '当前品牌确认人', note: payload.note || '',
          before: payload.before || '', after: payload.after || '', createdAt: now(), mode: 'local'
        };
        if (onEvent) onEvent({ event: 'review.saved', payload: result });
        return result;
      });
    }
    return Promise.resolve(payload || {});
  }

  function requestTransport(event, payload, resolveEvent, onEvent) {
    if (!gateway.isConnected()) return localRequest(event, payload, onEvent);
    state.transportMode = 'WebSocket 实时网关';
    return gateway.request(event, payload, resolveEvent, onEvent).catch(function (error) {
      state.transportMode = '本地处理模式';
      appendStream('网关请求失败，已自动切换到本地处理引擎。');
      toast('网关暂不可用，已切换到本地处理模式。', 'warning');
      return localRequest(event, payload, onEvent);
    });
  }

  async function ingestBrand() {
    if (!validateFields(['brand-name', 'brand-type', 'brand-tone', 'brand-materials'])) return null;
    var brand = collectBrand();
    setBusy($('ingest-button'), true);
    $('brand-status').textContent = '提取中';
    $('brand-status').className = 'status-chip is-active';
    setProgress('ingest', 8, '提交品牌资料并识别可引用原文');
    try {
      var result = await requestTransport('brand.ingest', {
        brand: brand, sourceName: '用户提交品牌资料', sourceDocument: state.documents[0] || { id: 'manual-source', name: '手工粘贴资料', authority: $('source-type') ? $('source-type').value : 'user', hash: '' }
      }, 'brand.ready', function (message) {
        updateLastEvent(message);
        if (message.event === 'brand.ready') setProgress('retrieve', 24, '品牌事实提取完成，进入可检索状态');
      });
      state.brand = result.brand || brand;
      state.facts = result.facts || [];
      state.conflicts = Engine.detectConflicts(state.facts);
      state.metrics.facts = state.facts.filter(function (fact) { return fact.status !== '待核实'; }).length;
      $('brand-status').textContent = state.facts.length + ' 条事实';
      $('brand-status').className = 'status-chip is-active';
      setProgress('retrieve', 24, '知识库已建立，可在生成时逐条引用事实编号');
      rememberCurrentBrand();
      renderBrandOptions();
    $('brand-select').value = 'new';
      renderAll();
      toast('品牌叙事档案已建立：' + state.facts.length + ' 条记录，其中 ' + state.facts.filter(function (fact) { return fact.status === '待核实'; }).length + ' 条待核实。');
      return result;
    } catch (error) {
      $('brand-status').textContent = '提取失败';
      $('brand-status').className = 'status-chip is-warning';
      toast(error.message || '品牌资料处理失败', 'error');
      return null;
    } finally {
      setBusy($('ingest-button'), false);
    }
  }

  async function generateContent() {
    if (!validateFields(['target-audience', 'campaign-theme', 'content-goal', 'content-constraints'])) return null;
    if (!state.facts.length) {
      var ingestResult = await ingestBrand();
      if (!ingestResult) return null;
    }
    var payload = collectGeneration();
    state.risks = [];
    state.artifacts = [];
    renderAll();
    if ($('stream-window')) $('stream-window').textContent = '';
    setProgress('retrieve', 4, '创建 content.generate 任务');
    $('job-status').textContent = '正在生成';
    $('job-status').className = 'status-chip is-active';
    setBusy($('generate-button'), true);
    try {
      var result = await requestTransport('content.generate', payload, 'job.ready', function (message) {
        updateLastEvent(message);
        if (message.event === 'job.accepted') setProgress('retrieve', 10, message.payload.message || '任务已受理');
        if (message.event === 'job.progress') setProgress(message.payload.stage, message.payload.percent, message.payload.message);
        if (message.event === 'content.delta' && message.payload.text) appendStream(message.payload.text);
        if (message.event === 'job.ready') setProgress('store', 96, '完整内容、事实引用和风险列表已返回');
      });
      state.currentJobId = result.jobId || uid('job');
      state.facts = result.facts || state.facts;
      state.risks = result.risks || [];
      state.artifacts = result.artifacts || [];
      state.roleReviews = result.roleReviews || Engine.runRoleReview({ facts: state.facts, risks: state.risks, theme: payload.theme, platformName: payload.platformName });
      state.metrics.facts = state.facts.filter(function (fact) { return fact.status !== '待核实'; }).length;
      state.metrics.jobs += 1;
      var highRisk = state.risks.filter(function (risk) { return risk.level === 'high'; }).length;
      state.tasks.unshift({
        jobId: state.currentJobId, createdAt: result.createdAt || now(), brandName: payload.brand.name,
        platformName: payload.platformName, mode: state.transportMode, model: (result.modelInfo && result.modelInfo.model) || 'local-rule-engine',
        promptVersion: (result.modelInfo && result.modelInfo.promptVersion) || Engine.PROMPT_VERSION,
        riskCount: state.risks.length, highRisk: highRisk, reviewCount: 0, status: highRisk ? '已拦截待修改' : '待品牌确认'
      });
      var historyRecord = createHistoryRecord(payload, result);
      state.history.unshift(historyRecord);
      if (state.history.length > HISTORY_LIMIT) state.history.length = HISTORY_LIMIT;
      if (Api.enabled() && state.remoteAuth) Api.saveHistory(historyRecord).catch(function () {});
      setProgress('store', 100, '内容生成完成，事实引用和宣传方法已记录');
      Renderer.updatePipeline('review');
      $('job-status').textContent = highRisk ? highRisk + ' 项高风险' : '待品牌方确认';
      $('job-status').className = 'status-chip ' + (highRisk ? 'is-warning' : 'is-active');
      rememberCurrentBrand();
      persistState();
      renderAll();
      state.unlockedStep = Math.max(state.unlockedStep, 5);
      showStep(5);
      toast(highRisk ? '内容已生成，但发现 ' + highRisk + ' 项高风险，需修改并复核后才能发布。' : '内容已生成，请品牌方确认事实、文化内涵和对外表达。', highRisk ? 'warning' : 'info');
      return result;
    } catch (error) {
      $('job-status').textContent = '生成失败';
      $('job-status').className = 'status-chip is-warning';
      toast(error.message || '这稿没写成', 'error');
      return null;
    } finally {
      setBusy($('generate-button'), false);
    }
  }

  function findArtifact(id) {
    return state.artifacts.filter(function (artifact) { return artifact.id === id; })[0];
  }

  async function submitReview(artifactId, action, options) {
    options = options || {};
    var artifact = findArtifact(artifactId);
    if (!artifact) return null;
    var before = artifact.content;
    var after = action === 'edit' ? String(options.content || '') : '';
    if (action === 'edit' && !after.trim()) {
      toast('人工修改稿不能为空。', 'warning');
      return null;
    }
    var review = await requestTransport('review.update', {
      jobId: state.currentJobId, artifactId: artifactId, action: action,
      reviewer: options.reviewer || '当前品牌确认人', note: options.note || (action === 'accept' ? '事实、文化内涵和对外表达已由品牌方确认。' : action === 'edit' ? '已保存品牌方确认稿，AI 原稿保留。' : '已退回修改，等待品牌方确认。'),
      before: before, after: after
    }, 'review.saved');
    if (action === 'accept') artifact.status = 'accepted';
    if (action === 'flag') artifact.status = 'flagged';
    if (action === 'reject') artifact.status = 'rejected';
    if (action === 'edit') {
      artifact.originalContent = artifact.originalContent || before;
      artifact.content = after;
      artifact.status = state.risks.some(function (risk) { return risk.level === 'high'; }) ? 'flagged' : 'edited';
    }
    state.reviews.unshift(review);
    state.metrics.reviews = state.reviews.length;
    var task = state.tasks.filter(function (item) { return item.jobId === state.currentJobId; })[0];
    if (task) {
      task.reviewCount += 1;
      task.status = action === 'accept' ? '品牌方已确认' : action === 'flag' ? '已退回修改' : action === 'reject' ? '已驳回' : '品牌方修改待复审';
    }
    syncHistoryRecord();
    persistState();
    if (Api.enabled() && state.remoteAuth) {
      Api.saveReview(review).catch(function () {});
      var updatedHistory = state.history.filter(function (item) { return item.jobId === state.currentJobId; })[0];
      if (updatedHistory) Api.saveHistory(updatedHistory).catch(function () {});
    }
    renderAll();
    if (!options.silent) toast('品牌确认记录已保存：' + (action === 'accept' ? '品牌方确认' : action === 'edit' ? '品牌方修改' : action === 'reject' ? '驳回' : '退回修改'));
    return review;
  }

  function handleArtifactAction(button) {
    var action = button.getAttribute('data-review');
    var artifactId = button.getAttribute('data-artifact');
    var card = button.closest('.artifact-card');
    var noteField = card && card.querySelector('.artifact-note');
    var reviewNote = noteField ? noteField.value.trim() : '';
    if (action === 'copy') {
      var artifact = findArtifact(artifactId);
      navigator.clipboard.writeText(artifact ? artifact.content : '').then(function () {
        toast('内容已复制到剪贴板。');
      }).catch(function () {
        toast('浏览器未授予剪贴板权限，请手动选择文本复制。', 'warning');
      });
      return;
    }
    if (action === 'edit') {
      card.classList.add('is-editing');
      var textarea = card.querySelector('.artifact-textarea');
      textarea.focus();
      return;
    }
    if (action === 'save') {
      var editor = card.querySelector('.artifact-textarea');
      submitReview(artifactId, 'edit', { content: editor.value, note: reviewNote || '保存品牌方修改稿，AI 原稿已保留。' }).then(function (review) {
        if (review) card.classList.remove('is-editing');
      });
      return;
    }
    if (action === 'flag') {
      submitReview(artifactId, 'flag', { note: reviewNote || '品牌方认为该成果需在对外表达前继续修改。' });
      return;
    }
    if (action === 'accept') submitReview(artifactId, 'accept', { note: reviewNote || undefined });
  }

  async function verifyFactsRemote(button) {
    if (!Api.enabled() || !state.remoteAuth) {
      toast('权威核验需要先配置并登录服务端。', 'warning');
      return;
    }
    if (!state.facts.length) { toast('请先提取事实。', 'warning'); return; }
    setBusy(button, true);
    try {
      var result = await Api.verifyFacts(state.facts);
      state.facts = result.facts || state.facts;
      state.conflicts = Engine.detectConflicts(state.facts);
      rememberCurrentBrand();
      renderAll();
      toast(result.configured ? '权威核验请求已完成。' : '未配置权威核验服务，事实继续保持待核验。', result.configured ? 'info' : 'warning');
    } catch (error) {
      toast(error.message || '权威核验失败。', 'warning');
    } finally {
      setBusy(button, false);
    }
  }

  function exportMarkdown() {
    if (!state.artifacts.length) return;
    var brand = state.brand || collectBrand();
    var lines = ['# 老字号叙事工坊｜' + brand.name + '内容品牌确认包', '', '> 导出时间：' + new Date().toLocaleString('zh-CN') + '  ', '> 协议版本：luyun-gateway/2.0  ', '> 运行模式：' + state.transportMode, ''];
    lines.push('## 事实知识库');
    state.facts.forEach(function (fact) {
      lines.push('- **' + fact.id + '｜' + fact.category + '**：' + fact.text + '  ');
      lines.push('  来源：' + fact.source + '；置信度：' + Math.round(fact.confidence * 100) + '%；状态：' + fact.status);
    });
    lines.push('', '## 风险与事实校验');
    if (!state.risks.length) lines.push('- 本次未检出风险项。');
    state.risks.forEach(function (risk) {
      lines.push('- **' + risk.id + '｜' + risk.level + '｜' + risk.type + '**：' + risk.term);
      lines.push('  - 位置：' + risk.location + '；依据：' + risk.reason);
      lines.push('  - 建议：' + risk.suggestion);
    });
    lines.push('', '## 内容成果');
    state.artifacts.forEach(function (artifact) {
      lines.push('', '### ' + artifact.title, '', '状态：' + artifact.status + '  ', '模型：' + artifact.modelInfo.model + '  ', '提示词：' + artifact.modelInfo.promptVersion + '  ', '参考宣传方法：' + ((artifact.methods || []).join('、') || '未选择'), '', artifact.content);
    });
    lines.push('', '## 品牌方确认记录');
    lines.push('', '## 发布与效果回流');
    if (!state.publishRecords.length) lines.push('- 暂无发布记录。');
    state.publishRecords.forEach(function (record) { lines.push('- ' + record.platform + '｜' + record.status + '｜' + (record.date || '未填写日期') + '｜曝光 ' + record.impressions + '｜点赞 ' + record.likes + '｜收藏 ' + record.saves + '｜转化 ' + record.conversions); if (record.url) lines.push('  - 链接/位置：' + record.url); if (record.note) lines.push('  - 备注：' + record.note); });
    state.reviews.forEach(function (review) {
      lines.push('- ' + Renderer.formatTime(review.createdAt) + '｜' + review.reviewer + '｜' + review.action + '｜' + review.artifactId);
      if (review.note) lines.push('  - ' + review.note);
      if (review.before && review.after) lines.push('  - 已保留修改前后文本，详见页面记录。');
    });
    var blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = '老字号叙事工坊-' + brand.name.replace(/[\\/:*?"<>|]/g, '') + '-品牌确认包.md';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function populateBrand(brand) {
    $('brand-name').value = brand.name || '';
    $('brand-type').value = brand.type || '';
    $('brand-tone').value = brand.tone || '';
    $('brand-materials').value = brand.materials || '';
    $('interview-notes').value = brand.interviews || '';
  }

  function clearBrandFields() {
    ['brand-name', 'brand-type', 'brand-tone', 'brand-materials', 'interview-notes'].forEach(function (id) { if ($(id)) $(id).value = ''; });
    state.brand = null;
    state.facts = [];
    state.risks = [];
    renderAll();
  }

  function startNewBrand(showToast) {
    state.brand = null;
    state.facts = [];
    state.risks = [];
    state.artifacts = [];
    state.roleReviews = [];
    state.currentJobId = '';
    state.metrics.facts = 0;
    state.unlockedStep = 1;
    if ($('brand-select')) $('brand-select').value = 'new';
    clearBrandFields();
    if ($('content-form')) $('content-form').reset();
    if ($('stream-window')) $('stream-window').textContent = '';
    setProgress('brand', 0, '');
    renderAll();
    showStep(1);
    if ($('brand-name')) $('brand-name').focus();
    if (showToast !== false) toast('已进入新建品牌，请填写品牌名称、类型和语气。');
  }
  function clearDemo() {
    state.brand = null;
    state.facts = [];
    state.risks = [];
    state.artifacts = [];
    state.tasks = [];
    state.reviews = [];
    state.currentJobId = '';
    state.metrics = { facts: 0, jobs: 0, reviews: 0 };
    state.pendingOnly = false;
    if ($('content-form')) $('content-form').reset();
    $('brand-select').value = 'new';
    clearBrandFields();
    $('brand-status').textContent = '待入库';
    $('brand-status').className = 'status-chip';
    $('job-status').textContent = '等待任务';
    $('job-status').className = 'status-chip';
    if ($('stream-window')) $('stream-window').textContent = '';
    setProgress('brand', 0, '');
    persistState();
    renderAll();
    showStep(1);
    toast('当前输入已清空，历史记录仍保留。');
  }

  function bufferToHex(buffer) {
    return Array.prototype.map.call(new Uint8Array(buffer), function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
  }

  async function handleFile(file) {
    try {
      var binary = /\.(pdf|docx|png|jpe?g|webp|mp3|m4a|wav|mp4)$/i.test(file.name);
      var text = '';
      var hash = '';
      var extractor = 'direct-text';
      if (binary) {
        if (!Api.enabled() || !state.remoteAuth) throw new Error('PDF、DOCX、OCR 和音频转写需要配置服务端解析器。');
        var extracted = await Api.extractDocument(file);
        text = extracted.text || '';
        hash = extracted.hash || '';
        extractor = extracted.extractor || 'external';
        if (!text.trim()) throw new Error('解析服务没有返回可用文本。');
      } else {
        text = await file.text();
        if (/\.json$/i.test(file.name)) {
          try {
            var parsed = JSON.parse(text);
            if (Array.isArray(parsed)) text = parsed.map(function (item) { return typeof item === 'string' ? item : JSON.stringify(item); }).join('\n');
          } catch (error) { toast('JSON 格式不完整，已按纯文本导入。', 'warning'); }
        }
        if (/\.csv$/i.test(file.name)) text = text.split(/\r?\n/).map(function (line) { return line.split(',').join('，'); }).join('\n');
        if (window.crypto && window.crypto.subtle && file.arrayBuffer) hash = bufferToHex(await window.crypto.subtle.digest('SHA-256', await file.arrayBuffer()));
      }
      var sourceType = $('source-type') ? $('source-type').value : 'user';
      var documentRecord = { id: uid('doc'), name: file.name, size: file.size, type: file.type || 'application/octet-stream', hash: hash, extractor: extractor, authority: sourceType, status: hash ? '已记录指纹' : '无指纹', importedAt: now() };
      state.documents.unshift(documentRecord);
      if (Api.enabled() && state.remoteAuth) Api.saveDocument(documentRecord).catch(function () {});
      var current = $('brand-materials').value.trim();
      $('brand-materials').value = current ? current + '\n' + text : text;
      $('file-import-status').textContent = '已导入 ' + file.name + '（' + Math.ceil(file.size / 1024) + ' KB，' + extractor + '，SHA-256 ' + (hash ? hash.slice(0, 12) + '…' : '未计算') + '）';
      persistState();
      renderAll();
      toast('资料已导入，并记录来源指纹。');
    } catch (error) {
      toast(error.message || '文件读取失败，请确认编码为 UTF-8。', 'error');
    }
  }

  function addPublishRecord(event) {
    event.preventDefault();
    var record = {
      id: uid('publish'),
      platform: $('publish-platform').value,
      date: $('publish-date').value,
      status: $('publish-status').value,
      url: $('publish-url').value.trim(),
      note: $('publish-note').value.trim(),
      impressions: Number($('publish-impressions').value || 0),
      likes: Number($('publish-likes').value || 0),
      saves: Number($('publish-saves').value || 0),
      conversions: Number($('publish-conversions').value || 0),
      jobId: state.currentJobId || '',
      brandName: state.brand ? state.brand.name : '',
      createdAt: now()
    };
    state.publishRecords.unshift(record);
    persistState();
    if (Api.enabled() && state.remoteAuth) Api.savePublish(record).catch(function () {});
    Renderer.renderPublishRecords(state);
    $('publish-form').reset();
    toast('发布与效果记录已保存。');
    return record;
  }
  async function handleNext(button) {
    var target = Number(button.getAttribute('data-next'));
    if (target === 2) {
      if (!validateFields(['brand-type', 'brand-name', 'brand-tone'])) return;
      state.unlockedStep = Math.max(state.unlockedStep, 2);
      showStep(2);
      return;
    }
    if (target === 3) {
      if (!validateFields(['brand-materials'])) return;
      state.unlockedStep = Math.max(state.unlockedStep, 3);
      showStep(3);
      return;
    }
    if (target === 4) {
      var result = await ingestBrand();
      if (result) { state.unlockedStep = Math.max(state.unlockedStep, 4); showStep(4); }
      return;
    }
    if (target === 6 && state.artifacts.length) state.unlockedStep = Math.max(state.unlockedStep, 6);
    showStep(target);
  }

  function bindEvents() {
    $('login-form').addEventListener('submit', handleAuthSubmit);
    $('auth-tab-login').addEventListener('click', function () { setAuthMode('login'); });
    $('auth-tab-register').addEventListener('click', function () { setAuthMode('register'); });
    $('content-form').addEventListener('submit', function (event) { event.preventDefault(); generateContent(); });
    $('publish-form').addEventListener('submit', addPublishRecord);
    $('brand-select').addEventListener('change', function () {
      if (this.value === 'new' || !state.brandLibrary[this.value]) {
        startNewBrand(true);
        return;
      }
      var item = state.brandLibrary[this.value];
      populateBrand(item.brand);
      state.brand = item.brand;
      state.facts = item.facts || [];
      renderAll();
    });
    $('file-import').addEventListener('change', function () { if (this.files[0]) handleFile(this.files[0]); });
    $('facts-list').addEventListener('click', function (event) {
      var button = event.target.closest('[data-fact-action]');
      if (!button) return;
      var fact = state.facts.filter(function (item) { return item.id === button.getAttribute('data-fact-id'); })[0];
      if (!fact) return;
      var confirming = button.getAttribute('data-fact-action') === 'confirm';
      fact.status = confirming ? '已确认' : '待核实';
      fact.verificationStatus = confirming ? '品牌方已确认' : '待核验';
      fact.evidenceLevel = confirming ? '品牌确认' : fact.evidenceLevel;
      fact.confirmedBy = confirming ? state.user : '';
      fact.confirmedAt = confirming ? now() : '';
      fact.verifiedBy = confirming ? state.user : '';
      fact.verifiedAt = confirming ? now() : '';
      fact.revision = (fact.revision || 1) + 1;
      fact.updatedAt = now();
      state.conflicts = Engine.detectConflicts(state.facts);
      rememberCurrentBrand();
      syncHistoryRecord();
      persistState();
      renderAll();
      toast(fact.id + ' 已' + (fact.status === '已确认' ? '由 ' + state.user + ' 确认' : '标记为待核实'));
    });
    $('artifact-grid').addEventListener('click', function (event) {
      var button = event.target.closest('[data-review]');
      if (button) handleArtifactAction(button);
    });
    $('export-markdown').addEventListener('click', exportMarkdown);
    document.addEventListener('click', function (event) {
      var pageButton = event.target.closest('[data-page]');
      if (pageButton) { showStep(Number(pageButton.getAttribute('data-page'))); return; }
      var nextButton = event.target.closest('[data-next]');
      if (nextButton) { handleNext(nextButton); return; }
      var historyAction = event.target.closest('[data-history-action]');
      if (historyAction) {
        var historyActionName = historyAction.getAttribute('data-history-action');
        var historyId = historyAction.getAttribute('data-history-id');
        if (historyActionName === 'view') viewHistoryRecord(historyId);
        if (historyActionName === 'delete') deleteHistoryRecord(historyId);
        return;
      }
      var action = event.target.closest('[data-action]');
      if (!action) return;
      var name = action.getAttribute('data-action');
      if (name === 'logout') logout();
      if (name === 'new-brand') startNewBrand(true);
      if (name === 'change-password') changePassword();
      if (name === 'open-history') openHistory();
      if (name === 'close-history') closeHistory();
      if (name === 'refresh-history') { if (state.remoteAuth) syncRemoteState(); else renderAll(); toast('历史记录已刷新。'); }
      if (name === 'verify-facts') verifyFactsRemote(action);
      if (name === 'filter-pending') {
        state.pendingOnly = !state.pendingOnly;
        action.classList.toggle('is-active', state.pendingOnly);
        Renderer.renderFacts(state);
      }
      if (name === 'clear-entry') clearDemo();
    });
    if ($('history-search')) $('history-search').addEventListener('input', function () { state.historyQuery = this.value.trim().toLowerCase(); Renderer.renderHistory(state); });
    if ($('history-status-filter')) $('history-status-filter').addEventListener('change', function () { state.historyStatus = this.value; Renderer.renderHistory(state); });
    document.addEventListener('keydown', function (event) {
      var drawer = $('history-drawer');
      if (!drawer || drawer.hidden) return;
      if (event.key === 'Escape') { closeHistory(); return; }
      if (event.key !== 'Tab') return;
      var focusable = Array.prototype.slice.call(drawer.querySelectorAll('button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    window.addEventListener('beforeunload', function () { gateway.close(); });
    window.addEventListener('pageshow', function () { resetToEntry(); });
  }

  function init() {
    resetToEntry();
    renderBrandOptions();
    $('brand-select').value = 'new';
    clearBrandFields();
    renderMethodGrid();
    setProgress('brand', 0, '');
    renderAll();
    showStep(1);
    markConnection('connecting');
    gateway.on('status', function (message) { markConnection(message.status, message.detail); });
    gateway.on('event', function (message) {
      updateLastEvent(message);
      if (message.event === 'connection.ready' && message.payload) {
        $('connection-protocol').textContent = message.payload.protocol || Config.protocolVersion;
      }
      if (message.event === 'state.snapshot' && message.payload && message.payload.metrics) {
        state.metrics = message.payload.metrics;
      }
    });
    bindEvents();
    if (Api.enabled() && Api.csrfToken) {
      Api.me().then(function (payload) {
        state.remoteAuth = true;
        showApp(payload.user.email);
      }).catch(function () {
        Api.clearToken();
      });
    }
    gateway.connect().then(function (connected) {
      if (connected) {
        gateway.send('state.sync', { client: 'github-pages', version: Config.appVersion });
        toast('已连接实时网关，生成进度可在线同步。');
      } else {
        toast('未配置远程网关，当前使用本地处理；内容生成、风险校验和审核记录均可正常使用。', 'info');
      }
    });
    if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol)) {
      navigator.serviceWorker.register('sw.js').catch(function () {});
    }
    state.initialized = true;
    window.__LUYUN_APP__ = {
      state: state,
      ingestBrand: ingestBrand,
      generateContent: generateContent,
      submitReview: submitReview,
      clearDemo: clearDemo,
      startNewBrand: startNewBrand,
      changePassword: changePassword,
      verifyFactsRemote: verifyFactsRemote,
      showStep: showStep,
      openHistory: openHistory,
      closeHistory: closeHistory,
      viewHistoryRecord: viewHistoryRecord,
      login: showApp
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}(window, document));

























