const { pgTable, serial, varchar, integer, timestamp } = require('drizzle-orm/pg-core');

/**
 * token_usage — one row per LLM usage incident, mirroring the Sales Gyroscope
 * reference structure so all Corp/Gyromind products feed the same Grafana telemetry.
 * cost_* are stored as strings (str(float)); aggregate via ::numeric in SQL.
 */
const tokenUsage = pgTable('token_usage', {
  id: serial('id').primaryKey(),
  domain: varchar('domain', { length: 255 }).notNull(),
  provider: varchar('provider', { length: 50 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  purpose: varchar('purpose', { length: 50 }).notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  costInput: varchar('cost_input', { length: 20 }),
  costOutput: varchar('cost_output', { length: 20 }),
  reportId: integer('report_id'),
  host: varchar('host', { length: 255 }),
  hostIp: varchar('host_ip', { length: 64 }),
  createdAt: timestamp('created_at').defaultNow(),
});

module.exports = { tokenUsage };
