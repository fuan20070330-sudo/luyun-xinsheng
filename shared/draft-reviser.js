(function (root, factory) {
  var proof = typeof module === 'object' && module.exports ? require('./proof-engine.js') : root.LuyunProofEngine;
  var claim = typeof module === 'object' && module.exports ? require('./claim-analyzer.js') : root.LuyunClaimAnalyzer;
  var quality = typeof module === 'object' && module.exports ? require('./quality.js') : root.LuyunQuality;
  var api = factory(proof, claim, quality);
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunDraftReviser = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (proof, claim, quality) {
  'use strict';

  var RISK_RULES = [
    { pattern: /宫廷御用|御用贡品|皇室专供/g, replacement: '宫廷相关说法（待核实）', reason: '宫廷或皇室身份没有正式依据，不能写成确定事实。' },
    { pattern: /国家级非物质文化遗产|国家级非遗/g, replacement: '待核实的非遗级别', reason: '非遗级别必须与官方名录和证书信息一致。' },
    { pattern: /中华老字号/g, replacement: '待核实的老字号身份', reason: '老字号身份需要登记名录或正式证书支撑。' },
    { pattern: /驰名商标/g, replacement: '待核实的商标荣誉', reason: '商标荣誉需要提供正式认定文件。' },
    { pattern: /降血糖|降血压|降血脂|治疗|治愈|根治|防癌|抗癌|增强免疫力/g, replacement: '产品健康作用的说法尚待依据核实', reason: '普通食品内容不得暗示医疗或保健功效。' },
    { pattern: /全国第一|行业唯一|最正宗|最好|最佳|绝对安全|100%有效/g, replacement: '具有自身特色', reason: '绝对化或无法比较的宣传容易造成误导。' },
    { pattern: /零添加|纯天然/g, replacement: '原料与配料信息以产品标签为准', reason: '原料、配料和加工信息应以正式标签或检测资料为准。' },
    { pattern: /祖传秘制|失传技艺/g, replacement: '品牌保存的传统技艺', reason: '技艺来源和传承情况需要可核对资料。' },
    { pattern: /遥遥领先|行业领先/g, replacement: '具有自身特点', reason: '比较性结论必须有明确范围和证据。' }
  ];
  var CLICHES = {
    '匠心独运': '用心',
    '百年传承': '延续至今',
    '舌尖上的': '',
    '不容错过': '值得了解',
    '千万不要错过': '可以重点了解',
    '不要错过': '可以了解',
    '必买': '可以留意',
    '爆款': '热门',
    '天花板': '有特色',
    '焕新升级': '更新',
    '赋能': '帮助',
    '打造闭环': '形成完整流程'
  };

  function cleanText(value) { return String(value == null ? '' : value).replace(/\r\n/g, '\n').trim(); }
  function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
  function analyze(options) {
    options = options || {};
    var text = cleanText(options.text);
    if (!text) throw new Error('请先载入或粘贴需要检查的文稿。');
    return claim.analyze({
      text: text,
      facts: options.facts || [],
      brand: options.brand || { name: '未绑定品牌' },
      cultureDna: options.cultureDna || null,
      platform: options.platform || 'xiaohongshu'
    });
  }

  function sanitizeSentence(sentence, blockedClaim) {
    var before = String(sentence || '');
    var after = before;
    var reasons = [];
    if (/宫廷|御用|皇室/.test(after)) {
      return { text: '一项历史背景说法尚待核实，现阶段不作确定性表述。', before: before, after: '一项历史背景说法尚待核实，现阶段不作确定性表述。', changed: true, reasons: ['宫廷或皇室身份没有正式依据，不能写成确定事实。'] };
    }
    if (/国家级非遗|国家级非物质文化遗产/.test(after)) {
      return { text: '品牌资料中的非遗级别尚待官方名录核实，现阶段不作确定性表述。', before: before, after: '品牌资料中的非遗级别尚待官方名录核实，现阶段不作确定性表述。', changed: true, reasons: ['非遗级别必须与官方名录和证书信息一致。'] };
    }
    if (/中华老字号|驰名商标/.test(after)) {
      return { text: '品牌的相关荣誉身份尚待官方名录或正式文件核实。', before: before, after: '品牌的相关荣誉身份尚待官方名录或正式文件核实。', changed: true, reasons: ['荣誉身份需要官方登记或正式证书支撑。'] };
    }
    if (/降血糖|降血压|降血脂|治疗|治愈|根治|防癌|抗癌|增强免疫力/.test(after)) {
      return { text: '相关说法尚待权威依据核实，现阶段不作额外说明。', before: before, after: '相关说法尚待权威依据核实，现阶段不作额外说明。', changed: true, reasons: ['普通食品内容不得暗示医疗或保健功效。'] };
    }
    RISK_RULES.forEach(function (rule) {
      rule.pattern.lastIndex = 0;
      if (rule.pattern.test(after)) {
        rule.pattern.lastIndex = 0;
        after = after.replace(rule.pattern, rule.replacement);
        reasons.push(rule.reason);
      }
    });
    if (blockedClaim && after === before) {
      after = '【待核实，暂不对外发布】' + before;
      reasons.push(blockedClaim);
    }
    return { text: after, before: before, after: after, changed: after !== before, reasons: unique(reasons) };
  }

  function removeTemplateText(text, changes) {
    var before = text;
    var next = text
      .replace(/【本次采用的宣传方法】[^\n]*\n?/g, '')
      .replace(/【暂不建议发布的内容】[\s\S]*?(?=\n\n|【|$)/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    if (next !== before) changes.push({ type: '结构清理', before: '生成结果中的方法说明与拦截提示', after: '已移出正文，保留可发布内容', reason: '这些内容属于工作说明，不应混入对外文稿。' });
    return next;
  }

  function applyRequirementTone(text, requirements, changes) {
    var before = text;
    var next = text;
    if (/口语|自然|年轻|轻松|小红书/.test(requirements)) {
      next = next.replace(/此外/g, '还有').replace(/因此/g, '所以').replace(/呈现出/g, '有').replace(/尤为/g, '更');
    }
    if (/正式|公众号|书面|克制/.test(requirements)) {
      next = next.replace(/特别/g, '较为').replace(/超级/g, '非常');
    }
    if (/去\s*AI|AI\s*味|模板化|少一点套话|不要套话/i.test(requirements)) {
      Object.keys(CLICHES).forEach(function (term) { next = next.split(term).join(CLICHES[term]); });
    }
    if (next !== before) changes.push({ type: '语感调整', before: before.slice(0, 90), after: next.slice(0, 90), reason: '根据修改要求调整了口语程度、书面程度或模板化表达。' });
    return next;
  }

  function keepTerms(value) {
    var cleaned = String(value || '').replace(/重点保留|必须保留|不要删除|不能删除|保留/g, '').trim();
    if (!cleaned) return [];
    return unique(cleaned.split(/[、，,；;和\s]+/).map(function (item) { return item.replace(/[。.!！]$/g, '').trim(); }).filter(function (item) { return item.length >= 2; }));
  }

  function applyLengthRequirement(text, requirements, changes, keepText) {
    var match = requirements.match(/(?:控制在|压缩到|精简到|不超过|限制在)?\s*(\d{2,4})\s*(?:字|字符)/);
    if (!match) return text;
    var limit = Number(match[1]);
    if (!limit || text.length <= limit) return text;
    var sentences = proof.splitSentences(text);
    var protectedTerms = keepTerms(keepText + ' ' + requirements);
    var protectedSentences = sentences.filter(function (sentence) { return protectedTerms.some(function (term) { return sentence.indexOf(term) !== -1; }); });
    var output = [];
    var total = 0;
    sentences.forEach(function (sentence) {
      var protectedSentence = protectedSentences.indexOf(sentence) !== -1;
      if (protectedSentence || !output.length || total + sentence.length <= limit) {
        output.push(sentence);
        total += sentence.length;
      }
    });
    var next = output.join('').trim() || text.slice(0, limit).trim();
    changes.push({ type: '篇幅控制', before: text.length + ' 字', after: next.length + ' 字', reason: '按修改要求压缩到约 ' + limit + ' 字，并优先保留指定重点与靠前的完整句子。' });
    return next;
  }

  function revise(options) {
    options = options || {};
    var original = cleanText(options.text);
    if (!original) throw new Error('请先载入或粘贴需要修改的文稿。');
    var requirements = cleanText(options.requirements);
    var analysis = options.analysis || analyze({ text: original, facts: options.facts, brand: options.brand, cultureDna: options.cultureDna, platform: options.platform });
    var changes = [];
    var blocked = {};
    (analysis.sentences || []).forEach(function (item) { if (item.status === '已阻止') blocked[item.sentence] = item.risk || '该句包含高风险声明。'; });
    var revisedSentences = (analysis.sentences || []).map(function (item) {
      var result = sanitizeSentence(item.sentence, blocked[item.sentence]);
      if (result.changed) changes.push({ type: '风险改写', before: result.before, after: result.after, reason: result.reasons.join('；') || '移除了无法核实或不宜发布的表达。' });
      return result.text;
    });
    var text = revisedSentences.join('') || original;
    if (/精简|压缩|短一点|更短|简洁|去重/.test(requirements)) text = removeTemplateText(text, changes);
    text = applyRequirementTone(text, requirements, changes);
    text = applyLengthRequirement(text, requirements, changes, options.keep);
    text = text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    var revisedAnalysis = analyze({ text: text, facts: options.facts, brand: options.brand, cultureDna: options.cultureDna, platform: options.platform });
    var qualityResult = quality && quality.scoreContent ? quality.scoreContent(text, { platform: options.platform || 'xiaohongshu' }) : null;
    return {
      text: text,
      changes: changes,
      requirementNotes: requirements ? ['已读取修改要求：' + requirements] : ['未填写额外修改要求，仅处理已检出的风险表达。'],
      analysis: analysis,
      revisedAnalysis: revisedAnalysis,
      quality: qualityResult,
      revisedAt: new Date().toISOString()
    };
  }

  return { analyze: analyze, revise: revise, sanitizeSentence: sanitizeSentence, PROMPT_VERSION: 'draft-revision-safe-v1.0' };
}));
