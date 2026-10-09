'use strict';

const path = require('path');
const { JsonStore } = require('./data-store');
const { PostgresStore } = require('./postgres-store');

function createStore(env) {
  env = env || {};
  if (env.STORE) return env.STORE;
  if (env.DATABASE_URL) {
    return new PostgresStore({
      connectionString: env.DATABASE_URL,
      ssl: String(env.DATABASE_SSL || 'false').toLowerCase() === 'true' ? { rejectUnauthorized: false } : undefined
    });
  }
  return new JsonStore({ file: env.DATA_FILE || path.join(process.cwd(), 'data', 'luyun-store.json') });
}

module.exports = { createStore };