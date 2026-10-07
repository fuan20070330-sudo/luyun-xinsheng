(function (root, factory) {
  var engine = typeof module === 'object' && module.exports ? require('./engine.js') : root.LuyunEngine;
  factory(engine);
  if (typeof module === 'object' && module.exports) module.exports = engine;
}(typeof globalThis !== 'undefined' ? globalThis : this, function (engine) {
  'use strict';
  var PLATFORM_NAMES = { xiaohongshu: '小红书', douyin: '抖音', wechat: '微信公众号', matrix: '多平台矩阵' };
  var TYPE_NAMES = { narrative: '完整叙事包', story: '品牌故事', calendar: '内容日历', copy: '多平台文案', youth: '年轻化表达' };
  function pickByCategory(facts, categories) { var wanted = Array.isArray(categories) ? categories : [categories]; return (facts || []).filter(function (fact) { return wanted.indexOf(fact.category) !== -1 && fact.status !== '待核实'; }); }
  function cleanFact(fact) { if (!fact) return ''; return String(fact.text || '').replace(/^品牌档案（模拟）第\d+条：/, '').replace(/^受访记录（模拟）第\d+条：/, '').replace(/^品牌资料登记信息显示，/, ''); }
  function cite(fact) { return fact ? cleanFact(fact) + ' [' + fact.id + ']' : '待核实'; }
  function safeBrief(config) { var facts = config.facts || []; return { history: pickByCategory(facts, '历史')[0], craft: pickByCategory(facts, '工艺').slice(0, 5), honors: pickByCategory(facts, '荣誉'), products: pickByCategory(facts, '产品'), philosophy: pickByCategory(facts, '品牌理念')[0], interviews: pickByCategory(facts, '访谈洞察').slice(0, 4) }; }
  function methodNames(config) { return config.promotionMethods || []; }
  function safeTheme(config) {
    var theme = config.theme || '一段可以核对的品牌时间';
    var highTerms = (config.risks || []).filter(function (risk) { return risk.level === 'high'; }).map(function (risk) { return risk.term; });
    var unsafe = highTerms.some(function (term) { return theme.indexOf(term) !== -1; });
    return unsafe ? '一段可以核对的品牌时间' : theme;
  }  function methodNote(config) { var methods = methodNames(config); return methods.length ? '【这次借用的办法】' + methods.join('、') + '\n\n' : ''; }
  function riskGate(config) { var high = (config.risks || []).filter(function (risk) { return risk.level === 'high'; }); if (!high.length) return ''; var terms = Array.from(new Set(high.map(function (risk) { return risk.term; }))); return '【这几句先别发】检测到高风险表述：' + terms.join('、') + '。这些内容没有可核验依据，已从确定叙事和对外文案中隔离。需要补充权威证明，或由品牌方修改确认后再发布。\n\n'; }
  function demoDisclosure(config) { return config.isDemo ? '\n\n——\n仅用于产品原型演示｜鲁香斋为虚构模拟品牌。' : ''; }

  function buildBrandStory(config) {
    var brand = config.brand || {}, brief = safeBrief(config), theme = safeTheme(config);
    var history = brief.history ? cite(brief.history) : '品牌历史仍有信息待补';
    var craft = brief.craft.length ? brief.craft.map(cite).join('；') : '工艺细节待品牌方补充';
    var products = brief.products.length ? brief.products.slice(0, 4).map(cite).join('；') : '产品信息待核实';
    var philosophy = brief.philosophy ? cite(brief.philosophy) : '品牌理念待品牌方确认';
    var honor = brief.honors.length ? brief.honors.map(cite).join('；') : '荣誉信息待核实';
    var interview = brief.interviews.length ? brief.interviews.map(cite).join('；') : '受访内容待补充';
    return methodNote(config) + riskGate(config) + '【标题】' + theme + '：' + brand.name + '的一段真实来路\n\n' +
      '如果只看“老字号”三个字，很容易把它写成一段听起来很响、却离人很远的历史。我们更想从能回看原文的地方开始。\n\n' +
      '一、从旧档里找一句话\n' + history + '。这行资料是故事的起点，也提醒我们：年份、身份和荣誉不能凭感觉补写。\n\n' +
      '二、手艺要落到动作上\n' + craft + '。真正打动人的，往往不是“古法”两个字，而是选料、火候、等待和手上反复练习出来的分寸。\n\n' +
      '三、今天的人怎么吃它\n' + products + '。' + philosophy + '。传统口味进入当代生活，不一定要先变成潮流，它可以先变得更好理解、更好分享。\n\n' +
      '四、听传承人自己说\n\u201c' + interview + '\u201d\n这段话只按受访原意整理。品牌方需要确认：哪些属于历史事实，哪些是个人判断，哪些可以对外表达。\n\n' +
      '五、哪些话还不能写死\n' + honor + '。没有原文来源的信息继续保持“待核实”，不进入确定叙事。\n\n' +
      '结语\n老字号被年轻人看见，不一定靠更夸张的标题，而可以靠一句更诚实的话：这道工序为什么这样做，这代人为什么还愿意接着做。 ' + demoDisclosure(config);
  }

  function buildCalendar(config) {
    var brand = config.brand || {}, brief = safeBrief(config), theme = safeTheme(config);
    var methods = methodNames(config);
    var feedback = config.performanceFeedback || [];
    var history = brief.history ? cite(brief.history) : '历史事实待补充';
    var craft = brief.craft.length ? cite(brief.craft[0]) : '工艺事实待补充';
    var product = brief.products.length ? cite(brief.products[0]) : '产品事实待补充';
    var interview = brief.interviews.length ? cite(brief.interviews[0]) : '访谈事实待补充';
    return methodNote(config) + riskGate(config) + '【内容日历】' + brand.name + '｜' + theme + '\n规划原则：先用事实建立信任，再用场景让人愿意收藏和分享。' + (methods.length ? '本次内容优先参考：' + methods.join('、') + '。' : '') + (feedback.length ? '上一轮效果回流：' + feedback.join('；') + '。' : '') + '\n\n' +
      '第1周｜把品牌放进时间线里\n内容任务：讲清楚品牌从哪段可核验的资料开始，不补写传奇。\n参考事实：' + history + '\n小红书：档案局部图＋一段时间故事；抖音：15秒内展示“原文如何变成品牌叙事”；公众号：解释历史事实与品牌记忆的关系。\n品牌确认：年份、称号和原始出处。\n\n' +
      '第2周｜让工艺变成看得见的动作\n内容任务：选择一道最有识别度的工序，用动作、工具和等待时间讲清楚。\n参考事实：' + craft + '\n小红书：工序拆解卡片；抖音：从原料到成品的节奏快切；公众号：工艺图解与文化解释。\n品牌确认：工序顺序、术语和专业细节。\n\n' +
      '第3周｜把产品放回真实生活\n内容任务：不强调功效，只回答“什么时候吃、和谁分享、为什么适合带去”。\n参考事实：' + product + '\n小红书：节令分享笔记；抖音：家庭分享或下午茶场景；公众号：产品线如何保留传统口感。\n品牌确认：产品信息、含糖表述和销售边界。\n\n' +
      '第4周｜让传承人自己说话\n内容任务：围绕一个选择提问，不把旁白写成传承人的观点。\n参考事实：' + interview + '\n小红书：受访金句＋问答；抖音：口述片段；公众号：人物访谈长文。\n品牌确认：是否改变受访原意，文化内涵是否代表品牌立场。\n\n' +
      '执行建议：每周保留一次品牌方确认；同一事实编号跨平台复用，但标题、开场和呈现方式分别改写。\n\n' + demoDisclosure(config);
  }

  function buildMultiPlatformCopy(config) {
    var brand = config.brand || {}, brief = safeBrief(config);
    var history = brief.history ? cite(brief.history) : '品牌历史待核实';
    var craft = brief.craft.length ? cite(brief.craft[0]) : '工艺信息待核实';
    var product = brief.products.length ? cite(brief.products[0]) : '产品信息待核实';
    var interview = brief.interviews.length ? cite(brief.interviews[0]) : '受访内容待补充';
    return methodNote(config) + riskGate(config) + '【小红书】\n标题｜原来一块老味道，背后是这么具体的手艺\n正文｜\n最近重新认识' + brand.name + '。\n' +
      '我先记住的不是一句“老字号”，而是一条能回到原文的资料：' + history + '。\n再往下看工艺，' + craft + '。这些动作听起来不热闹，却决定了一口点心最后是什么口感。\n' +
      '今天的' + product + '，更像是在把传统味道放回日常：和家人分着吃，当节令小礼，或者只是给下午留一点慢慢吃的时间。\n我把事实编号也留在稿子里，品牌方确认后再对外发布。\n#山东老字号 #地方文化 #传统点心\n\n' +
      '【抖音 30秒脚本】\n0-3秒｜特写：糕点切开，字幕“老味道，不靠编故事”。\n口播：一块点心为什么值得重新讲？先看它的来路。\n3-12秒｜画面：档案局部、年份字样、资料标注。\n口播：' + history + '。\n12-24秒｜画面：按工序顺序快切，每道动作只留一个特写。\n口播：' + craft + '。不是一句“古法”，而是每一步都有原因。\n24-30秒｜画面：成品与分享场景。\n口播：' + product + '。老字号的新表达，先把事实说清楚。\n\n' +
      '【微信公众号】\n标题｜把老字号讲年轻，先从不替品牌编故事开始\n导语：关于' + brand.name + '，我们先把能够回看原文的部分整理出来：' + history + '。\n01｜一段历史，不等于一段传奇\n公众号长文应当区分品牌档案、个人判断和传播改写，避免把“可能”写成“确定”。\n02｜工艺要落到动作里\n' + craft + '。具体工序比抽象形容词更能建立信任。\n03｜产品要回到生活\n' + product + '。与其强调夸张卖点，不如回答消费者在什么场景下需要它。\n04｜把受访者放在叙事中心\n' + interview + '。品牌方确认原意和文化内涵后，再决定对外表达。\n\n' +
      '统一事实引用：' + (brief.history ? brief.history.id : '待补充') + '、' + (brief.craft[0] ? brief.craft[0].id : '待补充') + '、' + (brief.products[0] ? brief.products[0].id : '待补充') + '、' + (brief.interviews[0] ? brief.interviews[0].id : '待补充') + '。\n\n' + demoDisclosure(config);
  }

  function buildYouthPlan(config) {
    var brand = config.brand || {}, brief = safeBrief(config), methods = methodNames(config);
    var craft = brief.craft.length ? cite(brief.craft[0]) : '工艺细节待核实';
    var interview = brief.interviews.length ? cite(brief.interviews[0]) : '受访内容待补充';
    var audience = config.audience || '年轻消费者';
    return methodNote(config) + riskGate(config) + '【年轻化表达方案】' + brand.name + '\n目标受众：' + audience + '\n\n' +
      '先说一句实在话：年轻化不是把老字号硬说成潮流，而是把“为什么值得记住”讲得更具体、更好懂。\n\n' +
      '落笔前记住四件事：\n具体动作＋真实来源＋当代场景＋品牌方确认。\n不要先喊“匠心”，先说清楚谁在做什么、为什么这样做；不要把“非遗、御用、最正宗”等未经确认的标签当成文化价值。\n\n' +
      '【语态转换示例】\n“传统工艺” → “这道工序为什么要等这么久？”｜依据：' + craft + '\n“传承责任” → “这一代人为什么还愿意接着做？”｜依据：' + interview + '\n“老字号历史” → “不急着讲传奇，先从档案里的那句话开始。”｜依据：' + (brief.history ? brief.history.id : '待补充') + '\n\n' +
      '三种开场，可以直接接着写：\n1. 一块老味道，先别急着夸。我们从它在档案里的第一句话看起。\n2. 你以为老字号只有“传统”两个字？其实每一步工序都有自己的原因。\n3. 这次不讲神秘配方，只听传承人怎么说，再看产品怎么走进今天的生活。\n\n' +
      '账号可以用三种口吻：\n事实型：用档案和工序回答问题；体验型：把产品放回节令、分享和日常场景；对谈型：让传承人自己讲述选择，不让旁白替代本人。\n\n' +
      '怎么排更顺：\n' + (methods.length ? '先这么配：' + methods.join('、') + '。' : '建议至少选择品牌故事线、文化知识科普和场景化种草。') + '\n每周保留一个可回答的问题，不用一次把所有历史说完。\n\n' +
      '请品牌方过目：\n□ 历史年份和出处是否准确\n□ 工艺名称和顺序是否准确\n□ 采访摘录是否改变原意\n□ 文化解释是否代表品牌立场\n□ 对外表达是否允许发布\n\n' + demoDisclosure(config);
  }

  function generateContent(config) {
    config = config || {};
    var modelInfo = config.modelInfo || { model: 'local-deterministic-demo', mode: 'local', promptVersion: engine.PROMPT_VERSION };
    var referenced = (config.facts || []).filter(function (fact) { return fact.status !== '待核实'; }).slice(0, 10).map(function (fact) { return fact.id; });
    var highRiskCount = (config.risks || []).filter(function (risk) { return risk.level === 'high'; }).length;
    var createdAt = new Date().toISOString();
    function artifact(id, title, label, content) { return { id: id, title: title, label: label, content: content, originalContent: content, status: highRiskCount ? 'flagged' : 'draft', facts: referenced, methods: methodNames(config), modelInfo: modelInfo, createdAt: createdAt }; }
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


