const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');

/**
 * Structured application log store (collection `applogs`) — powers the admin
 * "Логи" viewer with per-user and per-type (success/info/warn/error) filtering.
 * Entries auto-expire after 30 days (TTL).
 */
const appLogSchema = new mongoose.Schema(
  {
    level: { type: String, enum: ['success', 'info', 'warn', 'error'], default: 'info', index: true },
    source: { type: String, index: true }, // 'client' | 'api' | 'auth' | …
    message: { type: String },
    method: { type: String },
    path: { type: String },
    status: { type: Number },
    userId: { type: String, index: true },
    userEmail: { type: String, index: true },
    meta: { type: mongoose.Schema.Types.Mixed },
    createdAt: { type: Date, default: Date.now },
  },
  { versionKey: false },
);
// TTL — keep 30 days; this index also serves the newest-first sort.
appLogSchema.index({ createdAt: -1 });
appLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

const AppLog = mongoose.models.AppLog || mongoose.model('AppLog', appLogSchema, 'applogs');

/** Record one log entry. Non-blocking, never throws. */
async function recordAppLog(entry) {
  try {
    await AppLog.create({ ...entry, createdAt: new Date() });
  } catch (e) {
    logger.warn('[AppLog] record failed:', e?.message);
  }
}

/** Query logs with filters + pagination (newest first). */
async function queryLogs({ level, userId, source, search, page = 1, limit = 50 } = {}) {
  const filter = {};
  if (level && level !== 'all') {
    filter.level = level;
  }
  if (userId) {
    filter.userId = userId;
  }
  if (source) {
    filter.source = source;
  }
  if (search) {
    const safe = String(search).slice(0, 100).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(safe, 'i');
    filter.$or = [{ message: rx }, { path: rx }, { source: rx }, { userEmail: rx }];
  }
  const skip = (page - 1) * limit;
  const [logs, total] = await Promise.all([
    AppLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    AppLog.countDocuments(filter),
  ]);
  return { logs, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
}

/** Distinct users that appear in logs (for the user filter dropdown). */
async function distinctLogUsers() {
  const rows = await AppLog.aggregate([
    { $match: { userId: { $ne: null } } },
    { $group: { _id: '$userId', email: { $first: '$userEmail' }, n: { $sum: 1 } } },
    { $sort: { n: -1 } },
    { $limit: 100 },
  ]);
  return rows.map((r) => ({ userId: r._id, email: r.email || r._id, count: r.n }));
}

module.exports = { AppLog, recordAppLog, queryLogs, distinctLogUsers };
