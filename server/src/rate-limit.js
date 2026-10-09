'use strict';

function createRateLimiter(options) {
  options = options || {};
  const windowMs = options.windowMs || 15 * 60 * 1000;
  const max = options.max || 20;
  const attempts = new Map();
  function keyFor(request, extra) {
    const forwarded = String((request.headers && request.headers['x-forwarded-for']) || '').split(',')[0].trim();
    const ip = forwarded || request.socket && request.socket.remoteAddress || 'unknown';
    return ip + '|' + String(extra || '').trim().toLowerCase();
  }
  function check(request, extra) {
    const key = keyFor(request, extra);
    const now = Date.now();
    const item = attempts.get(key) || { count: 0, resetAt: now + windowMs };
    if (item.resetAt <= now) { item.count = 0; item.resetAt = now + windowMs; }
    attempts.set(key, item);
    if (item.count >= max) return { allowed: false, retryAfterMs: item.resetAt - now };
    return { allowed: true, key, item };
  }
  function consume(request, extra) {
    const result = check(request, extra);
    if (result.allowed) result.item.count += 1;
    return result;
  }
  function reset(request, extra) { attempts.delete(keyFor(request, extra)); }
  function cleanup() {
    const now = Date.now();
    attempts.forEach((item, key) => { if (item.resetAt <= now) attempts.delete(key); });
  }
  const timer = setInterval(cleanup, Math.max(30000, Math.floor(windowMs / 2)));
  timer.unref();
  return { check, consume, reset, cleanup, _attempts: attempts };
}

module.exports = { createRateLimiter };