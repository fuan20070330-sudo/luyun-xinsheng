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
    transportMode: '本地演示模式',
    lastEvent: '--',
    initialized: false
  };

  function uid(prefix) {
    return (prefix || 'job') + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 7);
  }

  function now() { return new Date().toISOString(); }
  function selected(name) { return document.querySelector('input[name="' + name + '"]:checked'); }
  function platformName(value) { return Data.labelMaps.platform[value] || value; }
  function typeName(value) { return Data.labelMaps.contentType[value] || value; }

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
    if (status === 'disconnected') Renderer.setConnection('disconnected', '已断开', '本地演示', Config.protocolVersion);
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
    $('progress-percent').textContent = Math.max(0, Math.min(100, percent || 0)) + '%';
    $('progress-bar').style.width = Math.max(0, Math.min(100, percent || 0)) + '%';
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
    if (!message) return;
    if (stream.querySelector('.stream-placeholder')) stream.textContent = '';
    var line = document.createElement('div');
    line.textContent = '› ' + message;
    stream.appendChild(line);
    stream.scrollTop = stream.scrollHeight;
  }

  function updateLastEvent(message) {
    state.lastEvent = message.event || 'unknown';
    $('last-event').textContent = state.lastEvent;
    $('last-sync').textContent = new Date().toLocaleTimeString('zh-CN', { hour12: false });
  }

  function renderAll() {
    Renderer.renderFacts(state);
    Renderer.renderRisks(state);
    Renderer.renderArtifacts(state);
    Renderer.renderTasks(state);
    Renderer.renderReviews(state);
    Renderer.renderMetrics(state);
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
      isDemo: $('brand-select').value === 'luxiangzhai'
    };
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
      isDemo: !!(state.brand && state.brand.isDemo)
    };
  }

  function localRequest(event, payload, onEvent) {
    state.transportMode = '本地演示模式';
    if (event === 'brand.ingest') {
      return delay(100 * scale).then(function () {
        var facts = Engine.extractFacts(payload.materials, { sourceName: payload.sourceName || '品牌资料' });
        var result = { brandId: payload.brand.id, brand: payload.brand, facts: facts, mode: 'local' };
        if (onEvent) onEvent({ event: 'brand.ready', payload: result });
        return result;
      });
    }
    if (event === 'content.generate') {
      var stages = [
        { stage: 'retrieve', percent: 18, message: '从知识库召回品牌事实与未核实线索' },
        { stage: 'generate', percent: 38, message: '本地确定性引擎生成品牌故事、内容日历、多平台文案和年轻化表达方案' },
        { stage: 'verify', percent: 70, message: '逐句扫描医疗功效、非遗身份、文化正统性、荣誉和年份' },
        { stage: 'store', percent: 90, message: '整理事实引用、AI 初稿和品牌方确认证据' }
      ];
      var result = null;
      var chain = delay(170 * scale);
      stages.forEach(function (stage) {
        chain = chain.then(function () {
          if (onEvent) onEvent({ event: 'job.progress', payload: stage });
          if (stage.stage === 'generate') {
            var preview = '正在建立标题、事实引文和平台语气…';
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
        var modelInfo = { model: 'local-deterministic-demo', mode: '本地演示模式', promptVersion: Engine.PROMPT_VERSION };
        var artifacts = Engine.generateContent({
          brand: payload.brand, facts: payload.facts, risks: risks, platform: payload.platform,
          contentType: payload.contentType, audience: payload.audience, theme: payload.theme,
          goal: payload.goal, constraints: payload.constraints, modelInfo: modelInfo, isDemo: payload.isDemo
        });
        result = { jobId: uid('job'), brand: payload.brand, facts: payload.facts, risks: risks, artifacts: artifacts, modelInfo: modelInfo, createdAt: now(), mode: 'local' };
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
      state.transportMode = '本地演示模式';
      appendStream('网关请求失败，已自动切换到本地确定性引擎。');
      toast('网关暂不可用，已切换到本地演示模式。', 'warning');
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
        brand: brand, sourceName: brand.isDemo ? '鲁香斋品牌档案与受访记录（模拟）' : '用户提交品牌资料'
      }, 'brand.ready', function (message) {
        updateLastEvent(message);
        if (message.event === 'brand.ready') setProgress('retrieve', 24, '品牌事实提取完成，进入可检索状态');
      });
      state.brand = result.brand || brand;
      state.facts = result.facts || [];
      state.metrics.facts = state.facts.filter(function (fact) { return fact.status !== '待核实'; }).length;
      $('brand-status').textContent = state.facts.length + ' 条事实';
      $('brand-status').className = 'status-chip is-active';
      setProgress('retrieve', 24, '知识库已建立，可在生成时逐条引用事实编号');
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
    $('stream-window').innerHTML = '<span class="stream-placeholder">任务已提交，等待服务端内容片段…</span>';
    setProgress('retrieve', 4, '创建 content.generate 任务');
    $('job-status').textContent = '生成中';
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
      state.metrics.facts = state.facts.filter(function (fact) { return fact.status !== '待核实'; }).length;
      state.metrics.jobs += 1;
      var highRisk = state.risks.filter(function (risk) { return risk.level === 'high'; }).length;
      state.tasks.unshift({
        jobId: state.currentJobId, createdAt: result.createdAt || now(), brandName: payload.brand.name,
        platformName: payload.platformName, mode: state.transportMode, model: (result.modelInfo && result.modelInfo.model) || 'local-deterministic-demo',
        promptVersion: (result.modelInfo && result.modelInfo.promptVersion) || Engine.PROMPT_VERSION,
        riskCount: state.risks.length, highRisk: highRisk, reviewCount: 0, status: highRisk ? '已拦截待修改' : '待品牌确认'
      });
      setProgress('store', 100, '生成完成，三份内容成果已建立事实引用');
      Renderer.updatePipeline('review');
      $('job-status').textContent = highRisk ? highRisk + ' 项高风险' : '待品牌方确认';
      $('job-status').className = 'status-chip ' + (highRisk ? 'is-warning' : 'is-active');
      renderAll();
      toast(highRisk ? '生成完成，检测到 ' + highRisk + ' 项高风险，禁止直接对外发布。' : '生成完成，请品牌方确认事实、文化内涵和对外表达。', highRisk ? 'warning' : 'info');
      return result;
    } catch (error) {
      $('job-status').textContent = '生成失败';
      $('job-status').className = 'status-chip is-warning';
      toast(error.message || '内容生成失败', 'error');
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
    renderAll();
    if (!options.silent) toast('品牌确认记录已保存：' + (action === 'accept' ? '品牌方确认' : action === 'edit' ? '品牌方修改' : action === 'reject' ? '驳回' : '退回修改'));
    return review;
  }

  function handleArtifactAction(button) {
    var action = button.getAttribute('data-review');
    var artifactId = button.getAttribute('data-artifact');
    var card = button.closest('.artifact-card');
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
      submitReview(artifactId, 'edit', { content: editor.value, note: '保存品牌方修改稿，AI 原稿已保留。' }).then(function (review) {
        if (review) card.classList.remove('is-editing');
      });
      return;
    }
    if (action === 'flag') {
      submitReview(artifactId, 'flag', { note: '品牌方认为该成果需在对外表达前继续修改。' });
      return;
    }
    if (action === 'accept') submitReview(artifactId, 'accept');
  }

  function exportMarkdown() {
    if (!state.artifacts.length) return;
    var brand = state.brand || collectBrand();
    var lines = ['# 老字号叙事工坊｜' + brand.name + '内容品牌确认包', '', '> 导出时间：' + new Date().toLocaleString('zh-CN') + '  ', '> 协议版本：luyun-gateway/1.0  ', '> 运行模式：' + state.transportMode, ''];
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
      lines.push('', '### ' + artifact.title, '', '状态：' + artifact.status + '  ', '模型：' + artifact.modelInfo.model + '  ', '提示词：' + artifact.modelInfo.promptVersion, '', artifact.content);
    });
    lines.push('', '## 品牌方确认记录');
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

  function applyCase(caseId) {
    var item = Data.cases[caseId];
    if (!item) return;
    $$('[data-case]').forEach(function (button) { button.classList.toggle('is-active', button.getAttribute('data-case') === caseId); });
    document.querySelector('input[name="platform"][value="' + item.platform + '"]').checked = true;
    document.querySelector('input[name="contentType"][value="' + item.contentType + '"]').checked = true;
    $('target-audience').value = item.audience;
    $('campaign-theme').value = item.theme;
    $('content-goal').value = item.goal;
    $('content-constraints').value = item.constraints;
    toast('已载入' + item.name + '：' + item.description);
  }

  async function runDemo() {
    var button = document.querySelector('[data-action="run-demo"]');
    setBusy(button, true);
    try {
      applyCase('typical');
      $('brand-select').value = 'luxiangzhai';
      populateBrand(Data.brands.luxiangzhai);
      var ingestion = await ingestBrand();
      if (!ingestion) return;
      var generation = await generateContent();
      if (!generation) return;
      await submitReview('story', 'accept', { reviewer: '演示品牌确认人', note: '已完成事实核对、文化内涵确认和对外表达确认。', silent: true });
      toast('一键叙事演示完成：品牌与访谈入库、四类成果生成、文化校验和品牌方确认均已跑通。');
      $('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } finally {
      setBusy(button, false);
    }
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
    $('brand-select').value = 'luxiangzhai';
    populateBrand(Data.brands.luxiangzhai);
    applyCase('typical');
    $('brand-status').textContent = '待入库';
    $('brand-status').className = 'status-chip';
    $('job-status').textContent = '等待任务';
    $('job-status').className = 'status-chip';
    $('stream-window').innerHTML = '<span class="stream-placeholder">WebSocket 内容片段将在此实时出现…</span>';
    setProgress('brand', 0, '');
    renderAll();
    toast('本次演示状态已清空。');
  }

  function handleFile(file) {
    var reader = new FileReader();
    reader.onload = function () {
      var text = String(reader.result || '');
      if (/\.json$/i.test(file.name)) {
        try {
          var parsed = JSON.parse(text);
          if (Array.isArray(parsed)) text = parsed.map(function (item) { return typeof item === 'string' ? item : JSON.stringify(item); }).join('\n');
        } catch (error) { toast('JSON 格式不完整，已按纯文本导入。', 'warning'); }
      }
      if (/\.csv$/i.test(file.name)) {
        text = text.split(/\r?\n/).map(function (line) { return line.split(',').join('，'); }).join('\n');
      }
      var current = $('brand-materials').value.trim();
      $('brand-materials').value = current ? current + '\n' + text : text;
      $('file-import-status').textContent = '已导入 ' + file.name + '（' + Math.ceil(file.size / 1024) + ' KB）';
    };
    reader.onerror = function () { toast('文件读取失败，请确认编码为 UTF-8。', 'error'); };
    reader.readAsText(file, 'utf-8');
  }

  function bindEvents() {
    $('brand-form').addEventListener('submit', function (event) { event.preventDefault(); ingestBrand(); });
    $('content-form').addEventListener('submit', function (event) { event.preventDefault(); generateContent(); });
    $('brand-select').addEventListener('change', function () {
      if (this.value === 'new') {
        $('brand-name').value = '';
        $('brand-type').value = '';
        $('brand-tone').value = '真诚、清楚、不夸大';
        $('brand-materials').value = '';
        $('brand-name').focus();
        return;
      }
      populateBrand(Data.brands[this.value]);
    });
    $('file-import').addEventListener('change', function () { if (this.files[0]) handleFile(this.files[0]); });
    $('artifact-grid').addEventListener('click', function (event) {
      var button = event.target.closest('[data-review]');
      if (button) handleArtifactAction(button);
    });
    $('export-markdown').addEventListener('click', exportMarkdown);
    document.addEventListener('click', function (event) {
      var action = event.target.closest('[data-action]');
      if (!action) return;
      var name = action.getAttribute('data-action');
      if (name === 'run-demo') runDemo();
      if (name === 'toggle-nav') {
        var nav = $('site-nav');
        nav.classList.toggle('is-open');
        action.setAttribute('aria-expanded', String(nav.classList.contains('is-open')));
      }
      if (name === 'filter-pending') {
        state.pendingOnly = !state.pendingOnly;
        action.classList.toggle('is-active', state.pendingOnly);
        Renderer.renderFacts(state);
      }
      if (name === 'clear-demo') clearDemo();
    });
    document.addEventListener('click', function (event) {
      var caseButton = event.target.closest('[data-case]');
      if (caseButton) applyCase(caseButton.getAttribute('data-case'));
      if (event.target.closest('.site-nav a')) $('site-nav').classList.remove('is-open');
    });
    window.addEventListener('beforeunload', function () { gateway.close(); });
  }

  function init() {
    populateBrand(Data.brands.luxiangzhai);
    applyCase('typical');
    setProgress('brand', 0, '');
    renderAll();
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
    gateway.connect().then(function (connected) {
      if (connected) {
        gateway.send('state.sync', { client: 'github-pages', version: Config.appVersion });
        toast('WebSocket 实时网关已连接，将使用服务端生成链路。');
      } else {
        toast('未连接远程网关，已自动进入本地演示模式；全部核心叙事与品牌确认功能仍可使用。', 'warning');
      }
    });
    state.initialized = true;
    window.__LUYUN_APP__ = {
      state: state,
      ingestBrand: ingestBrand,
      generateContent: generateContent,
      runDemo: runDemo,
      submitReview: submitReview,
      applyCase: applyCase,
      clearDemo: clearDemo
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}(window, document));






