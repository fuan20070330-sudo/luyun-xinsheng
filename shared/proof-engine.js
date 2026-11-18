(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunProofEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var YEAR_RE = /\b(?:18|19|20)\d{2}\b/;
  var HONOR_TERMS = ['国家级非遗','国家级非物质文化遗产','中华老字号','山东老字号','驰名商标','宫廷御用','御用贡品','皇室专供'];
  var HEALTH_TERMS = ['降血糖','降血压','治疗','治愈','根治','疗效','防癌','抗癌','增强免疫力'];
  var CRAFT_SEQUENCE = ['选枣','选料','蒸制','炒馅','包制','烘烤','熬制','发酵','晾晒','炒制','成型','包装'];
  var CULTURE_TERMS = ['最正宗','唯一正统','祖传秘制','失传技艺','原汁原味'];
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function clean(value) { return String(value == null ? '' : value).replace(/^品牌档案（模拟）第\d+条：/, '').replace(/^受访记录（模拟）第\d+条：/, '').trim(); }
  function typeFor(fact) {
    var text = clean(fact.text || ''); var category = fact.category || '';
    if (HEALTH_TERMS.some(function (term) { return text.indexOf(term) !== -1; })) return '健康声明';
    if (HONOR_TERMS.some(function (term) { return text.indexOf(term) !== -1; })) return '荣誉声明';
    if (YEAR_RE.test(text) || category === '历史') return '年份声明';
    if (category === '工艺') return '工艺声明';
    if (category === '人物' || category === '访谈洞察') return '人物声明';
    if (category === '产品') return '产品声明';
    if (category === '品牌理念') return '文化声明';
    return '一般声明';
  }
  function obligationFor(type) {
    return {
      '年份声明': '必须提供原始档案、方志、工商登记或权威出版物，并记录文件指纹。',
      '荣誉声明': '必须提供授予机构、证书编号、官方名录或主管部门发文。',
      '工艺声明': '必须保留原文工序顺序、工具、时长和判断标准。',
      '健康声明': '食品内容不得编造或暗示医疗功效；除非有批准文件，否则禁止进入正文。',
      '人物声明': '必须确认姓名、身份、师承关系和可公开表达范围。',
      '产品声明': '必须有产品资料、适用场景和正式名称。',
      '文化声明': '必须由品牌方确认文化语义，不能把未证实标签写成文化事实。',
      '一般声明': '必须能回到品牌知识库中的事实编号。'
    }[type] || '必须能够回到品牌知识库中的事实编号。';
  }
  function claimStatus(fact, type) {
    if (type === '健康声明') return '已阻止';
    if (fact.status === '待核实') return '待证明';
    if (type === '荣誉声明') return fact.verificationStatus === '已核验' ? '已证明' : '待证明';
    if (type === '年份声明') return fact.verificationStatus === '已核验' || (fact.sourceAuthorityScore || 0) >= 5 ? '已证明' : '待证明';
    if (type === '人物声明') return fact.verificationStatus === '品牌方已确认' || fact.verificationStatus === '已核验' ? '已证明' : '待证明';
    return (fact.sourceAuthorityScore || 0) >= 3 || fact.status === '已确认' ? '已证明' : '待证明';
  }
  function build(facts, risks, cultureDna) {
    facts = facts || []; risks = risks || []; cultureDna = cultureDna || {}; var claims = []; var seen = {};
    function addClaim(value, type, factIds, status, reason, evidence) { var key = type + '|' + value; if (seen[key]) return; seen[key] = true; claims.push({ id: 'CL' + String(claims.length + 1).padStart(3, '0'), type: type, value: value, factIds: factIds || [], status: status, requiredEvidence: obligationFor(type), reason: reason || '', evidence: evidence || '' }); }
    facts.forEach(function (fact) {
      var text = clean(fact.text || ''); if (!text || /暂未从资料中提取到/.test(text)) return;
      var type = typeFor(fact); var status = claimStatus(fact, type); var value = text.length > 42 ? text.slice(0, 42) + '…' : text;
      var evidence = fact.sourceDocumentName ? fact.sourceDocumentName + (fact.sourceHash ? '｜' + fact.sourceHash.slice(0, 12) : '') : (fact.source || '未找到来源');
      addClaim(value, type, [fact.id], status, status === '已证明' ? '满足当前证明义务。' : (status === '已阻止' ? '该声明涉及禁止性风险。' : '证据不足或尚未完成权威核验。'), evidence);
    });
    risks.filter(function (risk) { return risk.level === 'high'; }).forEach(function (risk) { if (risk.term) addClaim(risk.term, risk.type || '风险声明', [], '已阻止', risk.reason || '高风险内容不得作为确定事实。', '品牌知识库未提供可核验依据'); });
    var stats = { total: claims.length, proven: claims.filter(function (claim) { return claim.status === '已证明'; }).length, pending: claims.filter(function (claim) { return claim.status === '待证明'; }).length, blocked: claims.filter(function (claim) { return claim.status === '已阻止'; }).length };
    var proofScore = stats.total ? Math.round((stats.proven + stats.pending * 0.5) / stats.total * 100) : 100;
    if (stats.blocked) proofScore = Math.min(proofScore, 60);
    return { claims: claims, stats: stats, proofScore: proofScore, status: stats.blocked ? '存在阻止项' : stats.pending ? '存在待证明项' : '全部已证明', blockedClaims: claims.filter(function (claim) { return claim.status === '已阻止'; }), pendingClaims: claims.filter(function (claim) { return claim.status === '待证明'; }), protectedTerms: cultureDna.protectedTerms || [], generatedAt: new Date().toISOString() };
  }
  function splitSentences(text) {
    return String(text || '').replace(/\r/g, '').split(/\n+|(?<=[。！？；!?;])/g).map(function (line) { return line.replace(/^[\s#>*\-\d.、]+/, '').trim(); }).filter(function (line) { return line.length >= 3; });
  }
  function shingles(text) {
    var cleanText = String(text || '').replace(/[^\u4e00-\u9fa5A-Za-z0-9]/g, ''); var set = {};
    for (var i = 0; i < cleanText.length - 1; i += 1) set[cleanText.slice(i, i + 2)] = true;
    return Object.keys(set);
  }
  function matchScore(sentence, claim) {
    var a = shingles(sentence); var b = shingles(claim.value); if (!a.length || !b.length) return 0;
    var bSet = {}; b.forEach(function (item) { bSet[item] = true; }); var hit = a.filter(function (item) { return bSet[item]; }).length;
    return hit / Math.max(1, Math.min(a.length, b.length));
  }
  function looksFactual(sentence) { return /(?:18|19|20)\d{2}|创立|始创|成立于|老字号|非遗|荣誉|证书|工序|工艺|产品|包括|传承人|创始人|销量|第一|治疗|功效|降血糖|降低|提升|元|万元|%|％/.test(sentence); }
  function analyzeText(text, facts, risks, cultureDna) {
    var proof = build(facts, risks, cultureDna); var publishable = stripPolicySections(text); var sentences = splitSentences(publishable); var results = [];
    sentences.forEach(function (sentence, index) {
      var directIds = (sentence.match(/\[F\d{3,}\]/g) || []).map(function (id) { return id.replace(/[\[\]]/g, ''); });
      var blocked = proof.blockedClaims.filter(function (claim) { return claim.value && sentence.indexOf(claim.value) !== -1; })[0];
      var candidates = proof.claims.filter(function (claim) { return claim.status !== '已阻止'; }).map(function (claim) { return { claim: claim, score: matchScore(sentence, claim) }; }).sort(function (a, b) { return b.score - a.score; });
      var best = candidates[0] || null; var boundByFact = directIds.length || (best && best.score >= 0.18 ? best : null);
      var status = '未绑定'; var claim = best && best.claim || null;
      if (blocked) { status = '已阻止'; claim = blocked; }
      else if (boundByFact) { status = claim && claim.status === '已证明' ? '已证明' : '待证明'; }
      else if (!looksFactual(sentence)) status = '创作表达';
      results.push({ index: index + 1, sentence: sentence, status: status, claimId: claim ? claim.id : '', claimType: claim ? claim.type : (looksFactual(sentence) ? '未识别声明' : '表达'), factIds: claim ? claim.factIds : directIds, requiredEvidence: claim ? claim.requiredEvidence : (looksFactual(sentence) ? '需要绑定品牌知识库中的事实' : '无需事实绑定'), risk: blocked ? blocked.reason : '', score: boundByFact ? Number((best && best.score || 1).toFixed(2)) : 0 });
    });
    var stats = { total: results.length, proved: results.filter(function (item) { return item.status === '已证明'; }).length, pending: results.filter(function (item) { return item.status === '待证明'; }).length, blocked: results.filter(function (item) { return item.status === '已阻止'; }).length, unbound: results.filter(function (item) { return item.status === '未绑定'; }).length, expressive: results.filter(function (item) { return item.status === '创作表达'; }).length };
    var factual = stats.total - stats.expressive;
    return { sentences: results, stats: stats, coverage: factual ? Math.round((stats.proved + stats.pending) / factual * 100) : 100, status: stats.blocked ? '阻止发布' : stats.unbound ? '存在未绑定声明' : stats.pending ? '存在待证明声明' : '编译通过', generatedAt: new Date().toISOString() };
  }

  function stripPolicySections(text) {
    return String(text || '').replace(/【暂不建议发布的内容】[\s\S]*?(?=\n\n|【|$)/g, '').replace(/【本次采用的宣传方法】[^\n]*\n?/g, '');
  }
  function validateArtifacts(artifacts, proof, facts, risks, cultureDna) {
    proof = proof || { blockedClaims: [], protectedTerms: [] }; artifacts = artifacts || [];
    var results = artifacts.map(function (artifact) { var analysis = analyzeText(artifact.content || '', facts, risks, cultureDna); var blockedHits = analysis.sentences.filter(function (item) { return item.status === '已阻止'; }).map(function (item) { return item.sentence; }); var citations = analysis.sentences.reduce(function (sum, item) { return sum + (item.factIds || []).length; }, 0); var score = 100 - analysis.stats.blocked * 35 - analysis.stats.unbound * 20 - (analysis.stats.pending ? 10 : 0); score = Math.max(0, score); return { artifactId: artifact.id, title: artifact.title, status: analysis.status === '阻止发布' ? '阻止发布' : '编译通过', score: score, blockedHits: blockedHits, citations: citations, analysis: analysis }; });
    return { results: results, status: results.some(function (item) { return item.status === '阻止发布'; }) ? '阻止发布' : '编译通过', score: results.length ? Math.round(results.reduce(function (sum, item) { return sum + item.score; }, 0) / results.length) : 100, blockedTerms: unique(results.reduce(function (all, item) { return all.concat(item.blockedHits); }, [])), sentenceStats: results.reduce(function (all, item) { var s = item.analysis.stats; all.total += s.total; all.proved += s.proved; all.pending += s.pending; all.blocked += s.blocked; all.unbound += s.unbound; all.expressive += s.expressive; return all; }, { total: 0, proved: 0, pending: 0, blocked: 0, unbound: 0, expressive: 0 }), generatedAt: new Date().toISOString() };
  }
  return { build: build, analyzeText: analyzeText, validateArtifacts: validateArtifacts, splitSentences: splitSentences, stripPolicySections: stripPolicySections, typeFor: typeFor, obligationFor: obligationFor, CRAFT_SEQUENCE: CRAFT_SEQUENCE };
}));