'use strict';

const crypto = require('crypto');
const SESSION_COOKIE = 'luyun_session';

function parseCookies(header) {
  const result = {};
  String(header || '').split(';').forEach((part) => {
    const index = part.indexOf('=');
    if (index < 0) return;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  });
  return result;
}

function isSecureRequest(request, env) {
  if (String((env || {}).COOKIE_SECURE || '').toLowerCase() === 'true') return true;
  if (String(request.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https') return true;
  return false;
}

function serializeCookie(name, value, options) {
  options = options || {};
  const parts = [name + '=' + encodeURIComponent(value || '')];
  parts.push('Path=' + (options.path || '/'));
  if (options.maxAge != null) parts.push('Max-Age=' + Number(options.maxAge));
  parts.push('SameSite=' + (options.sameSite || 'Lax'));
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  return parts.join('; ');
}

function setSessionCookies(response, request, env, token, csrfToken) {
  const secure = isSecureRequest(request, env);
  const crossSite = String((env || {}).COOKIE_SAME_SITE || 'None').toLowerCase() === 'none';
  const sameSite = releaseSameSite(crossSite, secure);
  const maxAge = Number((env || {}).SESSION_COOKIE_MAX_AGE || 30 * 24 * 60 * 60);
  response.setHeader('Set-Cookie', [
    serializeCookie(SESSION_COOKIE, token, { httpOnly: true, secure, sameSite, maxAge }),
    serializeCookie('luyun_csrf_hint', csrfToken, { httpOnly: false, secure, sameSite, maxAge })
  ]);
}

function releaseSameSite(crossSite, secure) { return crossSite && secure ? 'None' : 'Lax'; }

function clearSessionCookies(response, request, env) {
  const secure = isSecureRequest(request, env);
  const sameSite = releaseSameSite(String((env || {}).COOKIE_SAME_SITE || 'None').toLowerCase() === 'none', secure);
  response.setHeader('Set-Cookie', [
    serializeCookie(SESSION_COOKIE, '', { httpOnly: true, secure, sameSite, maxAge: 0 }),
    serializeCookie('luyun_csrf_hint', '', { httpOnly: false, secure, sameSite, maxAge: 0 })
  ]);
}

function tokenFromRequest(request) {
  const header = String(request.headers.authorization || '');
  if (/^Bearer\s+/i.test(header)) return header.replace(/^Bearer\s+/i, '').trim();
  const cookies = parseCookies(request.headers.cookie);
  return cookies[SESSION_COOKIE] || '';
}

function csrfFromRequest(request) { return String(request.headers['x-csrf-token'] || ''); }
function newCsrfToken() { return crypto.randomBytes(24).toString('base64url'); }
function csrfValid(request, session) { return !!session && !!session.csrfToken && csrfFromRequest(request) === session.csrfToken; }

function applySecurityHeaders(response) {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}

module.exports = { SESSION_COOKIE, parseCookies, setSessionCookies, clearSessionCookies, tokenFromRequest, csrfFromRequest, csrfValid, newCsrfToken, applySecurityHeaders, isSecureRequest };