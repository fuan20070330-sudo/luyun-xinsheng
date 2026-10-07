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
      method: options.method || 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': payload.length }, options.headers || {}),
      timeout: timeoutMs
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        let data;
        try { data = JSON.parse(raw); } catch (error) { reject(new Error('模型返回内容不是 JSON')); return; }
        if (response.statusCode < 200 || response.statusCode >= 300) {
          reject(new Error('模型接口 HTTP ' + response.statusCode + '：' + String(data.error && data.error.message || data.message || '').slice(0, 180)));
          return;
        }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('模型请求超时')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

function trimSlash(value) { return String(value || '').replace(/\/+$/, ''); }
function responsesEndpoint(base) { const clean = trimSlash(base); return /\/responses$/i.test(clean) ? clean : clean + '/responses'; }
function chatEndpoint(base) { const clean = trimSlash(base); return /\/chat\/completions$/i.test(clean) ? clean : clean + '/chat/completions'; }
function extractResponseText(data) {
  if (data && typeof data.output_text === 'string' && data.output_text.trim()) return data.output_text;
  const output = data && Array.isArray(data.output) ? data.output : [];
  for (const item of output) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content) if (part && typeof part.text === 'string' && part.text.trim()) return part.text;
  }
  return '';
}
function parseJsonText(text) { return JSON.parse(String(text || '').replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')); }

const OUTPUT_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['story', 'calendar', 'copy', 'youth'],
  properties: { story: { type: 'string' }, calendar: { type: 'string' }, copy: { type: 'string' }, youth: { type: 'string' } }
};

function buildPrompt(payload, risks) {
  const facts = (payload.facts || []).filter((fact) => fact.status !== '待核实');
  const system = [
    '你是一名资深品牌内容编辑，面向山东老字号、非遗品牌和文创品牌。',
    '你只能使用 facts 数组中列出的信息作为确定事实，不能补写年份、荣誉称号、非遗身份、人物、销量、工艺细节或健康功效。',
    '没有来源的信息必须写成“待核实”，高风险表述必须隔离，不能写成品牌事实。',
    '写作要求：语言自然、具体、克制，像真实编辑写的品牌稿；多用名词、动作和场景，少用空泛口号。',
    '避免明显的 AI 套话：赋能、打造闭环、在数字化浪潮中、不仅而且、让我们共同、匠心独运、焕新升级等。',
    '不要机械堆砌标题和小节。品牌故事要有清楚的叙事节奏；内容日历要给出每周主题、平台、内容形式和确认点。',
    '多平台文案必须是可直接继续编辑的完整文本，分别适配小红书、抖音和微信公众号，不要只写平台特征。',
    '年轻化表达方案要给出可直接改写的语态替换和示例，不要只讲原则。',
    '所有确定事实后保留对应的 [Fxxx] 引用编号。输出 JSON，不要输出 Markdown 代码围栏。'
  ].join('\n');
  const user = JSON.stringify({
    brand: { name: payload.brand.name, type: payload.brand.type, tone: payload.brand.tone },
    platform: payload.platformName, contentType: payload.contentTypeName,
    audience: payload.audience, theme: payload.theme, goal: payload.goal, constraints: payload.constraints,
    promotionMethods: payload.promotionMethods || [], performanceFeedback: payload.performanceFeedback || [],
    facts: facts.map((fact) => ({ id: fact.id, category: fact.category, text: fact.text, source: fact.source, sourceLocation: fact.sourceLocation })),
    detectedRisks: risks.map((risk) => ({ level: risk.level, type: risk.type, term: risk.term, reason: risk.reason, suggestion: risk.suggestion }))
  });
  return { system, user };
}

function createAiAdapter(env = {}) {
  const openaiKey = env.OPENAI_API_KEY || env.AI_API_KEY || '';
  const openaiBase = trimSlash(env.OPENAI_BASE_URL || 'https://api.openai.com/v1');
  const compatibleUrl = env.AI_API_URL || '';
  const model = env.OPENAI_MODEL || env.AI_MODEL || 'gpt-6';
  const timeoutMs = Number(env.AI_TIMEOUT_MS || 30000);
  const enabled = !!(openaiKey && (openaiBase || compatibleUrl));
  const mode = String(env.AI_API_MODE || (env.OPENAI_API_KEY ? 'responses' : 'chat')).toLowerCase();

  async function callResponses(system, user) {
    const data = await requestJson(responsesEndpoint(openaiBase), { headers: { Authorization: 'Bearer ' + openaiKey } }, {
      model: model,
      instructions: system,
      input: [{ role: 'user', content: user }],
      text: { format: { type: 'json_schema', name: 'luyun_narrative_package', strict: true, schema: OUTPUT_SCHEMA } },
      max_output_tokens: Number(env.AI_MAX_OUTPUT_TOKENS || 6000)
    }, timeoutMs);
    return parseJsonText(extractResponseText(data));
  }

  async function callChat(system, user) {
    const base = compatibleUrl || openaiBase;
    const data = await requestJson(chatEndpoint(base), { headers: { Authorization: 'Bearer ' + openaiKey } }, {
      model: model, temperature: 0.35, response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }]
    }, timeoutMs);
    const text = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (!text) throw new Error('模型没有返回内容');
    return parseJsonText(text);
  }

  async function generate(payload, risks) {
    if (!enabled) return null;
    const prompt = buildPrompt(payload, risks);
    let parsed;
    let adapterMode = mode;
    if (mode === 'responses') {
      try { parsed = await callResponses(prompt.system, prompt.user); }
      catch (error) { if (!compatibleUrl) throw error; parsed = await callChat(prompt.system, prompt.user); adapterMode = 'chat-completions-fallback'; }
    } else { parsed = await callChat(prompt.system, prompt.user); }
    const modelInfo = { model: model, mode: '高级模型适配层 / ' + adapterMode, promptVersion: engine.PROMPT_VERSION };
    const results = engine.generateContent({
      brand: payload.brand, facts: payload.facts, risks: risks, platform: payload.platform,
      contentType: payload.contentType, audience: payload.audience, theme: payload.theme,
      goal: payload.goal, constraints: payload.constraints, promotionMethods: payload.promotionMethods,
      performanceFeedback: payload.performanceFeedback, modelInfo: modelInfo, isDemo: false
    });
    ['story', 'calendar', 'copy', 'youth'].forEach((key, index) => {
      if (parsed[key] && String(parsed[key]).trim().length > 40) { results[index].content = String(parsed[key]).trim(); results[index].originalContent = results[index].content; }
    });
    return { artifacts: results, modelInfo: modelInfo };
  }

  return { enabled, model, mode, generate };
}

module.exports = { createAiAdapter, requestJson, responsesEndpoint, chatEndpoint, extractResponseText, parseJsonText, buildPrompt };
