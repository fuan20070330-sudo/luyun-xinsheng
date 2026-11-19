(function (root, factory) {
  var engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.LuyunEngine;
  var proof = typeof module === 'object' && module.exports ? require('./proof-engine.js') : root.LuyunProofEngine;
  var quality = typeof module === 'object' && module.exports ? require('./quality.js') : root.LuyunQuality;
  var api = factory(engine, proof, quality);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunClaimAnalyzer = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine, proofEngine, quality) {
  'use strict';
  var CLICHES = ['匠心独运', '百年传承', '舌尖上的', '不容错过', '必买', '爆款', '天花板', '遥遥领先', '焕新升级', '赋能', '打造闭环'];
  function count(text, terms) { return (terms || []).filter(function (term) { return String(text || '').indexOf(term) !== -1; }); }
  function analyze(input) {
    input = input || {}; var text = String(input.text || '').trim(); var facts = input.facts || []; var brand = input.brand || {}; var platform = input.platform || 'xiaohongshu';
    if (!text) throw new Error('请输入需要分析的广告语或脚本。');
    var detectedRisks = engine && engine.detectRisks ? engine.detectRisks({ materials: text, constraints: text, theme: text, goal: '检查广告语', facts: facts }) : [];
    var riskKeys = {};
    var risks = detectedRisks.filter(function (risk) {
      var key = (risk.type || '') + '|' + (risk.term || '');
      if (riskKeys[key]) return false;
      riskKeys[key] = true;
      return true;
    });
    var proof = proofEngine ? proofEngine.analyzeText(text, facts, risks, input.cultureDna) : { sentences: [], stats: {}, coverage: 0, status: '无法分析' };
    var qualityResult = quality ? quality.scoreContent(text, { platform: platform }) : { score: 0, issues: [] };
    var cliches = count(text, CLICHES); var high = risks.filter(function (risk) { return risk.level === 'high'; }); var pending = proof.sentences.filter(function (item) { return item.status === '待证明' || item.status === '未绑定'; });
    var suggestions = []; high.forEach(function (risk) { suggestions.push('删除或改写“' + risk.term + '”：' + risk.suggestion); }); pending.forEach(function (item) { suggestions.push('为这句话补充事实来源，或标记“待核实”：' + item.sentence); }); cliches.forEach(function (term) { suggestions.push('减少模板化表达“' + term + '”，改成具体动作、场景或可核实事实。'); });
    var safeSentences = proof.sentences.map(function (item) { return item.status === '已阻止' ? '【已阻止】' + item.sentence.replace(/(国家级非遗|宫廷御用|降血糖|最正宗|全国第一|行业唯一)/g, '【待核实】') : item.status === '未绑定' ? '【待核实】' + item.sentence : item.sentence; });
    var complianceScore = Math.max(0, 100 - high.length * 30 - risks.filter(function (risk) { return risk.level === 'medium'; }).length * 12);
    var evidenceScore = proof.coverage || 0; var naturalness = Math.max(20, 100 - cliches.length * 15); var overall = Math.round((complianceScore + evidenceScore + qualityResult.score + naturalness) / 4);
    return { text: text, brandName: brand.name || '未绑定品牌', platform: platform, sentences: proof.sentences, proofStats: proof.stats, evidenceCoverage: evidenceScore, risks: risks, highRiskCount: high.length, cliches: cliches, quality: qualityResult, complianceScore: complianceScore, naturalness: naturalness, overallScore: overall, suggestions: Array.from(new Set(suggestions)), safeRewrite: safeSentences.join('\n'), status: high.length ? '高风险，禁止直接发布' : (pending.length || cliches.length) ? '建议修改后发布' : '可进入人工确认', analyzedAt: new Date().toISOString() };
  }
  return { analyze: analyze, CLICHES: CLICHES };
}));
