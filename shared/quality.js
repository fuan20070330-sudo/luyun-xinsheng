(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunQuality = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  var PLATFORM_LIMITS = { xiaohongshu: 1000, douyin: 500, wechat: 5000, matrix: 1600 };
  var AI_PHRASES = ['赋能', '打造闭环', '数字化浪潮', '匠心独运', '焕新升级', '让我们共同', '在新时代背景下', '全方位赋能', '深度融合'];

  function countCitations(text) { return (String(text || '').match(/\[F\d{3,}\]/g) || []).length; }
  function countAiPhrases(text) { return AI_PHRASES.filter(function (phrase) { return String(text || '').indexOf(phrase) !== -1; }); }

  function scoreContent(content, options) {
    options = options || {};
    var text = String(content || '');
    var citations = countCitations(text);
    var aiPhrases = countAiPhrases(text);
    var limit = PLATFORM_LIMITS[options.platform] || 3000;
    var tooLong = text.length > limit;
    var paragraphs = text.split(/\n{2,}/).filter(function (item) { return item.trim().length > 8; }).length;
    var concrete = (text.match(/选|蒸|炒|包|烘|工序|档案|资料|场景|用户|分享|口感|产品/g) || []).length;
    var dimensions = {
      evidence: Math.min(100, citations * 14 + 35),
      platformFit: tooLong ? 45 : 88,
      concreteness: Math.min(100, concrete * 5 + 35),
      naturalness: Math.max(40, 100 - aiPhrases.length * 16),
      readability: paragraphs >= 3 ? 88 : 68
    };
    var score = Math.round((dimensions.evidence + dimensions.platformFit + dimensions.concreteness + dimensions.naturalness + dimensions.readability) / 5);
    var issues = [];
    if (!citations) issues.push('缺少 [Fxxx] 事实引用');
    if (tooLong) issues.push('超过平台建议长度 ' + limit + ' 字');
    if (aiPhrases.length) issues.push('含有模板化表达：' + aiPhrases.join('、'));
    if (paragraphs < 3) issues.push('段落结构偏少，建议增加具体场景');
    return { score, level: score >= 85 ? '优秀' : score >= 70 ? '可用' : '需优化', issues, dimensions, citations, limit };
  }

  function buildVariants(content) {
    var lines = String(content || '').split(/\n+/).map(function (line) { return line.trim(); }).filter(Boolean);
    var title = (lines.find(function (line) { return /标题|品牌故事|【/.test(line); }) || lines[0] || '品牌内容方案').replace(/^【|】$/g, '').replace(/^标题[：:｜|]?/, '').trim();
    return {
      titles: [title, title + '：把品牌资料讲成一个具体故事', '从一条可核实的事实开始：' + title].filter(Boolean),
      openings: [
        '先从一条能回到原文的资料开始。',
        '这不是一句空泛的宣传语，而是一段可以核对的品牌记录。',
        '如果只记住一个关键词，我们希望大家先记住这道工序为什么这样做。'
      ]
    };
  }

  return { PLATFORM_LIMITS: PLATFORM_LIMITS, AI_PHRASES: AI_PHRASES, scoreContent: scoreContent, buildVariants: buildVariants };
}));