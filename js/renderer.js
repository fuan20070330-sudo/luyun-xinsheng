(function (root) {
  'use strict';

  function byId(id) { return document.getElementById(id); }
  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }
  function safeJson(value) { return escapeHtml(JSON.stringify(value || {})); }
  function formatTime(value) {
    var date = value ? new Date(value) : new Date();
    return date.toLocaleString('zh-CN', { hour12: false, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function levelText(level) { return { high: '高风险', medium: '中风险', low: '待关注' }[level] || level; }

  function renderFacts(state) {
    var list = byId('facts-list');
    var summary = byId('facts-summary');
    var pendingOnly = state.pendingOnly;
    var facts = (state.facts || []).filter(function (fact) { return !pendingOnly || fact.status === '待核实'; });
    summary.textContent = state.facts.length ? state.facts.length + ' 条 / ' + state.facts.filter(function (fact) { return fact.status === '待核实'; }).length + ' 条待核实' : '尚未提取';
    if (!facts.length) {
      list.className = 'facts-list empty-state';
      list.innerHTML = '<span class="empty-glyph">档</span><p>' + (pendingOnly ? '当前没有待核实事实。' : '载入演示或提交资料后，此处会生成带来源的事实卡片。') + '</p>';
      return;
    }
    list.className = 'facts-list';
    list.innerHTML = facts.map(function (fact) {
      var confidence = Math.round((fact.confidence || 0) * 100);
      return '<article class="fact-card" data-status="' + escapeHtml(fact.status === '待核实' ? 'pending' : 'verified') + '">' +
        '<div class="fact-meta"><span class="fact-category">' + escapeHtml(fact.category) + '</span><span class="fact-id">' + escapeHtml(fact.id) + '</span></div>' +
        '<p>' + escapeHtml(fact.text) + '</p>' +
        '<p class="fact-source">来源：' + escapeHtml(fact.source || '未找到来源') + '</p>' +
        '<div class="confidence" title="置信度 ' + confidence + '%"><span>置信度 ' + confidence + '%</span><i style="--confidence:' + confidence + '%"></i></div>' +
        '</article>';
    }).join('');
  }

  function renderRisks(state) {
    var list = byId('risk-list');
    var risks = state.risks || [];
    var counts = { high: 0, medium: 0, low: 0 };
    risks.forEach(function (risk) { counts[risk.level] = (counts[risk.level] || 0) + 1; });
    var summary = byId('risk-summary');
    summary.querySelector('.risk-high b').textContent = counts.high;
    summary.querySelector('.risk-medium b').textContent = counts.medium;
    summary.querySelector('.risk-low b').textContent = counts.low;
    if (!risks.length) {
      list.className = 'risk-list';
      list.innerHTML = '<div class="empty-state panel"><span class="empty-glyph">检</span><p>暂无风险扫描结果。生成内容后会自动执行医疗功效、绝对化宣传、虚假荣誉、无依据年份和工艺描述校验。</p></div>';
      return;
    }
    list.className = 'risk-list';
    list.innerHTML = risks.map(function (risk) {
      var refs = (risk.factRefs || []).length ? '｜关联事实 ' + risk.factRefs.join('、') : '｜无已核实事实关联';
      return '<article class="risk-card" data-level="' + escapeHtml(risk.level) + '" data-risk-id="' + escapeHtml(risk.id) + '">' +
        '<div class="risk-card-head"><span class="risk-level">' + levelText(risk.level) + '</span><h3>' + escapeHtml(risk.type) + '：' + escapeHtml(risk.term) + '</h3><span class="risk-location">' + escapeHtml(risk.location || '输入内容') + '</span></div>' +
        '<blockquote>“' + escapeHtml(risk.quote || risk.term) + '”</blockquote>' +
        '<p class="risk-detail"><strong>判断依据：</strong>' + escapeHtml(risk.reason) + '</p>' +
        '<p class="risk-detail"><strong>事实关联：</strong>' + escapeHtml(refs) + '</p>' +
        '<div class="risk-suggestion"><strong>修改建议：</strong>' + escapeHtml(risk.suggestion) + '</div>' +
        '</article>';
    }).join('');
  }

  function artifactStatus(status) {
    return { draft: '待品牌确认', accepted: '品牌方已确认', flagged: '待修改', edited: '品牌方已修改', rejected: '已驳回' }[status] || '待品牌确认';
  }

  function renderArtifacts(state) {
    var grid = byId('artifact-grid');
    var artifacts = state.artifacts || [];
    var status = byId('result-status');
    byId('export-markdown').disabled = !artifacts.length;
    status.textContent = artifacts.length ? artifacts.length + ' 项成果已生成' : '尚无生成结果';
    if (!artifacts.length) {
      grid.innerHTML = [
        '<article class="artifact-card empty-artifact"><span>事</span><h3>品牌故事</h3><p>基于品牌历史与受访内容形成可追溯叙事。</p></article>',
        '<article class="artifact-card empty-artifact"><span>历</span><h3>内容日历</h3><p>按节点、主题与平台规划持续内容。</p></article>',
        '<article class="artifact-card empty-artifact"><span>传</span><h3>多平台文案</h3><p>适配小红书、抖音和微信公众号表达。</p></article>',
        '<article class="artifact-card empty-artifact"><span>新</span><h3>年轻化表达方案</h3><p>在保持文化内涵的前提下提出年轻受众可理解的表达。</p></article>'
      ].join('');
      return;
    }
    grid.innerHTML = artifacts.map(function (artifact) {
      var refs = (artifact.facts || []).length ? artifact.facts.map(function (id) { return '<span class="fact-ref">' + escapeHtml(id) + '</span>'; }).join('') : '<span class="fact-ref">待补充</span>';
      var highRisk = artifact.status === 'flagged';
      return '<article class="artifact-card' + (highRisk ? ' is-high-risk' : '') + '" data-artifact="' + escapeHtml(artifact.id) + '">' +
        '<div class="artifact-head"><div><span class="artifact-label">' + escapeHtml(artifact.label || '内容成果') + '</span><h3>' + escapeHtml(artifact.title) + '</h3></div><span class="artifact-state" data-state="' + escapeHtml(artifact.status || 'draft') + '">' + artifactStatus(artifact.status) + '</span></div>' +
        '<div class="artifact-content">' + escapeHtml(artifact.content) + '</div>' +
        '<textarea class="artifact-textarea" data-editor="' + escapeHtml(artifact.id) + '" aria-label="编辑' + escapeHtml(artifact.title) + '">' + escapeHtml(artifact.content) + '</textarea>' +
        '<div class="artifact-meta"><span class="meta-chip">模型：' + escapeHtml((artifact.modelInfo && artifact.modelInfo.model) || 'local-deterministic-demo') + '</span><span class="meta-chip">提示词：' + escapeHtml((artifact.modelInfo && artifact.modelInfo.promptVersion) || 'brand-safe-content-v1.2') + '</span></div>' +
        '<div class="fact-refs" aria-label="事实引用">' + refs + '</div>' +
        '<div class="artifact-actions"><button type="button" data-review="accept" data-artifact="' + escapeHtml(artifact.id) + '">品牌确认</button><button type="button" class="edit-action" data-review="edit" data-artifact="' + escapeHtml(artifact.id) + '">品牌方修改</button><button type="button" class="save-action" data-review="save" data-artifact="' + escapeHtml(artifact.id) + '">保存确认稿</button><button type="button" data-review="flag" data-artifact="' + escapeHtml(artifact.id) + '">退回修改</button><button type="button" data-review="copy" data-artifact="' + escapeHtml(artifact.id) + '">复制</button></div>' +
        '</article>';
    }).join('');
  }

  function renderTasks(state) {
    var tbody = byId('task-table');
    var tasks = state.tasks || [];
    byId('task-count').textContent = tasks.length + ' 条';
    if (!tasks.length) {
      tbody.innerHTML = '<tr><td colspan="5" class="table-empty">暂无任务记录</td></tr>';
      return;
    }
    tbody.innerHTML = tasks.slice(0, 8).map(function (task) {
      return '<tr><td>' + escapeHtml(formatTime(task.createdAt)) + '<small>' + escapeHtml(task.platformName || '') + '</small></td>' +
        '<td>' + escapeHtml(task.brandName || '品牌') + '<small>' + escapeHtml(task.mode || '本地演示') + '</small></td>' +
        '<td>' + escapeHtml(task.model || 'local-deterministic-demo') + '<small>' + escapeHtml(task.promptVersion || '') + '</small></td>' +
        '<td><span class="risk-count ' + ((task.highRisk || 0) ? 'risk-high' : 'risk-low') + '"><b>' + (task.riskCount || 0) + '</b> 条<small>高 ' + (task.highRisk || 0) + '</small></span></td>' +
        '<td>' + (task.reviewCount || 0) + ' 次<small>' + escapeHtml(task.status || '待品牌确认') + '</small></td></tr>';
    }).join('');
  }

  function renderReviews(state) {
    var timeline = byId('audit-timeline');
    var reviews = state.reviews || [];
    byId('review-count').textContent = reviews.length + ' 次';
    if (!reviews.length) {
      timeline.innerHTML = '<div class="empty-state"><span class="empty-glyph">审</span><p>品牌方确认、修改或退回内容后，将在此记录确认人、动作、前后内容和时间。</p></div>';
      return;
    }
    timeline.innerHTML = reviews.slice(0, 20).map(function (review) {
      var action = { accept: '品牌方确认', edit: '保存品牌方修改', flag: '退回修改', reject: '驳回内容' }[review.action] || review.action;
      var before = review.before ? '<div><strong>修改前：</strong>' + escapeHtml(review.before).slice(0, 240) + '</div>' : '';
      var after = review.after ? '<div><strong>修改后：</strong>' + escapeHtml(review.after).slice(0, 240) + '</div>' : '';
      return '<article class="audit-item"><div class="audit-item-head"><strong>' + escapeHtml(review.reviewer || '品牌确认人') + '</strong><span>' + escapeHtml(formatTime(review.createdAt)) + '</span></div>' +
        '<p>动作：' + escapeHtml(action) + '｜目标：' + escapeHtml(review.artifactId || '') + '｜任务：' + escapeHtml(review.jobId || '') + '</p>' +
        '<p>' + escapeHtml(review.note || '已完成品牌确认动作，结果已归档。') + '</p>' +
        (before || after ? '<div class="audit-diff">' + before + after + '</div>' : '') + '</article>';
    }).join('');
  }

  function renderMetrics(state) {
    var metrics = state.metrics || {};
    byId('metric-facts').textContent = metrics.facts || (state.facts || []).filter(function (fact) { return fact.status !== '待核实'; }).length;
    byId('metric-jobs').textContent = metrics.jobs || (state.tasks || []).length;
    byId('metric-reviews').textContent = metrics.reviews || (state.reviews || []).length;
    byId('fact-id-range').textContent = (state.facts || []).length ? 'F001–F' + String(state.facts.length).padStart(3, '0') : '--';
  }

  function updatePipeline(stage) {
    var order = ['ingest', 'retrieve', 'generate', 'verify', 'review'];
    var index = order.indexOf(stage);
    document.querySelectorAll('[data-pipeline]').forEach(function (item) {
      var itemIndex = order.indexOf(item.getAttribute('data-pipeline'));
      item.classList.toggle('is-active', itemIndex === index);
      item.classList.toggle('is-done', itemIndex < index);
    });
  }

  function setConnection(status, label, mode, protocol) {
    var pill = byId('connection-pill');
    pill.setAttribute('data-state', status);
    byId('connection-label').textContent = label;
    byId('mode-label').textContent = mode || '本地演示';
    if (protocol) byId('connection-protocol').textContent = protocol;
    byId('protocol-mode').textContent = status === 'connected' ? 'WebSocket 实时网关' : '本地演示模式';
    byId('runtime-mode').textContent = status === 'connected' ? '在线网关 / 实时片段' : '本地确定性引擎 / 自动回退';
  }

  root.LuyunRenderer = {
    byId: byId,
    escapeHtml: escapeHtml,
    formatTime: formatTime,
    renderFacts: renderFacts,
    renderRisks: renderRisks,
    renderArtifacts: renderArtifacts,
    renderTasks: renderTasks,
    renderReviews: renderReviews,
    renderMetrics: renderMetrics,
    updatePipeline: updatePipeline,
    setConnection: setConnection
  };
}(window));



