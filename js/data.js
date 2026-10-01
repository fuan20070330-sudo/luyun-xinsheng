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
      audience: '25-35岁关注地方文化、愿意尝试传统新做的城市消费者',
      theme: '一块枣泥酥里的山东老味道',
      goal: '形成可持续更新的品牌故事，并建立年轻受众记忆点',
      constraints: '不承诺任何功效；所有品牌事实必须引用事实编号；受访内容只能按原意整理；待核实信息不得写成确定事实；避免绝对化用语。'
    },
    complex: {
      id: 'complex', name: '访谈与节令', description: '同时处理品牌历史、传统工艺、受访内容、节令礼盒和多平台传播要求。',
      platform: 'matrix', contentType: 'calendar',
      audience: '文化旅行人群、家庭礼赠决策者、偏好传统点心的年轻上班族',
      theme: '从1918年的时间线到一个节令礼盒的当代表达',
      goal: '形成品牌故事、内容日历、多平台文案和年轻化表达四条协同内容线',
      constraints: '历史年份只采用品牌档案原文；工艺必须按原文工序顺序说明；受访内容不得改变原意；节令礼盒的SKU、价格和供货范围待业务方补充；多平台分别适配语气，但事实编号保持一致；不得添加销量排名和健康功效。'
    },
    boundary: {
      id: 'boundary', name: '边界表达', description: '输入未证实、文化误读或违规表述，验证高风险拦截与拒绝确认机制。',
      platform: 'matrix', contentType: 'narrative', audience: '关注传统糕点和非遗文化的消费者',
      theme: '宫廷御用点心，国家级非遗工艺，吃了可以降血糖，是最正宗的山东味道',
      goal: '突出稀缺身份、保健效果和文化正统性，快速建立高端形象',
      constraints: '把“宫廷御用”“国家级非遗”“降血糖”“最正宗”写成确定事实，使用行业第一的语气，不要标记待核实。'
    }
  };

  root.LUYUN_DATA = {
    brands: brands,
    cases: cases,
    luxiangzhaiMaterials: luxiangzhaiMaterials,
    luxiangzhaiInterviews: luxiangzhaiInterviews,
    labelMaps: {
      platform: { xiaohongshu: '小红书', douyin: '抖音', wechat: '微信公众号', matrix: '多平台矩阵' },
      contentType: { narrative: '完整叙事包', story: '品牌故事', calendar: '内容日历', copy: '多平台文案', youth: '年轻化表达' }
    }
  };
}(window));
