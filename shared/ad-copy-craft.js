(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunAdCopyCraft = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PROMPT_VERSION = 'ad-copy-craft-v1.0';
  var CLICHES = ['匠心独运', '百年传承', '舌尖上的', '不容错过', '焕新升级', '赋能', '打造闭环', '遥遥领先', '爆款', '天花板', '必买'];
  var CRAFT = ['选枣', '蒸制', '炒馅', '包制', '烘烤', '熬制', '发酵', '晾晒', '炒制', '成型', '包装'];
  function clean(value) { return String(value == null ? '' : value).replace(/^品牌档案（模拟）第\d+条：/, '').replace(/^受访记录（模拟）第\d+条：/, '').trim(); }
  function unique(values) { return Array.from(new Set((values || []).filter(Boolean))); }
  function displayBrandName(value) { return String(value || '').replace(/[（(]\s*模拟品牌\s*[)）]/g, '').trim(); }
  function factByIdentity(facts, test) { return (facts || []).find(function (fact) { return test(clean(fact.text || ''), fact); }); }
  function sourceLabel(facts) { return unique((facts || []).map(function (fact) { return fact.id; })).join('、'); }
  function productsFrom(text) {
    var match = String(text || '').match(/(?:产品包括|包括|有)([^。；\n]+)/);
    if (!match) return [];
    return match[1].replace(/^[：:，,\s]+/, '').split(/[、和，,]/).map(function (item) { return item.trim(); }).filter(function (item) { return item.length >= 2; });
  }
  function critique(text) {
    var issues = [];
    CLICHES.forEach(function (term) { if (text.indexOf(term) !== -1) issues.push('套话：' + term); });
    if (text.length > 30) issues.push('偏长，广告语建议控制在 30 字内');
    if (/(不仅.*而且|不是.*而是|从.*到.*再)/.test(text)) issues.push('句式模板感较强');
    if (/[，。！？].*[，。！？].*[，。！？]/.test(text)) issues.push('断句过多');
    return issues;
  }
  function score(text, evidenceCount) {
    var issues = critique(text);
    var value = 78 + Math.min(8, evidenceCount * 3);
    if (/[0-9]{4}|选枣|蒸制|炒馅|包制|烘烤|枣泥酥|山楂锅盔|桂花酥|礼盒/.test(text)) value += 6;
    if (/[你我他]|桌|家里|今天|一块|一口|一盒/.test(text)) value += 3;
    value -= issues.length * 9;
    return { score: Math.max(20, Math.min(98, value)), issues: issues };
  }
  function line(text, angle, facts, rationale) {
    var evidence = (facts || []).filter(Boolean);
    var checked = score(text, evidence.length);
    return { text: text, angle: angle, factIds: evidence.map(function (fact) { return fact.id; }), source: evidence.map(function (fact) { return fact.text; }).join('；'), rationale: rationale || '', score: checked.score, issues: checked.issues };
  }
  function generate(input) {
    input = input || {};
    var facts = input.facts || [];
    var brand = input.brand || {};
    var yearFact = factByIdentity(facts, function (text) { return /(?:始创|创立|创始|创建|始于|成立于)[^0-9]{0,8}((?:18|19|20)\d{2})/.test(text); });
    var year = yearFact && (clean(yearFact.text).match(/((?:18|19|20)\d{2})/) || [])[1];
    var craftFacts = facts.filter(function (fact) { return fact.category === '工艺' || /工序|工艺|制作/.test(fact.text || ''); });
    var productFacts = facts.filter(function (fact) { return fact.category === '产品' || /产品|枣泥酥|山楂锅盔|桂花酥|礼盒/.test(fact.text || ''); });
    var interviewFacts = facts.filter(function (fact) { return fact.category === '访谈洞察' || /受访|传承人表示|品牌方希望/.test(fact.text || ''); });
    var honorFacts = facts.filter(function (fact) { return fact.category === '荣誉' && fact.status === '已确认'; });
    var sequence = CRAFT.filter(function (term) { return craftFacts.some(function (fact) { return clean(fact.text).indexOf(term) !== -1; }); });
    var products = unique(productFacts.reduce(function (all, fact) { return all.concat(productsFrom(clean(fact.text))); }, []));
    var sugarFact = productFacts.find(function (fact) { return /低糖|含糖|糖量/.test(clean(fact.text)); });
    var giftFact = productFacts.find(function (fact) { return /礼盒|节令/.test(clean(fact.text)); });
    var rawQuote = interviewFacts[0] && clean(interviewFacts[0].text).replace(/^[“”"']|[“”"']$/g, '');
    var quoteMatch = rawQuote && rawQuote.match(/(?:表示|说|认为)[，,：:]?\s*(.+)/);
    var quote = quoteMatch ? quoteMatch[1].split(/[，。；;]/)[0].trim() : '';
    var lines = [];
    if (year) lines.push(line('从' + year + '年做到今天，先把每一步做对。', '时间', [yearFact], '只使用档案中的创立年份，没有补写历史。'));
    if (sequence.length >= 2) lines.push(line(sequence.slice(0, 5).join('、') + '，一道都省不得。', '工艺', craftFacts.slice(0, 1), '直接使用已提取的工序名称。'));
    if (sugarFact) lines.push(line('甜度收一点，工序不减。', '产品', [sugarFact], '对应品牌资料中“优化含糖量、保留传统口感”的信息。'));
    if (products.length >= 2) lines.push(line(products.slice(0, 2).join('、') + '，一块有一块的吃法。', '产品', productFacts.slice(0, 1), '产品名称来自品牌资料，没有新增口味。'));
    if (giftFact) lines.push(line('节令上桌，给家里留一盒记得住的味道。', '场景', [giftFact], '围绕资料中的节令礼盒建立家庭分享场景。'));
    if (quote && quote.length >= 4) lines.push(line('“' + quote + '”', '人物', interviewFacts.slice(0, 1), '保留受访原话，不替受访者补写观点。'));
    if (craftFacts.length) lines.push(line('不急着讲传奇，先把这道工序讲清楚。', '品牌态度', craftFacts.slice(0, 1), '把注意力拉回可核对的工艺资料。'));
    if (products.length) lines.push(line(products[0] + '，认真做出来的老味道。', '产品', productFacts.slice(0, 1), '只使用正式产品名称和传统味道表述。'));
    if (honorFacts.length) lines.push(line((honorFacts[0].text || '').replace(/[。；]$/, '') + '，这是一份需要认真对待的信任。', '荣誉', [honorFacts[0]], '荣誉仅在品牌方确认后才进入广告语。'));
    var brandName = displayBrandName(brand.name);
    if (brandName && year) lines.push(line(brandName + '，把' + year + '年的手艺做到今天。', '品牌', [yearFact], '将品牌名和档案年份组合，不添加新事实。'));
    if (!lines.length) lines.push(line('先把品牌资料补全，再决定哪句话值得被记住。', '待核实', [], '当前没有足够事实支撑广告语。'));
    lines = lines.map(function (item) { item.issues = critique(item.text).concat(item.issues || []); return item; }).sort(function (a, b) { return b.score - a.score; });
    return { lines: lines, promptVersion: PROMPT_VERSION, brandName: brand.name || '未绑定品牌', audience: input.audience || '', platform: input.platform || 'xiaohongshu', generatedAt: new Date().toISOString(), safeFacts: sourceLabel(facts) };
  }

  return { generate: generate, critique: critique, PROMPT_VERSION: PROMPT_VERSION };
}));
