'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const PASSWORD_MIN_LENGTH = 8;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_FAILED_LOGINS = 5;
const LOCK_MS = 15 * 60 * 1000;

function normalizeEmail(value) { return String(value || '').trim().toLowerCase(); }
function isValidEmail(email) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email); }
function isValidPassword(password) { return typeof password === 'string' && password.length >= PASSWORD_MIN_LENGTH; }

async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const derived = await scrypt(password, salt, 64);
  return 'scrypt$' + salt + '$' + Buffer.from(derived).toString('base64url');
}

async function verifyPassword(password, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false;
  const actual = await scrypt(password, parts[1], 64);
  const expected = Buffer.from(parts[2], 'base64url');
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, role: user.role, createdAt: user.createdAt };
}

function createAuthService(store) {
  async function ready() { if (store.ready) await store.ready; }
  return {
    async register(input) {
      await ready();
      const email = normalizeEmail(input.email);
      if (!isValidEmail(email)) throw Object.assign(new Error('请输入有效邮箱地址。'), { code: 'INVALID_EMAIL', status: 400 });
      if (!isValidPassword(input.password)) throw Object.assign(new Error('密码至少需要 8 位。'), { code: 'INVALID_PASSWORD', status: 400 });
      if (await store.findUserByEmail(email)) throw Object.assign(new Error('该邮箱已经注册。'), { code: 'EMAIL_EXISTS', status: 409 });
      const passwordHash = await hashPassword(input.password);
      const user = await store.createUser({ email, passwordHash, role: input.role });
      if (!user) throw Object.assign(new Error('注册失败，请重试。'), { code: 'REGISTER_FAILED', status: 500 });
      const session = await store.createSession(user, SESSION_TTL_MS, { userAgent: input.userAgent || '' });
      return { token: session.token, csrfToken: session.csrfToken, user: publicUser(user) };
    },

    async login(input) {
      await ready();
      const email = normalizeEmail(input.email);
      const user = await store.findUserByEmail(email);
      if (!user || !user.passwordHash) throw Object.assign(new Error('邮箱或密码不正确。'), { code: 'INVALID_CREDENTIALS', status: 401 });
      if (user.disabled) throw Object.assign(new Error('该账号已停用。'), { code: 'ACCOUNT_DISABLED', status: 403 });
      if (user.lockedUntil && new Date(user.lockedUntil).getTime() > Date.now()) {
        throw Object.assign(new Error('登录失败次数过多，请 15 分钟后再试。'), { code: 'ACCOUNT_LOCKED', status: 423 });
      }
      const valid = await verifyPassword(String(input.password || ''), user.passwordHash);
      if (!valid) {
        const failedLoginCount = Number(user.failedLoginCount || 0) + 1;
        const changes = { failedLoginCount };
        if (failedLoginCount >= MAX_FAILED_LOGINS) changes.lockedUntil = new Date(Date.now() + LOCK_MS).toISOString();
        await store.updateUser(user.id, changes);
        throw Object.assign(new Error('邮箱或密码不正确。'), { code: 'INVALID_CREDENTIALS', status: 401 });
      }
      await store.updateUser(user.id, { failedLoginCount: 0, lockedUntil: null });
      const session = await store.createSession(user, SESSION_TTL_MS, { userAgent: input.userAgent || '' });
      return { token: session.token, csrfToken: session.csrfToken, user: publicUser(user) };
    },

    async authenticate(token) {
      await ready();
      const found = await store.getSession(token);
      return found ? { session: found.session, user: publicUser(found.user) } : null;
    },

    async logout(token) { await ready(); await store.revokeSession(token); },

    async changePassword(token, oldPassword, newPassword) {
      await ready();
      const authenticated = await this.authenticate(token);
      if (!authenticated) throw Object.assign(new Error('登录已过期。'), { code: 'UNAUTHORIZED', status: 401 });
      if (!isValidPassword(newPassword)) throw Object.assign(new Error('新密码至少需要 8 位。'), { code: 'INVALID_PASSWORD', status: 400 });
      const storedUser = await store.findUserByEmail(authenticated.user.email);
      const valid = await verifyPassword(oldPassword, storedUser.passwordHash);
      if (!valid) throw Object.assign(new Error('原密码不正确。'), { code: 'INVALID_CREDENTIALS', status: 401 });
      const passwordHash = await hashPassword(newPassword);
      const updated = await store.updateUser(authenticated.user.id, { passwordHash, failedLoginCount: 0, lockedUntil: null });
      return publicUser(updated);
    }
  };
}

module.exports = { createAuthService, hashPassword, verifyPassword, normalizeEmail, isValidEmail, isValidPassword, publicUser, PASSWORD_MIN_LENGTH, SESSION_TTL_MS, MAX_FAILED_LOGINS };