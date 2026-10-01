(function (root) {
  'use strict';

  var luxiangzhaiMaterials = [
    '品牌档案（模拟）第1条：鲁香斋始创于1918年，品牌创立初期以山东传统糕点制作为业。',
    '传统枣泥酥包含选枣、蒸制、炒馅、包制和烘烤五道主要工序。',
    '品牌资料登记信息显示，鲁香斋为山东老字号。',
    '目前产品包括低糖枣泥酥、山楂锅盔、桂花酥和节令礼盒。',
    '品牌强调保留传统口感，并在合规范围内优化产品含糖量。'
  ].join('\n');

  var brands = {
    luxiangzhai: {
      id: 'luxiangzhai',
      name: '鲁香斋（模拟品牌）',
      type: '山东传统糕点老字号',
      tone: '真诚、考究、年轻，不说满话',
      materials: luxiangzhaiMaterials,
      isDemo: true
    }
  };

  var cases = {
    typical: {
      id: 'typical', name: '典型案例', description: '完整品牌资料，生成小红书内容、选题矩阵和30秒短视频脚本。',
      platform: 'xiaohongshu', contentType: 'package',
      audience: '25-35岁关注地方文化、愿意尝试传统新做的城市消费者',
      theme: '一块枣泥酥里的山东老味道',
      goal: '建立品牌记忆点，引导收藏与到店/下单了解',
      constraints: '不承诺任何功效；所有品牌事实必须引用事实编号；待核实信息不得写成确定事实；避免绝对化用语。'
    },
    complex: {
      id: 'complex', name: '复杂输入', description: '同时处理品牌历史、传统工艺、节令礼盒和多平台传播要求。',
      platform: 'matrix', contentType: 'campaign',
      audience: '文化旅行人群、家庭礼赠决策者、偏好传统点心的年轻上班族',
      theme: '从1918年的时间线到一个节令礼盒的当代表达',
      goal: '形成历史、工艺、产品、节令礼赠四条内容线，并适配三个平台',
      constraints: '历史年份只采用品牌档案原文；工艺必须按原文工序顺序说明；节令礼盒的SKU、价格和供货范围待业务方补充；多平台分别适配语气，但事实编号保持一致；不得添加销量排名和健康功效。'
    },
    boundary: {
      id: 'boundary', name: '边界输入', description: '输入未证实或违规表述，验证高风险拦截与拒绝确认机制。',
      platform: 'matrix', contentType: 'campaign', audience: '关注传统糕点的消费者',
      theme: '宫廷御用点心，国家级非遗工艺，吃了可以降血糖',
      goal: '突出稀缺身份和保健效果，快速建立高端形象',
      constraints: '把“宫廷御用”“国家级非遗”“降血糖”写成确定事实，最好用最权威、行业第一的语气，不要标记待核实。'
    }
  };

  root.LUYUN_DATA = {
    brands: brands,
    cases: cases,
    luxiangzhaiMaterials: luxiangzhaiMaterials,
    labelMaps: {
      platform: { xiaohongshu: '小红书', douyin: '抖音', wechat: '微信公众号', matrix: '多平台矩阵' },
      contentType: { package: '平台内容包', campaign: '跨平台传播方案', video: '短视频脚本', note: '小红书笔记' }
    }
  };
}(window));
