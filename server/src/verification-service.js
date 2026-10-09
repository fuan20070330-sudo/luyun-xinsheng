'use strict';

const http = require('http');
const https = require('https');

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const request = transport.request({ protocol: parsed.protocol, hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': payload.length }, headers || {}), timeout: timeoutMs || 30000 }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) { reject(new Error('核验服务返回内容不是 JSON。')); return; }
        if (response.statusCode < 200 || response.statusCode >= 300) { reject(new Error(data.message || ('核验服务 HTTP ' + response.statusCode))); return; }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('核验服务超时。')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function verifyFacts(facts, env) {
  env = env || {};
  const pending = (facts || []).map((fact) => Object.assign({}, fact, { verificationStatus: fact.verificationStatus || '待核验', verificationMethod: 'not-configured', verificationMessage: '未配置权威核验服务，已保持待核验。' }));
  if (!env.OFFICIAL_VERIFICATION_URL) return { configured: false, facts: pending };
  const response = await postJson(env.OFFICIAL_VERIFICATION_URL, env.OFFICIAL_VERIFICATION_API_KEY ? { Authorization: 'Bearer ' + env.OFFICIAL_VERIFICATION_API_KEY } : {}, { facts: facts || [], sourcePolicy: 'official-first' }, Number(env.OFFICIAL_VERIFICATION_TIMEOUT_MS || 30000));
  const checks = new Map((response.results || []).map((item) => [item.id, item]));
  return { configured: true, facts: (facts || []).map((fact) => {
    const check = checks.get(fact.id) || {};
    return Object.assign({}, fact, { verificationStatus: check.status || '待核验', evidenceLevel: check.evidenceLevel || fact.evidenceLevel, verificationMethod: check.method || 'external-provider', verificationMessage: check.reason || '', verifiedAt: check.status === '已核验' ? new Date().toISOString() : fact.verifiedAt || '', verifiedBy: check.status === '已核验' ? (check.authority || '权威核验服务') : fact.verifiedBy || '' });
  }) };
}

module.exports = { verifyFacts };