/**
 * Drizzle Kit config for the token_usage telemetry table.
 * Run migrations with:  npx drizzle-kit migrate --config api/db/tokenUsage/drizzle.config.js
 * (generate new ones with: npx drizzle-kit generate --config ...)
 * At runtime the table is also ensured idempotently on server startup (client.js#ensureTable).
 */
module.exports = {
  schema: './api/db/tokenUsage/schema.js',
  out: './api/db/tokenUsage/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.TOKEN_USAGE_DB_URL || 'postgresql://myuser:mypassword@127.0.0.1:5432/mydatabase',
  },
};
