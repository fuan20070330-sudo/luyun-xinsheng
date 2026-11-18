'use strict';

function withTimeout(promise, timeoutMs) { let timer; const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('官方登记核验超时')), timeoutMs); }); return Promise.race([promise, timeout]).finally(() => clearTimeout(timer)); }

async function lookupOfficial(brandName, facts, env) {
  if (!env.OFFICIAL_REGISTRY_URL) return { configured: false, results: [], message: '未配置官方名录或证书核验服务。' };
  const response = await withTimeout(fetch(env.OFFICIAL_REGISTRY_URL, {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', 'User-Agent': 'luyun-official-registry/1.0' }, env.OFFICIAL_REGISTRY_API_KEY ? { Authorization: 'Bearer ' + env.OFFICIAL_REGISTRY_API_KEY } : {}),
    body: JSON.stringify({ brandName: brandName || '', claims: (facts || []).map((fact) => ({ id: fact.id, category: fact.category, statement: fact.statement || fact.text, sourceAuthority: fact.sourceAuthority, sourceHash: fact.sourceHash })), requestedSources: ['shandong_laozihao', 'intangible_heritage', 'enterprise_credit', 'trademark', 'certificate'] })
  }), Number(env.OFFICIAL_REGISTRY_TIMEOUT_MS || 30000));
  if (!response.ok) throw new Error('官方登记核验 HTTP ' + response.status);
  const data = await response.json();
  return { configured: true, results: Array.isArray(data.results) ? data.results : [], message: data.message || '' };
}

module.exports = { lookupOfficial };