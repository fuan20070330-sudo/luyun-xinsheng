(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunPassport = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function fnv1a(value) { var hash = 0x811c9dc5; var text = String(value || ''); for (var i = 0; i < text.length; i += 1) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 0x01000193); } return (hash >>> 0).toString(16).padStart(8, '0'); }
  function create(input) {
    input = input || {}; var now = input.createdAt || new Date().toISOString(); var date = now.slice(0, 10).replace(/-/g, ''); var id = 'LYXS-' + date + '-' + fnv1a((input.jobId || '') + (input.brand && input.brand.name || '') + JSON.stringify(input.artifacts || [])).slice(0, 8).toUpperCase();
    var referenced = Array.from(new Set((input.facts || []).filter(function (fact) { return fact.status !== '待核实'; }).map(function (fact) { return fact.id; })));
    var risks = input.risks || []; var artifacts = input.artifacts || []; var documents = input.documents || []; var reviews = input.reviews || [];
    return {
      id: id, jobId: input.jobId || '', brandName: input.brand && input.brand.name || '', platformName: input.platformName || '', contentTypeName: input.contentTypeName || '',
      model: input.modelInfo && input.modelInfo.model || 'local-rule-engine', promptVersion: input.modelInfo && input.modelInfo.promptVersion || '', transportMode: input.transportMode || '本地处理模式',
      facts: referenced, factCount: referenced.length, sourceDocuments: documents.map(function (item) { return { name: item.name, hash: item.hash, authority: item.authority }; }),
      protectedTerms: input.cultureDna && input.cultureDna.protectedTerms || [], tabooTerms: input.cultureDna && input.cultureDna.tabooTerms || [],
      proofId: input.proof && input.proof.claims && input.proof.claims[0] ? 'PROOF-' + fnv1a(JSON.stringify(input.proof.claims)).slice(0, 8).toUpperCase() : '',
      proofStatus: input.proof && input.proof.validation && input.proof.validation.status || (input.proof && input.proof.status) || '未编译',
      proofScore: input.proof && input.proof.proofScore || 0,
      blockedClaims: input.proof && input.proof.stats && input.proof.stats.blocked || 0,
      riskCount: risks.length, highRiskCount: risks.filter(function (risk) { return risk.level === 'high'; }).length, reviewCount: reviews.filter(function (review) { return review.jobId === input.jobId; }).length,
      artifactHashes: artifacts.map(function (artifact) { return { id: artifact.id, title: artifact.title, hash: fnv1a(artifact.content || ''), status: artifact.status }; }), status: risks.some(function (risk) { return risk.level === 'high'; }) ? '待修改' : '待发布确认', createdAt: now, contentHash: fnv1a(JSON.stringify(artifacts))
    };
  }
  function toMarkdown(passport) {
    if (!passport) return '';
    var lines = ['## 内容护照','', '- 护照编号：' + passport.id, '- 品牌：' + passport.brandName, '- 平台：' + passport.platformName, '- 内容类型：' + passport.contentTypeName, '- 模型：' + passport.model, '- 提示词版本：' + passport.promptVersion, '- 运行模式：' + passport.transportMode, '- 事实引用：' + (passport.facts || []).join('、'), '- 来源文件：' + (passport.sourceDocuments || []).length + ' 份', '- 保护词：' + (passport.protectedTerms || []).join('、'), '- 风险：' + passport.riskCount + ' 条，其中高风险 ' + passport.highRiskCount + ' 条', '- 审核次数：' + passport.reviewCount, '- 内容哈希：' + passport.contentHash, '- 内容证明：' + (passport.proofId || '--') + '｜' + (passport.proofStatus || '未编译') + '｜证明分 ' + (passport.proofScore || 0), '- 阻止声明：' + (passport.blockedClaims || 0) + ' 条', '- 状态：' + passport.status, ''];
    (passport.artifactHashes || []).forEach(function (item) { lines.push('- ' + item.title + '｜' + item.hash + '｜' + item.status); });
    return lines.join('\n');
  }
  return { create: create, toMarkdown: toMarkdown, fnv1a: fnv1a };
}));