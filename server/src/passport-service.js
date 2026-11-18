'use strict';

const crypto = require('crypto');
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') { const result = {}; Object.keys(value).sort().forEach((key) => { result[key] = canonicalize(value[key]); }); return result; }
  return value;
}
function digest(value) { return crypto.createHash('sha256').update(JSON.stringify(canonicalize(value))).digest('hex'); }
function signingKey(env) { return String((env || {}).PASSPORT_SIGNING_KEY || 'luyun-development-signing-key-change-me'); }
function keyId(env) { return String((env || {}).PASSPORT_SIGNING_KEY_ID || 'development'); }
function signPassport(passport, env) {
  const copy = Object.assign({}, passport || {});
  delete copy.signature; delete copy.signatureAlgorithm; delete copy.signedAt; delete copy.signingKeyId;
  const contentHash = digest({ id: copy.id, jobId: copy.jobId, brandName: copy.brandName, facts: copy.facts, artifactHashes: copy.artifactHashes, proofId: copy.proofId, proofStatus: copy.proofStatus, promptVersion: copy.promptVersion });
  const signed = Object.assign({}, copy, { contentHash: contentHash, signedAt: new Date().toISOString(), signingKeyId: keyId(env) });
  signed.signatureAlgorithm = 'HMAC-SHA256';
  signed.signature = crypto.createHmac('sha256', signingKey(env)).update(JSON.stringify(canonicalize(signed))).digest('hex');
  return signed;
}
function verifyPassport(passport, env) {
  if (!passport || !passport.signature) return { valid: false, reason: '缺少数字签名' };
  const copy = Object.assign({}, passport); const signature = copy.signature; const algorithm = copy.signatureAlgorithm; delete copy.signature;
  const expected = crypto.createHmac('sha256', signingKey(env)).update(JSON.stringify(canonicalize(copy))).digest('hex');
  const valid = algorithm === 'HMAC-SHA256' && signature.length === expected.length && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  return { valid: valid, reason: valid ? '内容护照签名有效' : '内容护照签名无效', contentHash: passport.contentHash, signedAt: passport.signedAt, signingKeyId: passport.signingKeyId };
}
module.exports = { signPassport, verifyPassport, digest, canonicalize };