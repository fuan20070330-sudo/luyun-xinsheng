'use strict';

const http = require('http');
const https = require('https');
const engine = require('../../shared/generator');

function requestJson(url, options, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const request = transport.request({
      protocol: parsed.protocol,
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': payload.length }, options.headers || {}),
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(raw); } catch (error) { reject(new Error('远程模型返回不是 JSON')); return; }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('远程模型 HTTP ' + response.statusCode + '：' + String(data.error && data.error.message || data.message || '').slice(0, 160)));
          return;
        }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('远程模型请求超时')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function endpointFromBase(base) {
  const clean = String(base || '').replace(/\/+$/, '');
  return /\/chat\/completions$/i.test(clean) ? clean : clean + '/chat/completions';
}

function createAiAdapter(env = {}) {
  const apiUrl = env.AI_API_URL || '';
  const apiKey = env.AI_API_KEY || '';
  const model = env.AI_MODEL || 'gpt-4.1-mini';
  const timeoutMs = Number(env.AI_TIMEOUT_MS || 12000);
  const enabled = !!(apiUrl && apiKey);

  async function generate(payload, risks) {
    if (!enabled) return null;
    const facts = (payload.facts || []).filter((fact) => fact.status !== '待核实');
    const system = [
      '你是老字号叙事工坊的品牌内容助手。',
      '只能把用户提供 facts 数组中的文字当作确定事实，严禁补写年份、荣誉称号、非遗身份、人物、工艺、销量或功效。',
      '无来源信息必须写成“待核实”，高风险表述必须拒绝写成确定事实。',
      '输出 JSON 对象，字段为 story(字符串)、calendar(字符串)、copy(字符串)、youth(字符串)。',
      'story 是品牌故事；calendar 是四周内容日历；copy 是多平台文案；youth 是年轻化表达方案。',
      '所有确定事实后必须保留对应 [Fxxx] 引用编号；品牌方负责确认事实、文化内涵和对外表达。文案要像真实运营稿，避免机械套模板和空泛口号。不要输出 Markdown 代码围栏。'
    ].join('\n');
    const user = JSON.stringify({
      brand: { name: payload.brand.name, type: payload.brand.type, tone: payload.brand.tone },
      platform: payload.platformName,
      contentType: payload.contentTypeName,
      audience: payload.audience,
      theme: payload.theme,
      goal: payload.goal,
      constraints: payload.constraints,
      promotionMethods: payload.promotionMethods || [],
      facts: facts.map((fact) => ({ id: fact.id, category: fact.category, text: fact.text, source: fact.source })),
      detectedRisks: risks.map((risk) => ({ level: risk.level, term: risk.term, reason: risk.reason, suggestion: risk.suggestion }))
    });
    const data = await requestJson(endpointFromBase(apiUrl), { headers: { Authorization: 'Bearer ' + apiKey } }, {
      model: model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    }, timeoutMs);
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('远程模型没有返回内容');
    let parsed;
    try { parsed = JSON.parse(String(text).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); } catch (error) { throw new Error('远程模型内容不是约定 JSON'); }
    const deterministic = engine.generateContent({
      brand: payload.brand, facts: payload.facts, risks: risks, platform: payload.platform,
      contentType: payload.contentType, audience: payload.audience, theme: payload.theme,
      goal: payload.goal, constraints: payload.constraints,
      modelInfo: { model: model, mode: '远程 AI 适配层', promptVersion: engine.PROMPT_VERSION },
      isDemo: payload.isDemo
    });
    ['story', 'calendar', 'copy', 'youth'].forEach((key, index) => {
      if (parsed[key] && String(parsed[key]).trim().length > 20) deterministic[index].content = String(parsed[key]).trim();
      if (parsed[key]) deterministic[index].originalContent = deterministic[index].content;
    });
    return { artifacts: deterministic, modelInfo: { model: model, mode: '远程 AI 适配层', promptVersion: engine.PROMPT_VERSION } };
  }

  return { enabled, model, generate };
}

module.exports = { createAiAdapter, requestJson, endpointFromBase };


