(function (root, factory) {
  var engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.LuyunEngine;
  factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = engine;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  'use strict';
  var PLATFORM_NAMES = { xiaohongshu: '小红书', douyin: '抖音', wechat: '微信公众号', matrix: '多平台矩阵' };
  var TYPE_NAMES = { narrative: '完整叙事包', story: '品牌故事', calendar: '内容日历', copy: '多平台文案', youth: '年轻化表达' };
  function pickByCategory(facts, categories) {
    var wanted = Array.isArray(categories) ? categories : [categories];
    return (facts || []).filter(function (fact) { return wanted.indexOf(fact.category) !== -1 && fact.status !== '待核实'; });
  }
  function withRefs(fact) { return fact.text + ' [' + fact.id + ']'; }
  function safeBrief(config) {
    var facts = config.facts || [];
    return { history: pickByCategory(facts, '历史')[0], craft: pickByCategory(facts, '工艺').slice(0, 5), honors: pickByCategory(facts, '荣誉'), products: pickByCategory(facts, '产品'), philosophy: pickByCategory(facts, '品牌理念')[0], interviews: pickByCategory(facts, '访谈洞察').slice(0, 4) };
  }
  function riskGate(config) {
    var high = (config.risks || []).filter(function (risk) { return risk.level === 'high'; });
    if (!high.length) return '';
    return '【发布拦截】本次输入中发现 ' + high.length + ' 项高风险：' + high.map(function (risk) { return risk.term; }).join('、') + '。这些表述没有形成可核验事实，已从确定叙事中隔离。请先补充权威证明，或由品牌方确认文化内涵后修改。\n\n';
  }
  function demoDisclosure(config) { return config.isDemo ? '\n\n——\n仅用于产品原型演示｜鲁香斋为虚构模拟品牌。' : ''; }
  function promotionNote(config) {
    var methods = config.promotionMethods || [];
    if (!methods.length) return '';
    return '【参考宣传方法】' + methods.join('、') + '\n\n';
  }  function buildBrandStory(config) {
    var brand = config.brand || {}, brief = safeBrief(config);
    var history = brief.history ? withRefs(brief.history) : '品牌历史线索待核实';
    var craft = brief.craft.length ? brief.craft.map(withRefs).join('；') : '传统工艺线索待核实';
    var products = brief.products.length ? brief.products.slice(0, 4).map(withRefs).join('；') : '产品信息待核实';
    var philosophy = brief.philosophy ? withRefs(brief.philosophy) : '品牌理念待核实';
    var honor = brief.honors.length ? brief.honors.map(withRefs).join('；') : '品牌荣誉信息待核实';
    var interview = brief.interviews.length ? brief.interviews.map(withRefs).join('；') : '受访内容线索待核实';
    var opening = (config.platform === 'wechat') ? '标题：一块' + (brand.type || '山东老味道') + '，如何把时间里的手艺讲给今天的人？\n\n导语\n' + brand.name + '的故事，不从传奇开场，而从能够回看原文的线索开始。' : '【标题】从' + (brief.history ? brief.history.text.replace(/^[^：]*：/, '').slice(0, 18) : '一段可核验的历史') + '开始，重新认识' + brand.name;
    return promotionNote(config) + riskGate(config) + opening + '\n\n一、故事的起点\n' + history + '。这里不补写年份，也不用无法验证的称号替代品牌自己的时间。\n\n二、手艺如何被看见\n' + craft + '。工艺的价值不在一句“古法”，而在每一步具体动作和它背后的经验。\n\n三、今天的产品\n' + products + '。' + philosophy + '。\n\n四、受访者眼中的责任\n' + interview + '。这段口述只按原意整理；涉及文化内涵和对外表达的部分，由品牌方确认。\n\n五、事实边界\n' + honor + '。所有未提供来源的信息继续保持“待核实”，不进入确定叙事。\n\n结尾\n老字号的新表达，不是把故事讲得更夸张，而是让年轻人听见手艺、产品和传承人的真实选择。 ' + demoDisclosure(config);
  }
  function buildCalendar(config) {
    var brand = config.brand || {}, theme = config.theme || '品牌叙事主题', audience = config.audience || '目标受众';
    var refs = (config.facts || []).filter(function (fact) { return fact.status !== '待核实'; }).map(function (fact) { return fact.id; });
    function range(start, count) { return refs.slice(start, start + count).join('、') || '待补充'; }
    return promotionNote(config) + riskGate(config) + '【内容日历】' + brand.name + '｜' + theme + '\n目标受众：' + audience + '\n策划周期：4周\n\n| 周次 | 叙事主题 | 核心事实 | 小红书 | 抖音 | 公众号 | 品牌确认点 |\n|---|---|---|---|---|---|---|\n| 第1周 | 品牌为什么从这一段历史开始 | ' + range(0, 2) + ' | 图文故事：时间的起点 | 15秒口播：先看档案再看产品 | 长文：从原文理解品牌 | 确认历史年份与原始出处 |\n| 第2周 | 一道工序如何决定一种口感 | ' + range(1, 3) + ' | 工序拆解卡片 | 镜头快切：动作即叙事 | 图解工艺脉络 | 确认工序顺序与专业表述 |\n| 第3周 | 传统产品怎样进入当代生活 | ' + range(3, 3) + ' | 产品体验笔记 | 场景短视频：分享与品尝 | 产品线深度介绍 | 确认产品信息和营养表述 |\n| 第4周 | 传承人与年轻消费者的对话 | ' + range(4, 4) + ' | 访谈金句与问答 | 传承人口述片段 | 人物访谈长文 | 确认受访原意与文化内涵 |\n\n发布原则：每周保留 1 次品牌方事实确认；未经确认的受访解读、文化判断和平台改写不得直接发布。\n\n' + demoDisclosure(config);
  }
  function buildMultiPlatformCopy(config) {
    var brand = config.brand || {}, brief = safeBrief(config);
    var history = brief.history ? withRefs(brief.history) : '品牌历史待核实';
    var craft = brief.craft.length ? brief.craft[0].text + ' [' + brief.craft[0].id + ']' : '工艺信息待核实';
    var product = brief.products.length ? brief.products[0].text + ' [' + brief.products[0].id + ']' : '产品信息待核实';
    var interview = brief.interviews.length ? brief.interviews[0].text + ' [' + brief.interviews[0].id + ']' : '受访内容待补充';
    return promotionNote(config) + riskGate(config) + '【多平台文案】' + brand.name + '\n\n小红书｜标题：原来一块老味道，背后有这么多具体工序\n' + history + '。' + craft + '。如果你也喜欢地方文化，可以先收藏这份事实清单。\n\n抖音｜3秒钩子：老味道不靠编故事。\n口播：先看档案里的' + history + '；再看工艺中的' + craft + '；最后回到今天的产品——' + product + '。\n\n微信公众号｜标题：把老字号讲年轻，先从不补写历史开始\n导语：' + history + '。\n正文线索一：' + craft + '。\n正文线索二：' + product + '。\n受访补充：' + interview + '。\n结语：AI 给出初稿，品牌方确认事实、文化内涵和对外表达。\n\n统一事实引用：' + (brief.history ? brief.history.id : '待补充') + '、' + (brief.craft[0] ? brief.craft[0].id : '待补充') + '、' + (brief.products[0] ? brief.products[0].id : '待补充') + '、' + (brief.interviews[0] ? brief.interviews[0].id : '待补充') + '。\n\n' + demoDisclosure(config);
  }
  function buildYouthPlan(config) {
    var brand = config.brand || {}, brief = safeBrief(config);
    var craft = brief.craft.length ? brief.craft[0].text + ' [' + brief.craft[0].id + ']' : '工艺细节待核实';
    var interview = brief.interviews.length ? brief.interviews[0].text + ' [' + brief.interviews[0].id + ']' : '受访内容待补充';
    var audience = config.audience || '年轻消费者';
    return promotionNote(config) + riskGate(config) + '【年轻化表达方案】' + brand.name + '\n目标受众：' + audience + '\n\n一、表达原则\n1. 先讲具体动作，再讲文化价值。\n2. 先保留原意，再做平台语态转换。\n3. 不用“最正宗、御用、非遗”等未经确认的标签替代真实内容。\n4. AI 生成只作为初稿，品牌方确认事实、文化内涵与对外表达。\n\n二、语态转换表\n| 原有表达 | 年轻化改写方向 | 事实依据 |\n|---|---|---|\n| 传统工序 | “每一步为什么这样做” | ' + craft + ' |\n| 传承责任 | “这一代人在守住什么” | ' + interview + ' |\n| 老字号叙事 | “不靠传奇，先看原文” | ' + (brief.history ? brief.history.id : '待补充') + ' |\n\n三、三种内容人设\n- 事实型：用档案和工序回答问题。\n- 体验型：把产品放回分享、节令和日常场景。\n- 对谈型：让传承人讲述选择，不用旁白替代本人表达。\n\n四、可用开场示例\n“老味道不是一句形容词。今天我们把它拆成几道工序，再从传承人的话里听听，为什么要这样做。”\n\n五、品牌方确认清单\n- 历史年份和出处是否准确。\n- 工艺名称和顺序是否准确。\n- 访谈摘录是否改变原意。\n- 文化解释是否代表品牌立场。\n- 对外表达是否允许发布。\n\n' + demoDisclosure(config);
  }
  function generateContent(config) {
    config = config || {};
    var modelInfo = config.modelInfo || { model: 'local-deterministic-demo', mode: 'local', promptVersion: engine.PROMPT_VERSION };
    var referenced = (config.facts || []).filter(function (fact) { return fact.status !== '待核实'; }).slice(0, 10).map(function (fact) { return fact.id; });
    var highRiskCount = (config.risks || []).filter(function (risk) { return risk.level === 'high'; }).length;
    var createdAt = new Date().toISOString();
    function artifact(id, title, label, content) { return { id: id, title: title, label: label, content: content, originalContent: content, status: highRiskCount ? 'flagged' : 'draft', facts: referenced, methods: config.promotionMethods || [], modelInfo: modelInfo, createdAt: createdAt }; }
    return [
      artifact('story', '品牌故事', '历史 / 工艺 / 受访内容', buildBrandStory(config)),
      artifact('calendar', '内容日历', '四周叙事排期', buildCalendar(config)),
      artifact('copy', '多平台文案', PLATFORM_NAMES[config.platform] || '多平台矩阵', buildMultiPlatformCopy(config)),
      artifact('youth', '年轻化表达方案', '语态转换 / 品牌确认', buildYouthPlan(config))
    ];
  }
  engine.PLATFORM_NAMES = PLATFORM_NAMES;
  engine.TYPE_NAMES = TYPE_NAMES;
  engine.generateContent = generateContent;
}));
