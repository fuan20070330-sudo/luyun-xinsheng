'use strict';

const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);

const PASSWORD_MIN_LENGTH = 8;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

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
  return {
    async register(input) {
      const email = normalizeEmail(input.email);
      if (!isValidEmail(email)) throw Object.assign(new Error('请输入有效邮箱地址。'), { code: 'INVALID_EMAIL', status: 400 });
      if (!isValidPassword(input.password)) throw Object.assign(new Error('密码至少需要 8 位。'), { code: 'INVALID_PASSWORD', status: 400 });
      if (store.findUserByEmail(email)) throw Object.assign(new Error('该邮箱已经注册。'), { code: 'EMAIL_EXISTS', status: 409 });
      const passwordHash = await hashPassword(input.password);
      const user = store.createUser({ email, passwordHash, role: input.role });
      if (!user) throw Object.assign(new Error('注册失败，请重试。'), { code: 'REGISTER_FAILED', status: 500 });
      const token = store.createSession(user, SESSION_TTL_MS);
      return { token, user: publicUser(user) };
    },

    async login(input) {
      const email = normalizeEmail(input.email);
      const user = store.findUserByEmail(email);
      if (!user || !user.passwordHash) throw Object.assign(new Error('邮箱或密码不正确。'), { code: 'INVALID_CREDENTIALS', status: 401 });
      const valid = await verifyPassword(String(input.password || ''), user.passwordHash);
      if (!valid) throw Object.assign(new Error('邮箱或密码不正确。'), { code: 'INVALID_CREDENTIALS', status: 401 });
      if (user.disabled) throw Object.assign(new Error('该账号已停用。'), { code: 'ACCOUNT_DISABLED', status: 403 });
      const token = store.createSession(user, SESSION_TTL_MS);
      return { token, user: publicUser(user) };
    },

    authenticate(token) {
      const found = store.getSession(token);
      return found ? { session: found.session, user: publicUser(found.user) } : null;
    },

    logout(token) { store.revokeSession(token); },

    changePassword(token, oldPassword, newPassword) {
      const authenticated = this.authenticate(token);
      if (!authenticated) throw Object.assign(new Error('登录已过期。'), { code: 'UNAUTHORIZED', status: 401 });
      if (!isValidPassword(newPassword)) throw Object.assign(new Error('新密码至少需要 8 位。'), { code: 'INVALID_PASSWORD', status: 400 });
      return verifyPassword(oldPassword, store.findUserByEmail(authenticated.user.email).passwordHash).then((valid) => {
        if (!valid) throw Object.assign(new Error('原密码不正确。'), { code: 'INVALID_CREDENTIALS', status: 401 });
        return hashPassword(newPassword).then((passwordHash) => {
          const updated = store.updateUser(authenticated.user.id, { passwordHash });
          return publicUser(updated);
        });
      });
    }
  };
}

module.exports = { createAuthService, hashPassword, verifyPassword, normalizeEmail, isValidEmail, isValidPassword, publicUser, PASSWORD_MIN_LENGTH };