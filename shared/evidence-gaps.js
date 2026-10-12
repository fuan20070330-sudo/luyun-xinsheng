(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunEvidenceGaps = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var CRAFT_TERMS = ['选枣','选料','蒸制','炒馅','包制','烘烤','熬制','发酵','晾晒','炒制','成型','包装','和面','烘焙','手作'];
  function clean(value) { return String(value == null ? '' : value).replace(/^品牌档案（模拟）第\d+条：/, '').replace(/^受访记录（模拟）第\d+条：/, '').trim(); }
  function build(facts, brand, documents) {
    brand = brand || {}; facts = facts || []; documents = documents || []; var gaps = []; var seen = {};
    function add(gap) { var key = gap.type + '|' + (gap.factIds || []).join(','); if (seen[key]) return; seen[key] = true; gap.id = 'G' + String(gaps.length + 1).padStart(3, '0'); gaps.push(gap); }
    facts.forEach(function (fact) {
      if (!fact || !fact.text) return;
      if (fact.status === '待核实') add({ type: '事实来源缺失', severity: 'high', factIds: [fact.id], reason: '这条信息没有足够来源支持。', question: '“' + clean(fact.text).slice(0, 42) + '”来自哪份原始资料？请提供文件、页码或发布机构。', suggestedEvidence: '品牌档案、方志、证书、工商登记或正式发布材料' });
      if (fact.category === '历史' && /\b(?:18|19|20)\d{2}\b/.test(fact.text) && (fact.sourceAuthorityScore || 0) < 4) add({ type: '年份出处待补', severity: 'high', factIds: [fact.id], reason: '年份是高风险事实，必须有可核验来源。', question: '这个年份由哪份文件证明？证书、档案或登记资料的编号是什么？', suggestedEvidence: '历史档案、工商登记、方志、正式出版物' });
      if (fact.category === '荣誉' && fact.verificationStatus !== '已核验') add({ type: '荣誉核验', severity: 'high', factIds: [fact.id], reason: '称号和荣誉不能只凭品牌自述。', question: '这项荣誉由哪个机构授予，证书编号和有效期是什么？', suggestedEvidence: '授予文件、证书编号、官方名录' });
      if (fact.category === '工艺' && CRAFT_TERMS.filter(function (term) { return fact.text.indexOf(term) !== -1; }).length < 2) add({ type: '工艺动作不完整', severity: 'medium', factIds: [fact.id], reason: '工艺描述偏概括，难以形成可信内容。', question: '这道工序的具体步骤、工具、时长和判断标准分别是什么？', suggestedEvidence: '工序记录、生产流程、师傅访谈' });
      if ((fact.category === '人物' || fact.category === '访谈洞察') && !/[\u4e00-\u9fa5]{2,5}(?:表示|说|回忆|讲述|认为)/.test(fact.text)) add({ type: '人物身份待确认', severity: 'medium', factIds: [fact.id], reason: '缺少受访人或传承人的明确身份。', question: '受访人的姓名、身份、师承关系和可公开称呼是什么？', suggestedEvidence: '人物档案、采访记录、授权说明' });
      if (fact.category === '产品' && !/节令|家庭|早餐|下午|礼赠|分享|门店|旅行/.test(fact.text)) add({ type: '产品场景待补', severity: 'medium', factIds: [fact.id], reason: '产品事实缺少真实消费场景。', question: '这个产品通常在什么时间、什么场景、由谁和谁分享？', suggestedEvidence: '销售记录、消费者访谈、品牌方说明' });
      if ((fact.sourceAuthorityScore || 0) <= 1 && !documents.some(function (document) { return document.hash; })) add({ type: '资料指纹缺失', severity: 'medium', factIds: [fact.id], reason: '当前事实来自手工输入，没有可核验文件指纹。', question: '能否提供该事实对应的原始文件，以便记录 SHA-256 指纹？', suggestedEvidence: '原始文档、扫描件、录音或图片' });
    });
    return gaps;
  }
  function toMarkdown(gaps, brand) { return ['# ' + ((brand && brand.name) || '品牌') + '补证访谈提纲', ''].concat((gaps || []).map(function (gap) { return '- [ ] **' + gap.type + '**：' + gap.question + '  \n  建议材料：' + gap.suggestedEvidence + '  \n  关联事实：' + (gap.factIds || []).join('、'); })).join('\n'); }
  return { build: build, toMarkdown: toMarkdown };
}));