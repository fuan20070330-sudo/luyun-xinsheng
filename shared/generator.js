(function (root, factory) {
  var engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.LuyunEngine;
  factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = engine;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  'use strict';

  var PLATFORM_NAMES = { xiaohongshu: '小红书', douyin: '抖音', wechat: '微信公众号', matrix: '多平台矩阵' };
  var TYPE_NAMES = { package: '平台内容包', campaign: '跨平台传播方案', video: '短视频脚本', note: '小红书笔记' };

  function pickByCategory(facts, categories) {
    var wanted = Array.isArray(categories) ? categories : [categories];
    return (facts || []).filter(function (fact) {
      return wanted.indexOf(fact.category) !== -1 && fact.status !== '待核实';
    });
  }

  function withRefs(fact) {
    return fact.text + ' [' + fact.id + ']';
  }

  function safeBrief(config) {
    var facts = config.facts || [];
    return {
      history: pickByCategory(facts, '历史')[0],
      craft: pickByCategory(facts, '工艺').slice(0, 5),
      honors: pickByCategory(facts, '荣誉'),
      products: pickByCategory(facts, '产品'),
      philosophy: pickByCategory(facts, '品牌理念')[0]
    };
  }

  function riskGate(config) {
    var high = (config.risks || []).filter(function (risk) { return risk.level === 'high'; });
    if (!high.length) return '';
    return '【发布拦截】本次输入中发现 ' + high.length + ' 项高风险：' + high.map(function (risk) { return risk.term; }).join('、') + '。这些短语没有形成可核验事实，已从宣传正文中隔离。请先补充权威证明，或按风险建议改写并人工复核。\n\n';
  }

  function demoDisclosure(config) {
    return config.isDemo ? '\n\n——\n仅用于产品原型演示｜鲁香斋为虚构模拟品牌。' : '';
  }

  function buildMainContent(config) {
    var brand = config.brand || {};
    var platform = config.platform || 'xiaohongshu';
    var brief = safeBrief(config);
    var historyLine = brief.history ? withRefs(brief.history) : '品牌历史线索待核实';
    var craftLine = brief.craft.length ? brief.craft.map(withRefs).join('；') : '传统工艺线索待核实';
    var productLine = brief.products.length ? brief.products.slice(0, 4).map(withRefs).join('；') : '产品信息待核实';
    var philosophyLine = brief.philosophy ? withRefs(brief.philosophy) : '品牌理念待核实';
    var honorLine = brief.honors.length ? brief.honors.map(withRefs).join('；') : '品牌荣誉信息待核实';
    var prefix = riskGate(config);

    if (platform === 'douyin') {
      return prefix + '【3秒钩子】\n一块老味道，为什么值得被重新讲一遍？\n\n【口播正文】\n' + brand.name + '这次把镜头放回一块糕点的来路。' + historyLine + '。\n制作线索并非“神秘传说”，而是可以被拆解的工序：' + craftLine + '。\n今天的产品也不是简单复刻：' + productLine + '。\n品牌想守住的是' + philosophyLine + '。\n\n【结尾互动】\n你更想先看哪一道工序？评论区点单。' + demoDisclosure(config);
    }
    if (platform === 'wechat') {
      return prefix + '标题：一块' + (brand.type || '山东糕点') + '，怎样把老味道讲给年轻人？\n\n导语\n关于' + brand.name + '，我们先把“看得见、查得到”的部分写好：' + historyLine + '。\n\n一、从原文出发，不替品牌补写传奇\n' + honorLine + '。品牌资料中的登记信息可以作为引用，但没有证书或权威来源支撑的称号，仍应标记“待核实”。\n\n二、一块糕点背后的工艺秩序\n' + craftLine + '。这些步骤构成了产品口感与制作逻辑，也提醒内容创作者：工艺故事要回到工序，而不是堆叠“古法”“秘制”等空泛词。\n\n三、传统口味与当代产品线\n' + productLine + '。' + philosophyLine + '。\n\n结语\n把老字号讲年轻，不等于把事实讲夸张。先有据，再有感；先经人审，再对外发布。' + demoDisclosure(config);
    }
    var title = platform === 'matrix' ? '同一份品牌事实，四种平台表达' : '把' + (config.theme || '一块老味道') + '讲得真实一点';
    return prefix + '【标题】' + title + '\n\n【正文】\n最近重新认识' + brand.name + '。' + historyLine + '。\n\n我尤其想记录工艺里那些具体的动作：' + craftLine + '。不是一句“古法”一带而过，而是每一步都能回到品牌资料。\n\n产品线目前包括：' + productLine + '。' + philosophyLine + '。\n\n如果你也喜欢地方老味道，可以先收藏这份事实清单，再去看它的新表达。\n\n【事实边界】\n' + honorLine + '。未提供原文来源的信息一律不写成确定事实。\n\n【互动引导】\n你最想了解品牌历史、制作工序，还是产品口味？' + demoDisclosure(config);
  }

  function buildTopicMatrix(config) {
    var brand = config.brand || {};
    var theme = config.theme || '品牌核心主题';
    var audience = config.audience || '目标受众';
    var facts = config.facts || [];
    var allRefs = facts.filter(function (fact) { return fact.status !== '待核实'; }).slice(0, 7).map(function (fact) { return fact.id; });
    return '【选题矩阵】' + brand.name + '｜' + theme + '\n目标受众：' + audience + '\n\n' +
      '| 平台 | 选题角度 | 内容形态 | 主要事实引用 |\n' +
      '|---|---|---|---|\n' +
      '| 小红书 | 从一道具体工序切入，讲“看得见的传统” | 6图笔记 + 300字正文 | ' + allRefs.slice(0, 3).join('、') + ' |\n' +
      '| 抖音 | 用30秒拆解“原料到成品”的动作节奏 | 竖屏口播 + 特写 | ' + allRefs.slice(0, 4).join('、') + ' |\n' +
      '| 公众号 | 以品牌档案为线索，解释传统与当代产品线 | 长图文 / 图文故事 | ' + allRefs.slice(0, 6).join('、') + ' |\n' +
      '| 多平台矩阵 | 同一事实包分别改写为体验、知识、人物、节令四条线 | 统一素材、差异分发 | ' + allRefs.slice(0, 7).join('、') + ' |\n\n' +
      '内容排期建议：\n1. 第一篇讲“为什么是老字号”，只使用已核验历史与荣誉原文。\n2. 第二篇讲“一道工序怎么做”，用镜头替代形容词。\n3. 第三篇讲“传统产品如何适应当下”，避免健康功效承诺。\n4. 节令礼盒内容必须补充当季 SKU、价格、供应范围等可验证信息。\n\n' + demoDisclosure(config);
  }

  function buildScript(config) {
    var brand = config.brand || {};
    var brief = safeBrief(config);
    var history = brief.history ? brief.history.text + ' [' + brief.history.id + ']' : '品牌历史以知识库原文为准';
    var craft = brief.craft.length ? brief.craft.map(withRefs).join('；') : '工艺细节待核实';
    var product = brief.products.length ? brief.products[0].text + ' [' + brief.products[0].id + ']' : '产品信息待核实';
    return '【30秒短视频脚本】' + brand.name + '\n\n' +
      '0-3秒｜钩子\n画面：糕点特写推进，落下第一行字“老味道，不靠编故事”。\n口播：一块老味道，先看它的来路。\n\n' +
      '3-9秒｜历史\n画面：档案纸、年份字样和资料局部。\n口播：' + history + '。\n字幕：历史信息引用知识库，不补写年份。\n\n' +
      '9-20秒｜工艺\n画面：按资料中的工序顺序做快切，每道动作只保留一个特写。\n口播：' + craft + '。\n字幕：工序按品牌资料拆解，不添加未证实细节。\n\n' +
      '20-26秒｜产品\n画面：产品分镜与包装，不出现功效字幕。\n口播：' + product + '。\n\n' +
      '26-30秒｜收束\n画面：品牌标识与“原文可查，发布前必审”。\n口播：老字号的新表达，先把事实说清楚。\n\n' +
      '制作提示：高风险短语不得进入口播、字幕、标题或评论置顶；所有事实引用需与审核稿一同留档。\n\n' + demoDisclosure(config);
  }

  function generateContent(config) {
    config = config || {};
    var modelInfo = config.modelInfo || { model: 'local-deterministic-demo', mode: 'local', promptVersion: engine.PROMPT_VERSION };
    var main = buildMainContent(config);
    var matrix = buildTopicMatrix(config);
    var script = buildScript(config);
    var facts = config.facts || [];
    var referenced = facts.filter(function (fact) { return fact.status !== '待核实'; }).slice(0, 8).map(function (fact) { return fact.id; });
    var highRiskCount = (config.risks || []).filter(function (risk) { return risk.level === 'high'; }).length;
    var createdAt = new Date().toISOString();
    return [
      { id: 'main', title: '主内容草稿', label: PLATFORM_NAMES[config.platform] || '平台内容', content: main, originalContent: main, status: highRiskCount ? 'flagged' : 'draft', facts: referenced, modelInfo: modelInfo, createdAt: createdAt },
      { id: 'matrix', title: '选题矩阵', label: TYPE_NAMES[config.contentType] || '内容规划', content: matrix, originalContent: matrix, status: 'draft', facts: referenced, modelInfo: modelInfo, createdAt: createdAt },
      { id: 'script', title: '30秒短视频脚本', label: '视频 / 平台脚本', content: script, originalContent: script, status: highRiskCount ? 'flagged' : 'draft', facts: referenced, modelInfo: modelInfo, createdAt: createdAt }
    ];
  }

  engine.PLATFORM_NAMES = PLATFORM_NAMES;
  engine.TYPE_NAMES = TYPE_NAMES;
  engine.generateContent = generateContent;
}));
