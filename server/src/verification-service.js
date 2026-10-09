'use strict';

function withTimeout(promise, timeoutMs) {
  let timer;
  const timeout = new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('外部核验超时')), timeoutMs); });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

async function postJson(url, headers, body, timeoutMs) {
  const response = await withTimeout(fetch(url, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'User-Agent': 'luyun-xinsheng-verification/1.0' }, headers || {}), body: JSON.stringify(body) }), timeoutMs || 30000);
  if (!response.ok) throw new Error('官方核验 HTTP ' + response.status);
  return response.json();
}

async function fetchJson(url, timeoutMs, headers) {
  const response = await withTimeout(fetch(url, { headers: Object.assign({ 'User-Agent': 'luyun-xinsheng-verification/1.0' }, headers || {}) }), timeoutMs || 8000);
  if (!response.ok) throw new Error('外部核验 HTTP ' + response.status);
  return response.json();
}

async function searchWikidata(query, env) {
  const url = 'https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=zh&uselang=zh&limit=3&search=' + encodeURIComponent(query);
  const data = await fetchJson(url, Number(env.PUBLIC_VERIFICATION_TIMEOUT_MS || 8000));
  return (data.search || []).map((item) => ({ source: 'Wikidata', title: item.label || item.id, url: item.concepturi || ('https://www.wikidata.org/wiki/' + item.id), snippet: item.description || '' }));
}

async function searchWikipedia(query, env) {
  const url = 'https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&origin=*&srlimit=3&srsearch=' + encodeURIComponent(query);
  const data = await fetchJson(url, Number(env.PUBLIC_VERIFICATION_TIMEOUT_MS || 8000));
  const results = data.query && data.query.search || [];
  return results.map((item) => ({ source: 'Wikipedia', title: item.title, url: 'https://zh.wikipedia.org/wiki/' + encodeURIComponent(item.title), snippet: String(item.snippet || '').replace(/<[^>]+>/g, '') }));
}

async function publicEvidence(query, env) {
  if (String(env.PUBLIC_VERIFICATION_ENABLED || 'true').toLowerCase() === 'false') return [];
  const settled = await Promise.allSettled([searchWikidata(query, env), searchWikipedia(query, env)]);
  return settled.reduce((all, item) => all.concat(item.status === 'fulfilled' ? item.value : []), []).slice(0, 5);
}

async function verifyFacts(facts, env, context) {
  env = env || {};
  context = context || {};
  const baseFacts = (facts || []).map((fact) => Object.assign({}, fact));
  let externalResults = new Map();
  if (env.OFFICIAL_VERIFICATION_URL) {
    const response = await postJson(env.OFFICIAL_VERIFICATION_URL, env.OFFICIAL_VERIFICATION_API_KEY ? { Authorization: 'Bearer ' + env.OFFICIAL_VERIFICATION_API_KEY } : {}, { facts: baseFacts, brandName: context.brandName || '', sourcePolicy: 'official-first' }, Number(env.OFFICIAL_VERIFICATION_TIMEOUT_MS || 30000));
    if (response && Array.isArray(response.results)) externalResults = new Map(response.results.map((item) => [item.id, item]));
  }

  const verified = [];
  for (const fact of baseFacts) {
    const official = externalResults.get(fact.id);
    if (official) {
      verified.push(Object.assign({}, fact, {
        verificationStatus: official.status || '待核验',
        evidenceLevel: official.evidenceLevel || fact.evidenceLevel,
        verificationMethod: official.method || 'official-provider',
        verificationMessage: official.reason || '',
        verifiedAt: official.status === '已核验' ? new Date().toISOString() : fact.verifiedAt || '',
        verifiedBy: official.authority || (official.status === '已核验' ? '权威核验服务' : '')
      }));
      continue;
    }
    const query = [context.brandName || '', fact.category || '', fact.statement || fact.text || ''].join(' ').trim();
    let evidence = [];
    try { evidence = await publicEvidence(query, env); } catch (error) { evidence = []; }
    verified.push(Object.assign({}, fact, evidence.length ? {
      verificationStatus: '发现外部资料，待人工核验',
      evidenceLevel: '中（外部资料）',
      verificationMethod: 'wikidata+wikipedia',
      verificationMessage: '已找到外部公开资料，但公开百科不等于官方认定，仍需品牌方或权威机构确认。',
      externalEvidence: evidence
    } : {
      verificationStatus: fact.verificationStatus || '待核验',
      verificationMethod: 'no-external-match',
      verificationMessage: '未找到匹配的公开外部资料，继续保持待核验。',
      externalEvidence: []
    }));
  }
  return { configured: !!env.OFFICIAL_VERIFICATION_URL, publicSources: String(env.PUBLIC_VERIFICATION_ENABLED || 'true').toLowerCase() !== 'false', facts: verified };
}

module.exports = { verifyFacts, publicEvidence };