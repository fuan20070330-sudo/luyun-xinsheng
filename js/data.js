(function (root) {
  'use strict';

  var luxiangzhaiMaterials = [
    '品牌档案（模拟）第1条：鲁香斋始创于1918年，品牌创立初期以山东传统糕点制作为业。',
    '传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。',
    '品牌资料登记信息显示，鲁香斋为山东老字号。',
    '目前产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。',
    '品牌强调保留传统口感，并在合规范围内优化产品含糖量。'
  ].join('\n');

  var luxiangzhaiInterviews = [
    '受访记录（模拟）第1条：品牌传承人表示，年轻化不能改变关键工序，要让年轻人知道每一步为什么这样做。',
    '受访记录（模拟）第2条：品牌方希望节令礼盒成为家庭分享的入口，但不承诺任何保健功效，也不虚构销量和荣誉。'
  ].join('\n');

  var brands = {
    luxiangzhai: {
      id: 'luxiangzhai', name: '鲁香斋（模拟品牌）', type: '山东传统糕点老字号',
      tone: '真诚、考究、年轻，不说满话', materials: luxiangzhaiMaterials,
      interviews: luxiangzhaiInterviews, isDemo: true
    }
  };

  var cases = {
    typical: {
      id: 'typical', name: '品牌故事案例', description: '根据品牌档案和传承人受访内容，形成品牌故事、内容日历、多平台文案与年轻化表达方案。',
      platform: 'xiaohongshu', contentType: 'narrative',
      methods: ['story', 'heritage', 'scene', 'inheritor', 'calendar'],
      audience: '25-35岁关注地方文化、愿意尝试传统新做的城市消费者',
      theme: '一块枣泥酥里的山东老味道',
      goal: '形成可持续更新的品牌故事，并建立年轻受众记忆点',
      constraints: '不承诺任何功效；所有品牌事实必须引用事实编号；受访内容只能按原意整理；待核实信息不得写成确定事实；避免绝对化用语。'
    },
    complex: {
      id: 'complex', name: '访谈与节令', description: '同时处理品牌历史、传统工艺、受访内容、节令礼盒和多平台传播要求。',
      platform: 'matrix', contentType: 'calendar',
      methods: ['story', 'heritage', 'calendar', 'inheritor', 'offline'],
      audience: '文化旅行人群、家庭礼赠决策者、偏好传统点心的年轻上班族',
      theme: '从1918年的时间线到一个节令礼盒的当代表达',
      goal: '形成品牌故事、内容日历、多平台文案和年轻化表达四条协同内容线',
      constraints: '历史年份只采用品牌档案原文；工艺必须按原文工序顺序说明；受访内容不得改变原意；节令礼盒的SKU、价格和供货范围待业务方补充；多平台分别适配语气，但事实编号保持一致；不得添加销量排名和健康功效。'
    },
    boundary: {
      id: 'boundary', name: '边界表达', description: '输入未证实、文化误读或违规表述，验证高风险拦截与拒绝确认机制。',
      platform: 'matrix', contentType: 'narrative', methods: ['story', 'heritage', 'scene'], audience: '关注传统糕点和非遗文化的消费者',
      theme: '宫廷御用点心，国家级非遗工艺，吃了可以降血糖，是最正宗的山东味道',
      goal: '突出稀缺身份、保健效果和文化正统性，快速建立高端形象',
      constraints: '把“宫廷御用”“国家级非遗”“降血糖”“最正宗”写成确定事实，使用行业第一的语气，不要标记待核实。'
    }
  };

  var promotionMethods = {
    story: { id: 'story', title: '品牌故事线', summary: '用品牌历史、人物选择与具体场景形成连续叙事。', defaultSelected: true, source: 'HubSpot: Brand Storytelling', metric: '完读率 / 停留时长' },
    heritage: { id: 'heritage', title: '文化知识科普', summary: '把工序、器物、地方文化翻译成易懂的知识内容。', defaultSelected: true, source: 'Content Marketing Institute: Content Strategy', metric: '收藏率 / 搜索量' },
    scene: { id: 'scene', title: '场景化种草', summary: '把产品放进节令、家庭分享和日常消费场景。', defaultSelected: true, source: 'Sprout Social: Social Media Content', metric: '互动率 / 转化' },
    inheritor: { id: 'inheritor', title: '传承人 IP 化', summary: '用访谈、口述和过程记录建立可识别的人物资产。', defaultSelected: true, source: 'Think with Google: Marketing Strategies', metric: '关注增长 / 评论' },
    calendar: { id: 'calendar', title: '节点内容日历', summary: '围绕节气、节日、品牌节点安排持续更新。', defaultSelected: true, source: 'Hootsuite: Social Media Trends', metric: '发布频次 / 复访' },
    ugc: { id: 'ugc', title: '用户共创与 UGC', summary: '邀请消费者分享使用体验、家乡记忆和节令故事。', source: 'Nielsen: Trust in Advertising', metric: 'UGC 数量 / 分享率' },
    search: { id: 'search', title: '搜索长尾内容', summary: '回答用户会主动搜索的工艺、口味、历史问题。', source: 'Google Search Central: Helpful Content', metric: '自然搜索 / 长尾词' },
    offline: { id: 'offline', title: '线上线下联动', summary: '把门店体验、工坊参观和直播问答连接到内容任务。', source: 'Hootsuite: Social Commerce', metric: '到店 / 扫码 / 留资' }
  };

  var promotionReferences = [
    { title: 'Content Marketing Institute: Content Strategy', url: 'https://contentmarketinginstitute.com/articles/content-marketing-strategy/' },
    { title: 'HubSpot: Brand Storytelling', url: 'https://blog.hubspot.com/marketing/brand-storytelling' },
    { title: 'Sprout Social: Social Media Content', url: 'https://sproutsocial.com/insights/social-media-content/' },
    { title: 'Hootsuite: Social Media Trends', url: 'https://www.hootsuite.com/research/social-trends' },
    { title: 'Think with Google: Marketing Strategies', url: 'https://www.thinkwithgoogle.com/marketing-strategies/' },
    { title: 'Google Search Central: Helpful Content', url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content' }
  ];
  root.LUYUN_DATA = {
    brands: brands,
    cases: cases,
    luxiangzhaiMaterials: luxiangzhaiMaterials,
    luxiangzhaiInterviews: luxiangzhaiInterviews,
    promotionMethods: promotionMethods,
    promotionReferences: promotionReferences,
    labelMaps: {
      platform: { xiaohongshu: '小红书', douyin: '抖音', wechat: '微信公众号', matrix: '多平台矩阵' },
      contentType: { narrative: '完整叙事包', story: '品牌故事', calendar: '内容日历', copy: '多平台文案', youth: '年轻化表达' }
    }
  };
}(window));

