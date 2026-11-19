(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunEvidenceGate = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
  function isVerified(fact) {
    return fact && (fact.status === '已确认' || fact.verificationStatus === '品牌方已确认' || fact.verificationStatus === '已核验');
  }
  function criticalFact(fact) {
    return fact && ['历史', '工艺', '荣誉', '人物', '产品', '品牌理念', '访谈洞察'].indexOf(fact.category) !== -1 && !/^暂未从资料中提取/.test(fact.text || '');
  }

  function build(input) {
    input = input || {};
    var facts = input.facts || [];
    var risks = input.risks || [];
    var proof = input.proof || null;
    var artifacts = input.artifacts || [];
    var rules = input.brandRules || {};
    var blockers = [];
    var warnings = [];
    var criticalFacts = facts.filter(criticalFact);
    criticalFacts.forEach(function (fact) {
      if (!fact.sourceExcerpt || !fact.sourceDocumentName && !fact.source) blockers.push({ code: 'SOURCE_MISSING', factId: fact.id, message: fact.id + ' 没有可定位的原文来源。' });
      if (!isVerified(fact)) blockers.push({ code: 'FACT_UNCONFIRMED', factId: fact.id, message: fact.id + ' 尚未由品牌方确认或完成权威核验。' });
      if (fact.sourceAuthorityScore && fact.sourceAuthorityScore < 3) warnings.push({ code: 'SOURCE_WEAK', factId: fact.id, message: fact.id + ' 来源权威度较弱，建议补充正式文件。' });
    });
    risks.filter(function (risk) { return risk.level === 'high'; }).forEach(function (risk) {
      blockers.push({ code: 'HIGH_RISK', message: (risk.type || '高风险') + '：' + (risk.term || '') + ' 尚未处理。' });
    });
    if (proof && proof.stats && Number(proof.stats.blocked) > 0) blockers.push({ code: 'PROOF_BLOCKED', message: '内容证明中有 ' + proof.stats.blocked + ' 项已阻止声明。' });
    var existingFacts = {};
    facts.forEach(function (fact) { existingFacts[fact.id] = true; });
    var brokenRefs = [];
    artifacts.forEach(function (artifact) {
      var refs = String((artifact && (artifact.content || artifact)) || '').match(/\[F\d{3,}\]/g) || [];
      refs.forEach(function (ref) { var id = ref.replace(/[\[\]]/g, ''); if (!existingFacts[id]) brokenRefs.push(id); });
    });
    if (brokenRefs.length) blockers.push({ code: 'BROKEN_CITATIONS', message: '存在无法解析的事实引用：' + unique(brokenRefs).join('、') });
    var banned = (rules.bannedTerms || []).filter(Boolean);
    var fullText = artifacts.map(function (artifact) { return artifact && (artifact.content || artifact) || ''; }).join('\n');
    banned.forEach(function (term) { if (fullText.indexOf(term) !== -1) blockers.push({ code: 'BANNED_TERM', message: '命中品牌禁用表达：' + term }); });
    if ((rules.preferredTerms || []).length && fullText) {
      var missing = rules.preferredTerms.filter(function (term) { return term && fullText.indexOf(term) === -1; });
      if (missing.length) warnings.push({ code: 'PREFERRED_TERM_MISSING', message: '尚未使用品牌标准表达：' + missing.join('、') });
    }
    if (input.verificationConfigured === false) warnings.push({ code: 'OFFICIAL_SOURCE_NOT_CONFIGURED', message: '官方名录核验接口尚未配置，当前只能使用品牌确认与公开来源二级核验。' });
    blockers = blockers.filter(function (item, index, list) { return list.findIndex(function (other) { return other.code + '|' + (other.factId || '') + '|' + other.message === item.code + '|' + (item.factId || '') + '|' + item.message; }) === index; });
    warnings = warnings.filter(function (item, index, list) { return list.findIndex(function (other) { return other.code + '|' + (other.factId || '') + '|' + other.message === item.code + '|' + (item.factId || '') + '|' + item.message; }) === index; });
    return {
      status: blockers.length ? 'blocked' : warnings.length ? 'warning' : 'ready',
      blockers: blockers,
      warnings: warnings,
      counts: { criticalFacts: criticalFacts.length, confirmedFacts: criticalFacts.filter(isVerified).length, highRisks: risks.filter(function (risk) { return risk.level === 'high'; }).length },
      checkedAt: new Date().toISOString()
    };
  }

  return { build: build, isVerified: isVerified };
}));
