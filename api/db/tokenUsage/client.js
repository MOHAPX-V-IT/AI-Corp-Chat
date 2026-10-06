const { logger } = require('@librechat/data-schemas');

const DB_URL = process.env.TOKEN_USAGE_DB_URL;
let db = null;
let sqlClient = null;
let disabled = !DB_URL;

/** Lazily create the postgres.js client + drizzle instance. Returns null if unconfigured. */
function getDb() {
  if (disabled) {
    return null;
  }
  if (db) {
    return db;
  }
  try {
    const postgres = require('postgres');
    const { drizzle } = require('drizzle-orm/postgres-js');
    const schema = require('./schema');
    sqlClient = postgres(DB_URL, { max: 3, idle_timeout: 20, onnotice: () => {} });
    db = drizzle(sqlClient, { schema });
    return db;
  } catch (e) {
    logger.error('[tokenUsage] Postgres connection failed, disabling token_usage:', e?.message);
    disabled = true;
    return null;
  }
}

/** Idempotent table creation (runtime safety net alongside the Drizzle migration). */
async function ensureTable() {
  if (disabled) {
    logger.info('[tokenUsage] TOKEN_USAGE_DB_URL not set — Postgres telemetry disabled');
    return;
  }
  try {
    getDb();
    if (!sqlClient) {
      return;
    }
    await sqlClient`
      CREATE TABLE IF NOT EXISTS token_usage (
        id            serial       PRIMARY KEY,
        domain        varchar(255) NOT NULL,
        provider      varchar(50)  NOT NULL,
        model         varchar(100) NOT NULL,
        purpose       varchar(50)  NOT NULL,
        input_tokens  integer,
        output_tokens integer,
        cost_input    varchar(20),
        cost_output   varchar(20),
        report_id     integer,
        host          varchar(255),
        host_ip       varchar(64),
        created_at    timestamp    DEFAULT now()
      )
    `;
    await sqlClient`CREATE INDEX IF NOT EXISTS token_usage_created_at_idx ON token_usage (created_at)`;
    await sqlClient`CREATE INDEX IF NOT EXISTS token_usage_domain_idx ON token_usage (domain)`;
    logger.info('[tokenUsage] token_usage table ready (Postgres telemetry enabled)');
  } catch (e) {
    logger.warn('[tokenUsage] ensureTable failed (telemetry disabled this run):', e?.message);
    disabled = true;
  }
}

module.exports = { getDb, ensureTable };
