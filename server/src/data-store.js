'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function now() { return new Date().toISOString(); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function safeId(prefix) { return prefix + '-' + crypto.randomUUID(); }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }

function emptyData() {
  return {
    meta: { version: 1, createdAt: now() },
    users: {},
    sessions: {},
    brands: {},
    jobs: {},
    reviews: {},
    publishRecords: {},
    documents: {},
    audit: []
  };
}

class JsonStore {
  constructor(options) {
    options = options || {};
    this.file = options.file || path.join(process.cwd(), 'data', 'luyun-store.json');
    this.memory = this.file === ':memory:';
    this.data = emptyData();
    if (!this.memory) this.load();
  }

  load() {
    try {
      const directory = path.dirname(this.file);
      if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
      if (fs.existsSync(this.file)) {
        const parsed = JSON.parse(fs.readFileSync(this.file, 'utf8'));
        this.data = Object.assign(emptyData(), parsed);
      } else {
        this.persist();
      }
    } catch (error) {
      this.data = emptyData();
      this.audit('store.load.failed', { message: error.message });
    }
    return this;
  }

  persist() {
    if (this.memory) return;
    const directory = path.dirname(this.file);
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { recursive: true });
    const temporary = this.file + '.tmp';
    fs.writeFileSync(temporary, JSON.stringify(this.data, null, 2), 'utf8');
    fs.renameSync(temporary, this.file);
  }

  audit(action, detail) {
    this.data.audit.unshift({ id: safeId('audit'), action, detail: detail || {}, createdAt: now() });
    this.data.audit = this.data.audit.slice(0, 1000);
  }

  save() { this.persist(); return this; }

  createUser(input) {
    const email = String(input.email || '').trim().toLowerCase();
    if (!email || this.data.users[email]) return null;
    const user = {
      id: safeId('user'),
      email,
      passwordHash: input.passwordHash,
      role: input.role || '品牌运营人员',
      createdAt: now(),
      updatedAt: now(),
      disabled: false
    };
    this.data.users[email] = user;
    this.audit('user.register', { userId: user.id, email });
    this.save();
    return clone(user);
  }

  findUserByEmail(email) {
    const user = this.data.users[String(email || '').trim().toLowerCase()];
    return user ? clone(user) : null;
  }

  getUser(id) {
    const user = Object.values(this.data.users).find((item) => item.id === id);
    return user ? clone(user) : null;
  }

  updateUser(id, changes) {
    const user = Object.values(this.data.users).find((item) => item.id === id);
    if (!user) return null;
    Object.assign(user, changes, { updatedAt: now() });
    this.audit('user.update', { userId: id });
    this.save();
    return clone(user);
  }

  createSession(user, ttlMs) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const expiresAt = new Date(Date.now() + (ttlMs || 30 * 24 * 60 * 60 * 1000)).toISOString();
    this.data.sessions[tokenHash] = { tokenHash, userId: user.id, email: user.email, role: user.role, expiresAt, createdAt: now() };
    this.save();
    return token;
  }

  getSession(token) {
    if (!token) return null;
    const tokenHash = sha256(token);
    const session = this.data.sessions[tokenHash];
    if (!session) return null;
    if (new Date(session.expiresAt).getTime() <= Date.now()) {
      delete this.data.sessions[tokenHash];
      this.save();
      return null;
    }
    const user = this.getUser(session.userId);
    if (!user || user.disabled) return null;
    return { session: clone(session), user };
  }

  revokeSession(token) {
    if (!token) return;
    const tokenHash = sha256(token);
    if (this.data.sessions[tokenHash]) {
      delete this.data.sessions[tokenHash];
      this.save();
    }
  }

  listRecords(collection, userId, limit) {
    return Object.values(this.data[collection] || {})
      .filter((item) => !userId || item.userId === userId)
      .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
      .slice(0, limit || 100)
      .map(clone);
  }

  putRecord(collection, userId, record) {
    const id = record.id || record.jobId || safeId(collection);
    const item = Object.assign({}, clone(record), {
      id,
      userId,
      createdAt: record.createdAt || now(),
      updatedAt: now()
    });
    this.data[collection][id] = item;
    this.audit(collection + '.save', { userId, id });
    this.save();
    return clone(item);
  }

  getRecord(collection, userId, id) {
    const item = this.data[collection][id];
    if (!item || item.userId !== userId) return null;
    return clone(item);
  }

  deleteRecord(collection, userId, id) {
    const item = this.data[collection][id];
    if (!item || item.userId !== userId) return false;
    delete this.data[collection][id];
    this.audit(collection + '.delete', { userId, id });
    this.save();
    return true;
  }

  stats() {
    return {
      users: Object.keys(this.data.users).length,
      sessions: Object.keys(this.data.sessions).length,
      brands: Object.keys(this.data.brands).length,
      jobs: Object.keys(this.data.jobs).length,
      reviews: Object.keys(this.data.reviews).length,
      history: Object.keys(this.data.jobs).length,
      publishRecords: Object.keys(this.data.publishRecords).length,
      documents: Object.keys(this.data.documents).length
    };
  }
}

module.exports = { JsonStore, emptyData, sha256, clone };