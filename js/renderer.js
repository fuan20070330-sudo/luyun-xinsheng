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
      list.innerHTML = '<span class="empty-glyph">档</span><p>' + (pendingOnly ? '当前没有待核实事实。' : '提交资料后，此处会生成带来源的事实卡片。') + '</p>';
      return;
    }
    list.className = 'facts-list';
    list.innerHTML = facts.map(function (fact) {
      var confidence = Math.round((fact.confidence || 0) * 100);
      var status = fact.status === '待核实' ? '待核实' : '已提取';
      return '<article class="fact-card" data-fact-id="' + escapeHtml(fact.id) + '" data-status="' + escapeHtml(fact.status === '待核实' ? 'pending' : 'verified') + '">' +
        '<div class="fact-meta"><span class="fact-category">' + escapeHtml(fact.category) + '</span><span class="fact-id">' + escapeHtml(fact.id) + '</span></div>' +
        '<p>' + escapeHtml(fact.text) + '</p>' +
        '<p class="fact-source">来源：' + escapeHtml(fact.source || '未找到来源') + '｜位置：' + escapeHtml(fact.sourceLocation || '待补充') + '｜来源权威度：' + escapeHtml(fact.sourceAuthority || '待评估') + '｜核验：' + escapeHtml(fact.verificationStatus || '待核验') + '｜提取置信度：' + confidence + '%｜证据：' + escapeHtml(fact.evidenceLevel || '待评估') + '｜状态：' + status + '</p>' +
        (fact.sourceHash ? '<p class="fact-fingerprint">文档：' + escapeHtml(fact.sourceDocumentName || '未命名来源') + '｜SHA-256：' + escapeHtml(fact.sourceHash) + '</p>' : '') +
        '<div class="confidence" title="置信度 ' + confidence + '%"><span>置信度 ' + confidence + '%</span><i style="--confidence:' + confidence + '%"></i></div>' +
        '<div class="fact-actions"><button type="button" data-fact-action="confirm" data-fact-id="' + escapeHtml(fact.id) + '">确认事实</button><button type="button" data-fact-action="pending" data-fact-id="' + escapeHtml(fact.id) + '">标记待核实</button></div>' +
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
        '<p class="risk-detail"><strong>规则版本：</strong>' + escapeHtml(risk.ruleVersion || 'luyun-risk-1.0') + '｜' + escapeHtml(risk.legalRef || '合规初筛') + '</p>' +
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
      var methods = (artifact.methods || []).length ? artifact.methods.map(function (method) { return '<span class="method-ref">' + escapeHtml(method) + '</span>'; }).join('') : '<span class="method-ref">方法待选择</span>';
      var highRisk = artifact.status === 'flagged';
      var quality = artifact.quality || null;
      var qualityMeta = quality ? '<span class="meta-chip quality-chip" data-level="' + escapeHtml(quality.level) + '">质量：' + quality.score + '/100 ' + escapeHtml(quality.level) + '</span>' : '';
      var fidelity = artifact.cultureFidelity || null;
      var fidelityMeta = fidelity ? '<span class="meta-chip fidelity-chip" data-level="' + escapeHtml(fidelity.level) + '">文化保真：' + fidelity.score + '/100 ' + escapeHtml(fidelity.level) + '</span>' : '';
      var fidelityNote = fidelity && fidelity.tabooFound && fidelity.tabooFound.length ? '<div class="quality-note">文化禁忌命中：' + escapeHtml(fidelity.tabooFound.join('、')) + '</div>' : '';
      var qualityIssues = quality && quality.issues && quality.issues.length ? '<div class="quality-note">待优化：' + escapeHtml(quality.issues.join('；')) + '</div>' : '';
      var variants = artifact.variants ? '<details class="variant-box"><summary>查看标题和开场候选</summary><p>标题候选：' + escapeHtml((artifact.variants.titles || []).join(' / ')) + '</p><p>开场候选：' + escapeHtml((artifact.variants.openings || []).join(' / ')) + '</p></details>' : '';
      return '<article class="artifact-card' + (highRisk ? ' is-high-risk' : '') + '" data-artifact="' + escapeHtml(artifact.id) + '">' +
        '<div class="artifact-head"><div><span class="artifact-label">' + escapeHtml(artifact.label || '内容成果') + '</span><h3>' + escapeHtml(artifact.title) + '</h3></div><span class="artifact-state" data-state="' + escapeHtml(artifact.status || 'draft') + '">' + artifactStatus(artifact.status) + '</span></div>' +
        '<div class="artifact-content">' + escapeHtml(artifact.content) + '</div>' +
        '<textarea class="artifact-textarea" data-editor="' + escapeHtml(artifact.id) + '" aria-label="编辑' + escapeHtml(artifact.title) + '">' + escapeHtml(artifact.content) + '</textarea>' +
        '<div class="artifact-meta"><span class="meta-chip">模型：' + escapeHtml((artifact.modelInfo && artifact.modelInfo.model) || 'local-rule-engine') + '</span><span class="meta-chip">提示词：' + escapeHtml((artifact.modelInfo && artifact.modelInfo.promptVersion) || 'brand-safe-content-v1.2') + '</span>' + qualityMeta + fidelityMeta + '</div>' + qualityIssues + fidelityNote + variants +
        '<div class="fact-refs" aria-label="事实引用">' + refs + '</div>' +
        '<div class="artifact-methods" aria-label="参考宣传方法">' + methods + '</div>' +
        '<input class="artifact-note" data-note="' + escapeHtml(artifact.id) + '" placeholder="审核备注（可选）">' +
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
        '<td>' + escapeHtml(task.brandName || '品牌') + '<small>' + escapeHtml(task.mode || '本地处理') + '</small></td>' +
        '<td>' + escapeHtml(task.model || 'local-rule-engine') + '<small>' + escapeHtml(task.promptVersion || '') + '</small></td>' +
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

  function renderRoleReviews(state) {
    var list = byId('role-review-list');
    if (!list) return;
    var reviews = state.roleReviews || [];
    byId('role-review-count').textContent = reviews.length + ' 项';
    if (!reviews.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-glyph">审</span><p>生成后显示档案、编辑、平台、文化和合规角色的审查结果。</p></div>';
      return;
    }
    list.innerHTML = reviews.map(function (review) {
      return '<article class="role-card" data-status="' + escapeHtml(review.status) + '"><strong>' + escapeHtml(review.title) + '</strong><small>' + escapeHtml(review.summary) + '</small><small>依据：' + escapeHtml(review.evidence || '待补充') + '</small><span>' + escapeHtml(review.action) + '</span></article>';
    }).join('');
  }

  function renderPublishRecords(state) {
    var list = byId('publish-records');
    if (!list) return;
    var records = state.publishRecords || [];
    byId('publish-count').textContent = records.length + ' 条';
    if (!records.length) {
      list.innerHTML = '<div class="empty-state"><span class="empty-glyph">效</span><p>发布后记录平台、链接和效果数据，用于下一轮内容优化。</p></div>';
      return;
    }
    list.innerHTML = records.slice(0, 30).map(function (record) {
      var engagement = record.impressions ? Math.round(((record.likes + record.saves + record.conversions) / record.impressions) * 1000) / 10 + '%' : '--';
      return '<article class="publish-record"><div><strong>' + escapeHtml(record.platform) + '</strong><small>' + escapeHtml(record.date || '未填写日期') + '</small></div><div><strong>' + escapeHtml(record.status) + '</strong><small>状态</small></div><div><strong>' + (record.impressions || 0) + '</strong><small>曝光</small></div><div><strong>' + (record.likes || 0) + ' / ' + (record.saves || 0) + '</strong><small>点赞 / 收藏</small></div><div><strong>' + engagement + '</strong><small>综合互动</small></div><div><strong>' + escapeHtml(record.note || '无备注') + '</strong><small>' + (record.url ? '<a href="' + escapeHtml(record.url) + '" target="_blank" rel="noopener">查看链接/位置</a>' : '未填写链接或位置') + '</small></div></article>';
    }).join('');
  }
  function renderMemoryGraph(state) {
    var root = byId('memory-graph');
    if (!root) return;
    var graph = state.memoryGraph || { nodes: [], edges: [], stats: {} };
    if (byId('memory-graph-count')) byId('memory-graph-count').textContent = (graph.stats.nodes || 0) + ' 节点 / ' + (graph.stats.edges || 0) + ' 关系';
    if (!graph.nodes || !graph.nodes.length) { root.innerHTML = '<div class="empty-state"><span class="empty-glyph">图</span><p>提取事实后生成品牌关系图谱。</p></div>'; return; }
    var center = graph.nodes.filter(function (node) { return node.type === 'brand'; })[0] || graph.nodes[0];
    var others = graph.nodes.filter(function (node) { return node.id !== center.id; }).slice(0, 18);
    var positions = {}; positions[center.id] = { x: 360, y: 190 };
    others.forEach(function (node, index) { var angle = (-Math.PI / 2) + (index * 2 * Math.PI / Math.max(1, others.length)); positions[node.id] = { x: 360 + Math.cos(angle) * 245, y: 190 + Math.sin(angle) * 135 }; });
    var lines = (graph.edges || []).filter(function (edge) { return positions[edge.source] && positions[edge.target]; }).map(function (edge) { var a = positions[edge.source], b = positions[edge.target]; return '<line class="graph-edge type-' + escapeHtml((graph.nodes.filter(function (n) { return n.id === edge.target; })[0] || {}).type || 'edge') + '" x1="' + a.x + '" y1="' + a.y + '" x2="' + b.x + '" y2="' + b.y + '"></line>'; }).join('');
    var nodes = [center].concat(others).map(function (node) { var p = positions[node.id]; var label = String(node.label || '').length > 9 ? String(node.label).slice(0, 9) + '…' : node.label; return '<g class="graph-node type-' + escapeHtml(node.type) + '" transform="translate(' + p.x + ',' + p.y + ')"><circle r="' + (node.type === 'brand' ? 42 : 25) + '"></circle><text text-anchor="middle" dy="4">' + escapeHtml(label) + '</text><title>' + escapeHtml((node.detail || '') + '\n' + (node.evidence || '')) + '</title></g>'; }).join('');
    root.innerHTML = '<svg class="memory-graph-svg" viewBox="0 0 720 380" role="img" aria-label="品牌记忆图谱">' + lines + nodes + '</svg><div class="graph-legend"><span class="type-brand">品牌</span><span class="type-time">时间</span><span class="type-craft">工艺</span><span class="type-product">产品</span><span class="type-honor">荣誉</span><span class="type-person">人物</span><span class="type-idea">理念</span><span class="type-evidence">证据</span></div>';
  }

  function renderCultureDna(state) {
    var root = byId('culture-dna');
    if (!root) return;
    var dna = state.cultureDna;
    if (!dna) { root.innerHTML = '<div class="empty-state"><span class="empty-glyph">因</span><p>提取资料后生成文化 DNA。</p></div>'; return; }
    if (byId('culture-dna-count')) byId('culture-dna-count').textContent = (dna.protectedTerms || []).length + ' 项保护';
    root.innerHTML = '<div class="dna-section"><strong>保护词</strong><div class="dna-chips">' + (dna.protectedTerms || []).map(function (term) { return '<span>' + escapeHtml(term) + '</span>'; }).join('') + '</div></div>' + '<div class="dna-section"><strong>文化禁忌</strong><div class="dna-chips is-taboo">' + (dna.tabooTerms || []).slice(0, 12).map(function (term) { return '<span>' + escapeHtml(term) + '</span>'; }).join('') + '</div></div>' + '<div class="dna-section"><strong>不可改写事实</strong>' + ((dna.immutableClaims || []).slice(0, 5).map(function (item) { return '<p><b>' + escapeHtml(item.id) + '</b>｜' + escapeHtml(item.text) + '</p>'; }).join('') || '<p>暂无</p>') + '</div>' + '<ul class="dna-guidelines">' + (dna.guidelines || []).map(function (item) { return '<li>' + escapeHtml(item) + '</li>'; }).join('') + '</ul>';
  }

  function renderEvidenceGaps(state) {
    var root = byId('evidence-gaps');
    if (!root) return;
    var gaps = state.evidenceGaps || [];
    if (byId('evidence-gap-count')) byId('evidence-gap-count').textContent = gaps.length + ' 个缺口';
    if (!gaps.length) { root.innerHTML = '<div class="empty-state"><span class="empty-glyph">问</span><p>当前没有发现明显证据缺口。</p></div>'; return; }
    root.innerHTML = gaps.slice(0, 12).map(function (gap) { return '<article class="gap-card" data-level="' + escapeHtml(gap.severity) + '"><div><strong>' + escapeHtml(gap.id) + '｜' + escapeHtml(gap.type) + '</strong><small>' + escapeHtml((gap.factIds || []).join('、')) + '</small></div><p>' + escapeHtml(gap.question) + '</p><small>建议材料：' + escapeHtml(gap.suggestedEvidence) + '</small></article>'; }).join('');
  }

  function renderProof(state) {
    var root = byId('proof-engine');
    if (!root) return;
    var proof = state.proof;
    var statusEl = byId('proof-status');
    if (!proof) { if (statusEl) statusEl.textContent = '未编译'; root.innerHTML = '<div class="empty-state"><span class="empty-glyph">证</span><p>提取事实后建立证明义务。</p></div>'; return; }
    if (statusEl) statusEl.textContent = proof.status + '｜证明分 ' + proof.proofScore;
    var claims = (proof.claims || []).slice(0, 18).map(function (claim) { return '<article class="claim-card" data-status="' + escapeHtml(claim.status) + '"><div><strong>' + escapeHtml(claim.id) + '｜' + escapeHtml(claim.type) + '</strong><span>' + escapeHtml(claim.status) + '</span></div><p>' + escapeHtml(claim.value) + '</p><small>证明义务：' + escapeHtml(claim.requiredEvidence) + '</small></article>'; }).join('');
    var validation = proof.validation ? '<div class="proof-validation"><strong>正文编译结果</strong>' + proof.validation.results.map(function (item) { return '<p>' + escapeHtml(item.title) + '：' + escapeHtml(item.status) + '｜' + item.score + ' 分｜引用 ' + item.citations + ' 处' + (item.blockedHits.length ? '｜阻止词：' + escapeHtml(item.blockedHits.join('、')) : '') + '</p>'; }).join('') + '</div>' : '';
    root.innerHTML = '<div class="proof-stats"><span class="proof-stat proven"><b>' + proof.stats.proven + '</b> 已证明</span><span class="proof-stat pending"><b>' + proof.stats.pending + '</b> 待证明</span><span class="proof-stat blocked"><b>' + proof.stats.blocked + '</b> 已阻止</span></div>' + validation + '<div class="claim-list">' + claims + '</div>';
  }

  function renderPassport(state) {
    var root = byId('content-passport');
    if (!root) return;
    var passport = state.passport;
    var button = byId('copy-passport');
    if (button) button.disabled = !passport;
    if (byId('passport-id')) byId('passport-id').textContent = passport ? passport.id : '未生成';
    if (!passport) { root.innerHTML = '<div class="empty-state"><span class="empty-glyph">证</span><p>生成内容后生成可追溯内容护照。</p></div>'; return; }
    var fields = [['护照编号', passport.id], ['品牌', passport.brandName], ['平台', passport.platformName], ['模型', passport.model], ['提示词版本', passport.promptVersion], ['事实引用', (passport.facts || []).join('、')], ['来源文件', (passport.sourceDocuments || []).length + ' 份'], ['保护词', (passport.protectedTerms || []).join('、')], ['风险', passport.riskCount + ' 条 / 高 ' + passport.highRiskCount + ' 条'], ['审核次数', String(passport.reviewCount || 0)], ['内容哈希', passport.contentHash], ['状态', passport.status]];
    root.innerHTML = '<div class="passport-grid">' + fields.map(function (item) { return '<div><small>' + escapeHtml(item[0]) + '</small><strong>' + escapeHtml(item[1] || '--') + '</strong></div>'; }).join('') + '</div>' + '<div class="artifact-hashes"><strong>成果指纹</strong>' + (passport.artifactHashes || []).map(function (item) { return '<p>' + escapeHtml(item.title) + '：' + escapeHtml(item.hash) + '｜' + escapeHtml(item.status) + '</p>'; }).join('') + '</div>';
  }

  function renderDocuments(state) {
    var list = byId('source-documents');
    if (!list) return;
    var documents = state.documents || [];
    if (!documents.length) {
      list.className = 'source-documents empty-state';
      list.innerHTML = '<span class="empty-glyph">源</span><p>导入文件后会记录文件名、大小和 SHA-256 指纹。</p>';
      return;
    }
    list.className = 'source-documents';
    list.innerHTML = documents.slice(0, 20).map(function (document) {
      return '<article class="document-item"><strong>' + escapeHtml(document.name || '未命名资料') + '</strong><small>' + escapeHtml(document.status || '已导入') + '｜来源类型：' + escapeHtml(document.authority || 'user') + '｜' + Math.ceil((document.size || 0) / 1024) + ' KB</small><code>' + escapeHtml(document.hash ? document.hash.slice(0, 24) + '…' : '无指纹') + '</code><span>' + escapeHtml(formatTime(document.importedAt)) + '</span></article>';
    }).join('');
  }

  function renderHistory(state) {
    var list = byId('history-list');
    if (!list) return;
    var history = (state.history || []).filter(function (record) {
      var query = state.historyQuery || '';
      var status = state.historyStatus || '';
      var haystack = [record.brand && record.brand.name, record.theme, record.platformName, record.contentTypeName].join(' ').toLowerCase();
      return (!query || haystack.indexOf(query) !== -1) && (!status || record.status === status);
    });
    if (byId('history-count')) byId('history-count').textContent = history.length + ' 条';
    if (byId('history-account')) byId('history-account').textContent = '账号：' + (state.accountName || state.user || '--');
    if (!history.length) {
      list.className = 'history-list empty-state';
      list.innerHTML = '<span class="empty-glyph">史</span><p>当前账号暂无生成历史。生成第一条内容后会自动保存在这里。</p>';
      return;
    }
    list.className = 'history-list';
    list.innerHTML = history.map(function (record) {
      var risks = record.risks || [];
      var highRisk = risks.filter(function (risk) { return risk.level === 'high'; }).length;
      var methods = record.promotionMethods || [];
      var canView = Array.isArray(record.artifacts) && record.artifacts.length > 0;
      var brandName = (record.brand && record.brand.name) || '未命名品牌';
      return '<article class="history-item" data-history-id="' + escapeHtml(record.id) + '">' +
        '<div class="history-item-head"><div><strong>' + escapeHtml(brandName) + '</strong><small>' + escapeHtml(formatTime(record.createdAt)) + '</small></div><span class="status-chip" data-status="' + escapeHtml(highRisk ? 'warning' : 'ok') + '">' + escapeHtml(record.status || (highRisk ? '待修改' : '待确认')) + '</span></div>' +
        '<h3>' + escapeHtml(record.theme || '未填写主题') + '</h3>' +
        '<p>' + escapeHtml(record.platformName || '未指定平台') + '｜' + escapeHtml(record.contentTypeName || '内容方案') + '｜' + escapeHtml(record.mode || '本地处理') + '</p>' +
        '<div class="history-meta"><span>护照：' + escapeHtml(record.passport && record.passport.id || '--') + '</span><span>版本：' + ((record.versions || []).length || 1) + ' 个</span><span>模型：' + escapeHtml((record.modelInfo && record.modelInfo.model) || 'local-rule-engine') + '</span><span>提示词：' + escapeHtml((record.modelInfo && record.modelInfo.promptVersion) || '') + '</span><span>风险：' + risks.length + ' 条 / 高 ' + highRisk + ' 条</span><span>审核：' + (record.reviewCount || 0) + ' 次</span><span>成果：' + ((record.artifacts || []).length || 0) + ' 份</span></div>' +
        '<p class="history-methods">宣传方法：' + escapeHtml(methods.length ? methods.join('、') : '未选择') + '</p>' +
        ((record.versions || []).length > 1 ? '<details class="history-version-panel"><summary>版本历史（' + record.versions.length + '）</summary>' + record.versions.map(function (version) { return '<div class="history-version-row"><span>v' + escapeHtml(version.version) + '｜' + escapeHtml(formatTime(version.createdAt)) + '｜' + escapeHtml(version.note || '版本快照') + '</span><button type="button" class="text-button" data-history-action="rollback" data-history-id="' + escapeHtml(record.id) + '" data-version="' + escapeHtml(version.version) + '">恢复此版本</button></div>'; }).join('') + '</details>' : '') +
        '<div class="history-item-actions"><button class="button button-outline" type="button" data-history-action="view" data-history-id="' + escapeHtml(record.id) + '"' + (canView ? '' : ' disabled') + '>查看生成内容</button><button class="button button-ghost" type="button" data-history-action="delete" data-history-id="' + escapeHtml(record.id) + '">删除记录</button></div>' +
        '</article>';
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
    byId('mode-label').textContent = mode || '本地处理';
    if (protocol) byId('connection-protocol').textContent = protocol;
    byId('protocol-mode').textContent = status === 'connected' ? 'WebSocket 实时网关' : '本地处理模式';
    if (byId('runtime-mode')) byId('runtime-mode').textContent = status === 'connected' ? '在线网关 / 实时片段' : '本地确定性引擎 / 自动回退';
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
    renderRoleReviews: renderRoleReviews,
    renderPublishRecords: renderPublishRecords,
    renderMemoryGraph: renderMemoryGraph,
    renderCultureDna: renderCultureDna,
    renderEvidenceGaps: renderEvidenceGaps,
    renderProof: renderProof,
    renderPassport: renderPassport,
    renderDocuments: renderDocuments,
    renderHistory: renderHistory,
    renderMetrics: renderMetrics,
    updatePipeline: updatePipeline,
    setConnection: setConnection
  };
}(window));









