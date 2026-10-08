'use strict';

const crypto = require('crypto');
const http = require('http');
const https = require('https');

const TEXT_EXTENSIONS = ['.txt', '.md', '.markdown', '.json', '.csv'];
const BINARY_EXTENSIONS = ['.pdf', '.docx', '.png', '.jpg', '.jpeg', '.webp', '.mp3', '.m4a', '.wav', '.mp4'];

function extensionOf(name) { return String(name || '').toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || ''; }
function sha256(buffer) { return crypto.createHash('sha256').update(buffer).digest('hex'); }

function postJson(url, headers, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const transport = parsed.protocol === 'https:' ? https : http;
    const payload = Buffer.from(JSON.stringify(body), 'utf8');
    const request = transport.request({
      protocol: parsed.protocol, hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search, method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json', 'Content-Length': payload.length }, headers || {}),
      timeout: timeoutMs || 60000
    }, (response) => {
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => {
        let data;
        try { data = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (error) { reject(new Error('解析服务返回格式无效。')); return; }
        if (response.statusCode < 200 || response.statusCode >= 300) { reject(new Error(data.message || ('解析服务 HTTP ' + response.statusCode))); return; }
        resolve(data);
      });
    });
    request.on('timeout', () => request.destroy(new Error('解析服务超时。')));
    request.on('error', reject);
    request.write(payload);
    request.end();
  });
}

async function extractDocument(input, env) {
  env = env || {};
  const name = String(input.name || 'upload.txt');
  const type = String(input.type || 'application/octet-stream');
  const buffer = Buffer.from(String(input.base64 || ''), 'base64');
  if (!buffer.length) throw Object.assign(new Error('文件内容为空。'), { code: 'EMPTY_DOCUMENT', status: 400 });
  const extension = extensionOf(name);
  const hash = sha256(buffer);
  if (TEXT_EXTENSIONS.includes(extension)) return { name, type, extension, hash, text: buffer.toString('utf8'), extractor: 'direct-text' };
  if (!BINARY_EXTENSIONS.includes(extension)) throw Object.assign(new Error('暂不支持该文件格式。'), { code: 'UNSUPPORTED_DOCUMENT', status: 415 });
  if (!env.DOCUMENT_EXTRACTOR_URL) {
    throw Object.assign(new Error('PDF、DOCX、OCR 和音频转写需要配置 DOCUMENT_EXTRACTOR_URL 解析服务。'), { code: 'EXTRACTOR_NOT_CONFIGURED', status: 501 });
  }
  const result = await postJson(env.DOCUMENT_EXTRACTOR_URL, env.DOCUMENT_EXTRACTOR_API_KEY ? { Authorization: 'Bearer ' + env.DOCUMENT_EXTRACTOR_API_KEY } : {}, {
    name, type, extension, hash, base64: buffer.toString('base64'), mode: extension === '.pdf' ? 'pdf' : extension === '.docx' ? 'docx' : /\.(png|jpg|jpeg|webp)$/.test(extension) ? 'ocr' : 'transcribe'
  }, Number(env.DOCUMENT_EXTRACTOR_TIMEOUT_MS || 60000));
  return { name, type, extension, hash, text: String(result.text || ''), extractor: result.extractor || 'external', meta: result.meta || {} };
}

module.exports = { extractDocument, extensionOf, TEXT_EXTENSIONS, BINARY_EXTENSIONS };