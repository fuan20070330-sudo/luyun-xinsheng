(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunCultureDna = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var CRAFT_TERMS = ['选枣','选料','蒸制','炒馅','包制','烘烤','熬制','发酵','晾晒','炒制','成型','包装','和面','烘焙','手作'];
  var TABOO_TERMS = ['国家级非遗','宫廷御用','御用贡品','降血糖','降血压','治疗','治愈','防癌','最正宗','全国第一','行业唯一','零添加','无糖'];
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function clean(value) { return String(value == null ? '' : value).replace(/^品牌档案（模拟）第\d+条：/, '').replace(/^受访记录（模拟）第\d+条：/, '').trim(); }
  function craftTerms(facts) { var text = (facts || []).filter(function (fact) { return fact.category === '工艺'; }).map(function (fact) { return fact.text; }).join(' '); return unique(CRAFT_TERMS.filter(function (term) { return text.indexOf(term) !== -1; })); }
  function productTerms(facts) { var values = []; (facts || []).filter(function (fact) { return fact.category === '产品'; }).forEach(function (fact) { clean(fact.text).replace(/^.*?产品包括/, '').replace(/[。；;]$/g, '').split(/[、,，和及以及]/).forEach(function (item) { values.push(item.replace(/等.*$/, '').trim()); }); }); return unique(values.filter(function (item) { return item.length >= 2 && item.length <= 18; })).slice(0, 10); }
  function build(brand, facts, risks, documents) {
    brand = brand || {}; facts = facts || []; risks = risks || []; documents = documents || [];
    var protectedTerms = unique([brand.name].concat(craftTerms(facts)).concat(productTerms(facts)).concat(['老字号']));
    var confirmed = facts.filter(function (fact) { return fact.status !== '待核实'; });
    var immutableClaims = confirmed.filter(function (fact) { return ['历史','工艺','荣誉','人物','产品'].indexOf(fact.category) !== -1 && (fact.sourceAuthorityScore || 0) >= 3; }).map(function (fact) { return { id: fact.id, category: fact.category, text: clean(fact.text) }; });
    var taboo = unique(risks.filter(function (risk) { return risk.level === 'high'; }).map(function (risk) { return risk.term; }).concat(TABOO_TERMS));
    return {
      brandName: brand.name || '', tone: brand.tone || '', protectedTerms: protectedTerms, craftTerms: craftTerms(facts), productTerms: productTerms(facts),
      immutableClaims: immutableClaims, tabooTerms: taboo, sourceDocuments: documents.map(function (item) { return { name: item.name, hash: item.hash, authority: item.authority }; }),
      guidelines: ['事实编号、年份、人物身份和荣誉不得改写。','工艺动作和顺序必须按原文保留。','未证实称号和功效不得进入对外文案。','平台只改变语气、结构、场景和标题，不改变事实。'],
      metrics: { protectedTerms: protectedTerms.length, immutableClaims: immutableClaims.length, tabooTerms: taboo.length, verifiedFacts: confirmed.length }
    };
  }
  function evaluateArtifact(artifact, dna) {
    var content = String(artifact && artifact.content || ''); var retained = (dna.protectedTerms || []).filter(function (term) { return content.indexOf(term) !== -1; }); var tabooFound = (dna.tabooTerms || []).filter(function (term) { return content.indexOf(term) !== -1; }); var citations = (content.match(/\[F\d{3,}\]/g) || []).length;
    var score = 100; if (dna.protectedTerms.length) score -= Math.round((1 - retained.length / dna.protectedTerms.length) * 25); score -= tabooFound.length * 20; if (!citations) score -= 15; score = Math.max(0, Math.min(100, score));
    return { score: score, level: score >= 85 ? '高保真' : score >= 70 ? '可接受' : '需复核', retainedTerms: retained, tabooFound: tabooFound, citations: citations };
  }
  return { build: build, evaluateArtifact: evaluateArtifact, CRAFT_TERMS: CRAFT_TERMS, TABOO_TERMS: TABOO_TERMS };
}));