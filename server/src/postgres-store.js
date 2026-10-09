'use strict';

const crypto = require('crypto');
function now() { return new Date().toISOString(); }
function safeId(prefix) { return prefix + '-' + crypto.randomUUID(); }
function sha256(value) { return crypto.createHash('sha256').update(String(value)).digest('hex'); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function countValue(value) { return Array.isArray(value) ? Number(value[0] || 0) : Number(value || 0); }

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY,
  email text UNIQUE NOT NULL,
  password_hash text NOT NULL,
  role text NOT NULL DEFAULT '品牌运营人员',
  disabled boolean NOT NULL DEFAULT false,
  failed_login_count integer NOT NULL DEFAULT 0,
  locked_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash text PRIMARY KEY,
  csrf_token text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS records (
  collection text NOT NULL,
  id text NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (collection, id)
);
CREATE INDEX IF NOT EXISTS records_user_collection_idx ON records(user_id, collection, updated_at DESC);
CREATE TABLE IF NOT EXISTS audit_logs (
  id text PRIMARY KEY,
  user_id text,
  action text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON audit_logs(created_at DESC);
`;

function userFromRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    disabled: row.disabled,
    failedLoginCount: row.failed_login_count,
    lockedUntil: row.locked_until ? new Date(row.locked_until).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : now()
  };
}

class PostgresStore {
  constructor(options) {
    options = options || {};
    this.file = 'postgresql';
    this.connectionString = options.connectionString;
    this.ssl = options.ssl;
    this.InjectedPool = options.Pool || null;
    this.pool = null;
    this.ready = this.initialize();
  }

  async initialize() {
    const Pool = this.InjectedPool || require('pg').Pool;
    this.pool = new Pool({ connectionString: this.connectionString, ssl: this.ssl || undefined, max: Number(process.env.PG_POOL_MAX || 10) });
    await this.pool.query(SCHEMA);
    await this.cleanupSessions();
    return this;
  }

  async query(text, values) { await this.ready; return this.pool.query(text, values || []); }
  async save() { return this; }
  async cleanupSessions() { if (this.pool) await this.pool.query('DELETE FROM sessions WHERE expires_at <= now()'); }

  async audit(action, detail, userId) {
    await this.query('INSERT INTO audit_logs (id, user_id, action, detail) VALUES ($1,$2,$3,$4)', [safeId('audit'), userId || null, action, detail || {}]);
  }

  async createUser(input) {
    const email = String(input.email || '').trim().toLowerCase();
    const result = await this.query(
      'INSERT INTO users (id,email,password_hash,role,disabled,failed_login_count) VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (email) DO NOTHING RETURNING *',
      [safeId('user'), email, input.passwordHash, input.role || '品牌运营人员', false, 0]
    );
    if (!result.rows.length) return null;
    const user = userFromRow(result.rows[0]);
    await this.audit('user.register', { userId: user.id, email }, user.id);
    return user;
  }

  async findUserByEmail(email) {
    const result = await this.query('SELECT * FROM users WHERE email=$1', [String(email || '').trim().toLowerCase()]);
    return userFromRow(result.rows[0]);
  }

  async getUser(id) {
    const result = await this.query('SELECT * FROM users WHERE id=$1', [id]);
    return userFromRow(result.rows[0]);
  }

  async updateUser(id, changes) {
    const map = { passwordHash: 'password_hash', role: 'role', disabled: 'disabled', failedLoginCount: 'failed_login_count', lockedUntil: 'locked_until' };
    const sets = [];
    const values = [];
    let index = 1;
    Object.keys(changes || {}).forEach((key) => {
      if (!map[key]) return;
      sets.push(map[key] + '=$' + index);
      values.push(changes[key]);
      index += 1;
    });
    if (!sets.length) return this.getUser(id);
    sets.push('updated_at=now()');
    values.push(id);
    const result = await this.query('UPDATE users SET ' + sets.join(',') + ' WHERE id=$' + index + ' RETURNING *', values);
    await this.audit('user.update', { userId: id }, id);
    return userFromRow(result.rows[0]);
  }

  async createSession(user, ttlMs, metadata) {
    const token = crypto.randomBytes(32).toString('base64url');
    const tokenHash = sha256(token);
    const csrfToken = crypto.randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + (ttlMs || 30 * 24 * 60 * 60 * 1000)).toISOString();
    await this.query('INSERT INTO sessions (token_hash,csrf_token,user_id,expires_at) VALUES ($1,$2,$3,$4)', [tokenHash, csrfToken, user.id, expiresAt]);
    await this.audit('session.create', Object.assign({ userId: user.id }, metadata || {}), user.id);
    return { token, csrfToken, expiresAt };
  }

  async getSession(token) {
    if (!token) return null;
    const tokenHash = sha256(token);
    const result = await this.query('SELECT s.*, u.* FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()', [tokenHash]);
    if (!result.rows.length) return null;
    const row = result.rows[0];
    const user = userFromRow(row);
    if (!user || user.disabled) return null;
    return { session: { tokenHash, csrfToken: row.csrf_token, userId: user.id, email: user.email, role: user.role, expiresAt: new Date(row.expires_at).toISOString(), createdAt: new Date(row.created_at).toISOString() }, user };
  }

  async revokeSession(token) {
    if (!token) return;
    await this.query('DELETE FROM sessions WHERE token_hash=$1', [sha256(token)]);
  }

  async listRecords(collection, userId, limit) {
    const result = await this.query('SELECT payload FROM records WHERE collection=$1 AND user_id=$2 ORDER BY updated_at DESC LIMIT $3', [collection, userId, limit || 100]);
    return result.rows.map((row) => clone(row.payload));
  }

  async putRecord(collection, userId, record) {
    const id = record.id || record.jobId || safeId(collection);
    const item = Object.assign({}, clone(record), { id, userId, createdAt: record.createdAt || now(), updatedAt: now() });
    await this.query(
      'INSERT INTO records (collection,id,user_id,payload,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (collection,id) DO UPDATE SET payload=$4,updated_at=now()',
      [collection, id, userId, item, item.createdAt]
    );
    await this.audit(collection + '.save', { id }, userId);
    return clone(item);
  }

  async getRecord(collection, userId, id) {
    const result = await this.query('SELECT payload FROM records WHERE collection=$1 AND user_id=$2 AND id=$3', [collection, userId, id]);
    return result.rows.length ? clone(result.rows[0].payload) : null;
  }

  async deleteRecord(collection, userId, id) {
    const result = await this.query('DELETE FROM records WHERE collection=$1 AND user_id=$2 AND id=$3', [collection, userId, id]);
    if (result.rowCount) await this.audit(collection + '.delete', { id }, userId);
    return result.rowCount > 0;
  }

  async stats() {
    const result = await this.query(`SELECT
      (SELECT count(*)::int FROM users) AS users,
      (SELECT count(*)::int FROM sessions WHERE expires_at>now()) AS sessions,
      (SELECT count(*)::int FROM records WHERE collection='brands') AS brands,
      (SELECT count(*)::int FROM records WHERE collection='jobs') AS jobs,
      (SELECT count(*)::int FROM records WHERE collection='reviews') AS reviews,
      (SELECT count(*)::int FROM records WHERE collection='publishRecords') AS publish_records,
      (SELECT count(*)::int FROM records WHERE collection='documents') AS documents`);
    const row = result.rows[0];
    return { users: countValue(row.users), sessions: countValue(row.sessions), brands: countValue(row.brands), jobs: countValue(row.jobs), history: countValue(row.jobs), reviews: countValue(row.reviews), publishRecords: countValue(row.publish_records), documents: countValue(row.documents) };
  }

  async close() { if (this.pool) await this.pool.end(); }
}

module.exports = { PostgresStore, SCHEMA };