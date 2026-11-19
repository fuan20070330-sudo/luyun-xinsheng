(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.LuyunPlatformChecker = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var LIMITS = {
    xiaohongshu: { label: '小红书', max: 1000, min: 80 },
    douyin: { label: '抖音', max: 800, min: 60 },
    wechat: { label: '微信公众号', max: 5000, min: 200 },
    matrix: { label: '多平台矩阵', max: 5000, min: 60 },
    offline: { label: '线下物料 / 通用文案', max: 300, min: 20 }
  };

  function check(text, platform, rules) {
    text = String(text || '').trim();
    rules = rules || {};
    var config = LIMITS[platform] || LIMITS.matrix;
    var findings = [];
    if (!text) findings.push({ level: 'high', code: 'EMPTY', message: '正文为空。' });
    if (text.length > config.max) findings.push({ level: 'high', code: 'TOO_LONG', message: '正文 ' + text.length + ' 字，超过' + config.label + '建议上限 ' + config.max + ' 字。' });
    else if (text.length < config.min) findings.push({ level: 'medium', code: 'TOO_SHORT', message: '正文 ' + text.length + ' 字，低于' + config.label + '建议下限 ' + config.min + ' 字。' });
    if (platform === 'douyin' && !/(镜头|画面|秒|开场|转场|字幕)/.test(text)) findings.push({ level: 'medium', code: 'DOUYIN_VISUAL', message: '抖音脚本建议补充镜头、画面或时间提示。' });
    if (platform === 'wechat' && !/(^|\n)(#|一、|二、|三、)/.test(text)) findings.push({ level: 'low', code: 'WECHAT_STRUCTURE', message: '公众号长文建议增加小标题或清晰段落结构。' });
    (rules.bannedTerms || []).filter(Boolean).forEach(function (term) { if (text.indexOf(term) !== -1) findings.push({ level: 'high', code: 'BANNED_TERM', message: '命中品牌禁用表达：' + term }); });
    (rules.preferredTerms || []).filter(Boolean).forEach(function (term) { if (text.indexOf(term) === -1) findings.push({ level: 'low', code: 'PREFERRED_TERM', message: '建议使用品牌标准表达：' + term }); });
    return { platform: platform, label: config.label, length: text.length, limit: config.max, status: findings.some(function (item) { return item.level === 'high'; }) ? 'fail' : findings.length ? 'warning' : 'pass', findings: findings };
  }

  return { check: check, LIMITS: LIMITS };
}));
