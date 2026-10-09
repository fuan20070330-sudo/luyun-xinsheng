(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunEngine = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var PROMPT_VERSION = 'brand-safe-narrative-v3.0';
  var SOURCE_AUTHORITY = {
    official: { score: 5, label: '官方登记或权威证书' },
    certificate: { score: 4, label: '品牌证书或正式文件' },
    brand: { score: 3, label: '品牌自有资料' },
    media: { score: 3, label: '公开报道或出版物' },
    interview: { score: 2, label: '受访口述' },
    user: { score: 1, label: '用户整理资料' },
    inference: { score: 0, label: 'AI 推测' }
  };
  function authorityFor(options) {
    options = options || {};
    var key = options.sourceDocument && options.sourceDocument.authority || options.sourceAuthority || 'user';
    return SOURCE_AUTHORITY[key] || SOURCE_AUTHORITY.user;
  }
  function evidenceLevelFor(authority, verified) {
    if (verified) return authority.score >= 4 ? '强' : authority.score >= 3 ? '中' : '弱';
    if (authority.score >= 4) return '来源较强（待核验）';
    if (authority.score >= 3) return '来源中等（待核验）';
    return '来源较弱（待核验）';
  }
  var CATEGORIES = ['历史', '工艺', '荣誉', '人物', '产品', '品牌理念', '访谈洞察'];
  var CATEGORY_TERMS = {
    '历史': ['创立', '始创', '创建', '始于', '年', '年代', '历史', '传承', '成立', '老字号', '字号'],
    '工艺': ['工艺', '工序', '制作', '选枣', '蒸制', '炒馅', '包制', '烘烤', '手工', '古法', '秘方', '技艺'],
    '荣誉': ['荣誉', '老字号', '非遗', '奖', '认证', '证书', '称号', '登记', '协会', '品牌'],
    '人物': ['创始人', '传承人', '师傅', '人物', '先生', '女士', '第四代', '第五代', '技师'],
    '产品': ['产品', '枣泥酥', '山楂锅盔', '桂花酥', '礼盒', '口味', '含糖', '配料', '包装', '糕', '酥'],
    '品牌理念': ['理念', '坚持', '强调', '希望', '注重', '使命', '价值', '保留', '优化', '真诚', '品牌'],
    '访谈洞察': ['受访', '访谈', '口述', '传承人表示', '品牌方希望', '回忆', '讲述', '责任', '年轻人']
  };

  function normalizeText(value) {
    return String(value == null ? '' : value).replace(/\r\n?/g, '\n').replace(/[ \t]+/g, ' ').trim();
  }

  function splitText(value) {
    var text = normalizeText(value);
    if (!text) return [];
    return text.split(/\n+|(?<=[。！？；!?;])/g).map(function (item) {
      return item.replace(/^[\s\-*#\d.、]+/, '').trim();
    }).filter(function (item) { return item.length >= 4; });
  }

  function classifySentence(sentence) {
    var scores = {};
    CATEGORIES.forEach(function (category) {
      scores[category] = 0;
      CATEGORY_TERMS[category].forEach(function (term) {
        if (sentence.indexOf(term) !== -1) scores[category] += term.length >= 3 ? 2 : 1;
      });
    });
    if (/\b(18|19|20)\d{2}\b/.test(sentence)) scores['历史'] += 3;
    if (/工序|制作|烘烤|炒馅|蒸制/.test(sentence)) scores['工艺'] += 3;
    if (/产品包括|礼盒|口味|含糖量/.test(sentence)) scores['产品'] += 2;
    if (/品牌强调|品牌理念|保留.*口感|优化.*含糖/.test(sentence)) scores['品牌理念'] += 6;
    if (/受访|访谈|口述|传承人表示|品牌方希望/.test(sentence)) scores['访谈洞察'] += 4;
    var winner = '品牌理念';
    var best = 0;
    CATEGORIES.forEach(function (category) {
      if (scores[category] > best) { best = scores[category]; winner = category; }
    });
    return best === 0 ? '品牌理念' : winner;
  }

  function confidenceFor(sentence, sourceName) {
    var score = 0.68;
    if (/\b(18|19|20)\d{2}\b/.test(sentence)) score += 0.12;
    if (/档案|资料|登记|证书|记录|原文|品牌说明/.test(sentence + sourceName)) score += 0.12;
    if (/受访|访谈|口述|传承人表示|品牌方希望/.test(sentence + sourceName)) score += 0.08;
    if (sentence.length >= 18) score += 0.04;
    if (sentence.length >= 45) score -= 0.03;
    return Math.max(0.55, Math.min(0.98, Number(score.toFixed(2))));
  }

  function extractFacts(materials, options) {
    options = options || {};
    var sourceName = options.sourceName || '用户提交品牌资料';
    var lines = splitText(materials);
    var categoryCount = {};
    var facts = [];
    lines.forEach(function (sentence) {
      var category = classifySentence(sentence);
      var source = sourceName + '：' + sentence;
      var confidence = confidenceFor(sentence, sourceName);
      var authority = authorityFor(options);
      categoryCount[category] = (categoryCount[category] || 0) + 1;
      facts.push({
        id: 'F' + String(facts.length + 1).padStart(3, '0'),
        category: category,
        text: sentence,
        statement: sentence,
        source: source,
        sourceExcerpt: sentence,
        sourceLocation: '原文第' + (facts.length + 1) + '条',
        sourceDocumentId: options.sourceDocument && options.sourceDocument.id || '',
        sourceDocumentName: options.sourceDocument && options.sourceDocument.name || sourceName,
        sourceHash: options.sourceDocument && options.sourceDocument.hash || '',
        sourceAuthority: authority.label,
        sourceAuthorityScore: authority.score,
        evidenceLevel: evidenceLevelFor(authority, false),
        verificationStatus: '待核验',
        verificationMethod: 'not-verified',
        verifiedAt: '',
        verifiedBy: '',
        revision: 1,
        confirmedBy: '',
        confirmedAt: '',
        updatedAt: new Date().toISOString(),
        extractionConfidence: confidence,
        confidence: confidence,
        status: confidence >= 0.7 ? '已提取' : '待核实'
      });
    });
    CATEGORIES.forEach(function (category) {
      if (!categoryCount[category]) {
        facts.push({
          id: 'F' + String(facts.length + 1).padStart(3, '0'),
          category: category,
          text: '暂未从资料中提取到' + category + '相关线索',
          statement: '暂未从资料中提取到' + category + '相关线索',
          source: '未找到来源',
          sourceExcerpt: '',
          sourceLocation: '未找到来源',
          sourceDocumentId: '',
          sourceDocumentName: '',
          sourceHash: '',
          sourceAuthority: '无来源',
          sourceAuthorityScore: 0,
          evidenceLevel: '无来源',
          verificationStatus: '待核验',
          verificationMethod: 'no-source',
          verifiedAt: '',
          verifiedBy: '',
          revision: 1,
          confirmedBy: '',
          confirmedAt: '',
          updatedAt: new Date().toISOString(),
          extractionConfidence: 0,
          confidence: 0,
          status: '待核实'
        });
      }
    });
    return facts.sort(function (a, b) { return a.id.localeCompare(b.id); });
  }

  function detectConflicts(facts) {
    var historyFacts = (facts || []).filter(function (fact) { return fact.category === '历史' && fact.status !== '待核实'; });
    var foundingYears = {};
    historyFacts.forEach(function (fact) {
      var match = String(fact.text || '').match(/(?:始创|创立|创始|创建|始于|成立于)[^0-9]{0,8}((?:18|19|20)\d{2})/);
      if (match) foundingYears[match[1]] = (foundingYears[match[1]] || []).concat(fact.id);
    });
    var years = Object.keys(foundingYears);
    if (years.length < 2) return [];
    return [{
      id: 'C001',
      type: '品牌创立年份冲突',
      level: 'high',
      terms: years,
      factRefs: Object.values(foundingYears).reduce(function (all, ids) { return all.concat(ids); }, []),
      reason: '品牌历史中存在多个不同的创立年份：' + years.join('、') + '。',
      suggestion: '请品牌方确认唯一权威来源，其余年份标记为待核实或删除。',
      createdAt: new Date().toISOString()
    }];
  }

  function factTextByCategory(facts, categories) {
    var wanted = Array.isArray(categories) ? categories : [categories];
    return (facts || []).filter(function (fact) {
      return wanted.indexOf(fact.category) !== -1 && fact.status !== '待核实';
    }).map(function (fact) { return fact.text; });
  }

  function supportedByFacts(term, facts) {
    var clean = term.replace(/[“”"']/g, '');
    return (facts || []).some(function (fact) {
      return fact.status !== '待核实' && fact.text.indexOf(clean) !== -1;
    });
  }

  function pushRisk(list, keySet, risk) {
    var key = risk.type + '|' + risk.term + '|' + risk.location;
    if (keySet[key]) return;
    keySet[key] = true;
    risk.id = 'R' + String(list.length + 1).padStart(3, '0');
    risk.ruleVersion = 'luyun-risk-1.0';
    risk.legalRef = risk.legalRef || '广告法、食品安全法、平台规则与品牌证据边界初筛';
    risk.createdAt = new Date().toISOString();
    list.push(risk);
  }

  function detectRisks(input) {
    input = input || {};
    var sources = [
      { location: '品牌资料', text: normalizeText(input.materials) },
      { location: '限制条件', text: normalizeText(input.constraints) },
      { location: '传播主题', text: normalizeText(input.theme) },
      { location: '内容目标', text: normalizeText(input.goal) }
    ].filter(function (item) { return item.text; });
    var facts = input.facts || [];
    var risks = [];
    var keys = {};

    var medicalTerms = ['降血糖', '降血压', '降血脂', '治疗', '治愈', '根治', '疗效', '药用', '防癌', '抗癌', '增强免疫力'];
    var credentialTerms = ['国家级非遗', '国家级非物质文化遗产', '中华老字号', '驰名商标', '宫廷御用', '御用贡品', '皇室专供'];
    var superlativeTerms = ['全国第一', '行业唯一', '最好', '最佳', '绝对安全', '纯天然', '零添加', '100%有效'];
    var craftTerms = ['古法秘制', '宫廷秘方', '独家秘方', '纯手工', '百年秘方'];
    var nutritionTerms = ['低糖', '无糖'];
    var culturalTerms = ['最正宗', '唯一正统', '正宗嫡传', '祖传秘制', '失传技艺', '原汁原味'];

    sources.forEach(function (source) {
      medicalTerms.forEach(function (term) {
        if (source.text.indexOf(term) === -1) return;
        pushRisk(risks, keys, {
          type: '医疗功效', level: 'high', term: term, location: source.location,
          quote: findContext(source.text, term), reason: '食品宣传不得直接或暗示疾病预防、治疗或保健功效；该表述需要医学与广告合规审查。',
          suggestion: '删除功效承诺；如需描述产品特点，只能使用已核实的配料、口感或含糖量事实。',
          factRefs: []
        });
      });
      credentialTerms.forEach(function (term) {
        if (source.text.indexOf(term) === -1) return;
        pushRisk(risks, keys, {
          type: '荣誉或身份真实性', level: 'high', term: term, location: source.location,
          quote: findContext(source.text, term), reason: '该称号、身份或历史背景未在知识库中提供可核验的授予机构、证书编号或权威来源。',
          suggestion: '在取得证书、发文或主管部门证明前，不得作为确定事实；改为“待核实”并交由品牌方确认。',
          factRefs: findMatchingFactIds(term, facts)
        });
      });
      if (source.text.indexOf('宫廷') !== -1 && source.text.indexOf('宫廷御用') === -1) {
        pushRisk(risks, keys, {
          type: '无法验证的历史或工艺描述', level: 'high', term: '宫廷', location: source.location,
          quote: findContext(source.text, '宫廷'), reason: '该描述带有身份背书或历史暗示，资料中没有可核验原文。',
          suggestion: '删除背书式表达，或先补充可公开核验的原始资料。', factRefs: []
        });
      }
      superlativeTerms.forEach(function (term) {
        if (source.text.indexOf(term) === -1) return;
        var supported = supportedByFacts(term, facts);
        pushRisk(risks, keys, {
          type: '绝对化宣传', level: supported ? 'medium' : 'high', term: term, location: source.location,
          quote: findContext(source.text, term), reason: '极限化用语容易构成无法证实的竞争优势承诺，需要审查依据和适用边界。',
          suggestion: '改为可量化的相对表达，并附检测报告、批准文件或数据来源；无法证明时删除。',
          factRefs: findMatchingFactIds(term, facts)
        });
      });
      craftTerms.forEach(function (term) {
        if (source.text.indexOf(term) === -1) return;
        pushRisk(risks, keys, {
          type: '无法验证的工艺描述', level: 'medium', term: term, location: source.location,
          quote: findContext(source.text, term), reason: '“秘方”“纯手工”等描述无法从当前品牌资料中验证，且可能影响消费者判断。',
          suggestion: '补充工艺流程、生产记录或权威认定；否则改为不含排他性和稀缺性暗示的表述。',
          factRefs: findMatchingFactIds(term, facts)
        });
      });
      culturalTerms.forEach(function (term) {
        if (source.text.indexOf(term) === -1) return;
        pushRisk(risks, keys, {
          type: '文化内涵或正统性表述', level: 'high', term: term, location: source.location,
          quote: findContext(source.text, term), reason: '该表述暗示唯一、正统、祖传或失传等文化身份，但当前资料没有提供可核验的历史依据和文化确认。',
          suggestion: '删除正统性和稀缺性暗示；由品牌方补充历史依据、传承谱系或文化内涵说明后再改写。',
          factRefs: findMatchingFactIds(term, facts)
        });
      });
      nutritionTerms.forEach(function (term) {
        if (source.text.indexOf(term) === -1) return;
        pushRisk(risks, keys, {
          type: '营养健康表述', level: 'medium', term: term, location: source.location,
          quote: findContext(source.text, term), reason: '“低糖/无糖”涉及食品安全标准中的营养声称，需核对检测结果与标签条件。',
          suggestion: '核对 GB 28050 等适用标准及检测报告；未完成核验前改为“优化含糖量”等产品方向描述。',
          factRefs: findMatchingFactIds(term, facts)
        });
      });
      var years = source.text.match(/\b(?:18|19|20)\d{2}\b/g) || [];
      Array.from(new Set(years)).forEach(function (year) {
        if (supportedByFacts(year, facts)) return;
        pushRisk(risks, keys, {
          type: '无依据年份', level: 'high', term: year, location: source.location,
          quote: findContext(source.text, year), reason: '知识库事实中没有与该年份直接对应的可靠原文，AI 不得补全品牌时间线。',
          suggestion: '补充品牌档案、方志、史志或工商登记等来源；否则删除该年份或标记“待核实”。',
          factRefs: []
        });
      });
    });
    return risks;
  }

  function findContext(text, term) {
    var index = text.indexOf(term);
    if (index < 0) return '';
    var start = Math.max(0, index - 22);
    var end = Math.min(text.length, index + term.length + 28);
    return (start > 0 ? '…' : '') + text.slice(start, end).trim() + (end < text.length ? '…' : '');
  }

  function findMatchingFactIds(term, facts) {
    return (facts || []).filter(function (fact) {
      return fact.status !== '待核实' && fact.text.indexOf(term) !== -1;
    }).map(function (fact) { return fact.id; });
  }

  function runRoleReview(input) {
    input = input || {};
    var facts = input.facts || [];
    var risks = input.risks || [];
    var pending = facts.filter(function (fact) { return fact.status === '待核实'; });
    var high = risks.filter(function (risk) { return risk.level === 'high'; });
    var culture = high.filter(function (risk) { return /文化|荣誉|身份/.test(risk.type || ''); });
    var compliance = high.filter(function (risk) { return /医疗|功效|绝对化|营养/.test(risk.type || ''); });
    return [
      { id: 'archivist', title: '档案员审查', status: pending.length ? 'warn' : 'pass', summary: pending.length ? '有 ' + pending.length + ' 条事实缺少来源，需品牌方补充。' : '事实均有来源记录。', evidence: pending.map(function (fact) { return fact.id; }).join('、') || facts.slice(0, 4).map(function (fact) { return fact.id; }).join('、'), action: '确认原文、年份和来源位置' },
      { id: 'brand-editor', title: '品牌编辑', status: 'pass', summary: '已按品牌语气生成候选稿，保留 AI 原稿，等待品牌方修改。', evidence: input.theme || '品牌叙事主题', action: '确认品牌语气和文化内涵' },
      { id: 'platform-editor', title: '平台编辑', status: 'pass', summary: '已分别生成小红书、抖音、公众号和多平台表达结构。', evidence: input.platformName || '多平台矩阵', action: '调整字数、标题和平台节奏' },
      { id: 'culture-reviewer', title: '文化审查', status: culture.length ? 'block' : 'pass', summary: culture.length ? '发现 ' + culture.length + ' 项文化身份或正统性表述需核验。' : '未发现未证实的文化身份表述。', evidence: culture.map(function (risk) { return risk.term; }).join('、') || '文化表述待最终确认', action: '确认祖传、非遗、御用等表述' },
      { id: 'compliance-reviewer', title: '合规审查', status: compliance.length ? 'block' : 'pass', summary: compliance.length ? '发现 ' + compliance.length + ' 项医疗、功效或绝对化风险。' : '未发现医疗功效或绝对化宣传风险。', evidence: compliance.map(function (risk) { return risk.term; }).join('、') || '无高风险词', action: '高风险内容修改后重新确认' }
    ];
  }  return {
    PROMPT_VERSION: PROMPT_VERSION,
    CATEGORIES: CATEGORIES,
    SOURCE_AUTHORITY: SOURCE_AUTHORITY,
    normalizeText: normalizeText,
    splitText: splitText,
    extractFacts: extractFacts,
    detectRisks: detectRisks,
    supportedByFacts: supportedByFacts,
    factTextByCategory: factTextByCategory,
    detectConflicts: detectConflicts,
    findMatchingFactIds: findMatchingFactIds,
    runRoleReview: runRoleReview
  };
}));





