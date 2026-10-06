const express = require('express');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, checkBan } = require('~/server/middleware');

const router = express.Router();
router.use(requireJwtAuth);
router.use(checkBan);

// Friendly labels for the `context` field so the UI shows features, not internals.
const CONTEXT_LABELS = {
  message: 'Чат с агентами',
  incomplete: 'Чат с агентами',
  'ipr-parse': 'ИПР-анализ',
  'ipr-dynamics': 'ИПР-динамика',
  'transcript-title': 'Заголовки транскриптов',
  title: 'Названия чатов',
};

function periodDays(q) {
  const d = parseInt(q, 10);
  return [7, 30, 90].includes(d) ? d : 30;
}

// tokenValue is stored in credits; 1_000_000 credits = $1 (see api/models/tx.js).
const toUsd = (raw) => (raw || 0) / 1000000;

const absTokenValue = { $abs: { $ifNull: ['$tokenValue', 0] } };
const absRawAmount = { $abs: { $ifNull: ['$rawAmount', 0] } };

/**
 * GET /api/usage/me?days=30
 * Personal token-spend summary for the current user, aggregated from the
 * Transaction collection. Data is always available (independent of balance.enabled).
 */
router.get('/me', async (req, res) => {
  try {
    const Transaction = mongoose.models.Transaction;
    const userId = new mongoose.Types.ObjectId(req.user.id);
    const days = periodDays(req.query.days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { user: userId, createdAt: { $gte: since } };

    const [summaryAgg, daily, byModel, byContext, recent] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            input: { $sum: { $cond: [{ $eq: ['$tokenType', 'prompt'] }, absRawAmount, 0] } },
            output: { $sum: { $cond: [{ $eq: ['$tokenType', 'completion'] }, absRawAmount, 0] } },
            costRaw: { $sum: absTokenValue },
            requests: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$tokenType', 'completion'] }, { $ne: ['$context', 'title'] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            costRaw: { $sum: absTokenValue },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        { $match: { ...match, model: { $exists: true, $ne: null } } },
        { $group: { _id: '$model', costRaw: { $sum: absTokenValue } } },
        { $sort: { costRaw: -1 } },
        { $limit: 8 },
      ]),
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: '$context', costRaw: { $sum: absTokenValue } } },
        { $sort: { costRaw: -1 } },
      ]),
      Transaction.find(match).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const s = summaryAgg[0] || { input: 0, output: 0, costRaw: 0, requests: 0 };
    const totalTokens = s.input + s.output;

    res.json({
      period: { days, since },
      summary: {
        costUsd: toUsd(s.costRaw),
        inputTokens: s.input,
        outputTokens: s.output,
        totalTokens,
        requests: s.requests,
        avgTokensPerRequest: s.requests ? Math.round(totalTokens / s.requests) : 0,
      },
      daily: daily.map((d) => ({ date: d._id, costUsd: toUsd(d.costRaw) })),
      byModel: byModel.map((m) => ({ model: m._id, costUsd: toUsd(m.costRaw) })),
      byContext: byContext.map((c) => ({
        context: c._id || 'other',
        label: CONTEXT_LABELS[c._id] || (c._id || 'Прочее'),
        costUsd: toUsd(c.costRaw),
      })),
      recent: recent.map((t) => ({
        at: t.createdAt,
        model: t.model,
        context: t.context,
        tokenType: t.tokenType,
        tokens: Math.abs(t.rawAmount || 0),
        costUsd: toUsd(Math.abs(t.tokenValue || 0)),
      })),
    });
  } catch (error) {
    logger.error('[usage/me] error:', error);
    res.status(500).json({ error: 'Failed to load usage' });
  }
});

/**
 * GET /api/usage/overview?days=30  (ADMIN only)
 * Platform-wide token spend across all users — same shape as /me plus topUsers.
 */
router.get('/overview', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const Transaction = mongoose.models.Transaction;
    const User = mongoose.models.User;
    const days = periodDays(req.query.days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const match = { createdAt: { $gte: since } };

    const [summaryAgg, daily, byModel, byContext, byUserAgg, recent] = await Promise.all([
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: null,
            input: { $sum: { $cond: [{ $eq: ['$tokenType', 'prompt'] }, absRawAmount, 0] } },
            output: { $sum: { $cond: [{ $eq: ['$tokenType', 'completion'] }, absRawAmount, 0] } },
            costRaw: { $sum: absTokenValue },
            requests: {
              $sum: {
                $cond: [
                  { $and: [{ $eq: ['$tokenType', 'completion'] }, { $ne: ['$context', 'title'] }] },
                  1,
                  0,
                ],
              },
            },
          },
        },
      ]),
      Transaction.aggregate([
        { $match: match },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            costRaw: { $sum: absTokenValue },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Transaction.aggregate([
        { $match: { ...match, model: { $exists: true, $ne: null } } },
        { $group: { _id: '$model', costRaw: { $sum: absTokenValue } } },
        { $sort: { costRaw: -1 } },
        { $limit: 8 },
      ]),
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: '$context', costRaw: { $sum: absTokenValue } } },
        { $sort: { costRaw: -1 } },
      ]),
      Transaction.aggregate([
        { $match: match },
        { $group: { _id: '$user', costRaw: { $sum: absTokenValue } } },
        { $sort: { costRaw: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'u' } },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $project: { costRaw: 1, name: '$u.name', email: '$u.email' } },
      ]),
      Transaction.find(match).sort({ createdAt: -1 }).limit(10).lean(),
    ]);

    const s = summaryAgg[0] || { input: 0, output: 0, costRaw: 0, requests: 0 };
    const totalTokens = s.input + s.output;
    void User;

    res.json({
      period: { days, since },
      summary: {
        costUsd: toUsd(s.costRaw),
        inputTokens: s.input,
        outputTokens: s.output,
        totalTokens,
        requests: s.requests,
        avgTokensPerRequest: s.requests ? Math.round(totalTokens / s.requests) : 0,
      },
      daily: daily.map((d) => ({ date: d._id, costUsd: toUsd(d.costRaw) })),
      byModel: byModel.map((m) => ({ model: m._id, costUsd: toUsd(m.costRaw) })),
      byContext: byContext.map((c) => ({
        context: c._id || 'other',
        label: CONTEXT_LABELS[c._id] || (c._id || 'Прочее'),
        costUsd: toUsd(c.costRaw),
      })),
      byUser: byUserAgg.map((u) => ({
        name: u.name || u.email || 'Пользователь',
        email: u.email,
        costUsd: toUsd(u.costRaw),
      })),
      recent: recent.map((t) => ({
        at: t.createdAt,
        model: t.model,
        context: t.context,
        tokenType: t.tokenType,
        tokens: Math.abs(t.rawAmount || 0),
        costUsd: toUsd(Math.abs(t.tokenValue || 0)),
      })),
    });
  } catch (error) {
    logger.error('[usage/overview] error:', error);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

/**
 * GET /api/usage/activity?days=30  (ADMIN only)
 * Behavioural analytics: daily active users, top agents, feedback, spend by department.
 */
router.get('/activity', async (req, res) => {
  try {
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Admin only' });
    }
    const Message = mongoose.models.Message;
    const Conversation = mongoose.models.Conversation;
    const Transaction = mongoose.models.Transaction;
    const days = periodDays(req.query.days);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    /** Fixed 30-day window for the feedback "За месяц" toggle (independent of the period selector). */
    const sinceMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [dau, topAgents, feedbackAgg, feedbackAllAgg, byDept] = await Promise.all([
      // Daily active users — distinct message authors per day.
      Message.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            users: { $addToSet: '$user' },
          },
        },
        { $project: { _id: 1, users: { $size: '$users' } } },
        { $sort: { _id: 1 } },
      ]),
      // Top agents by conversation count (+ resolve name).
      Conversation.aggregate([
        { $match: { createdAt: { $gte: since }, agent_id: { $exists: true, $ne: null } } },
        { $group: { _id: '$agent_id', conversations: { $sum: 1 } } },
        { $sort: { conversations: -1 } },
        { $limit: 8 },
        { $lookup: { from: 'agents', localField: '_id', foreignField: 'id', as: 'a' } },
        { $unwind: { path: '$a', preserveNullAndEmptyArrays: true } },
        { $project: { conversations: 1, name: '$a.name' } },
      ]),
      // Feedback tally (thumbsUp / thumbsDown) — last 30 days ("За месяц").
      Message.aggregate([
        { $match: { createdAt: { $gte: sinceMonth }, 'feedback.rating': { $exists: true, $ne: null } } },
        { $group: { _id: '$feedback.rating', n: { $sum: 1 } } },
      ]),
      // Feedback tally — all time (no date filter).
      Message.aggregate([
        { $match: { 'feedback.rating': { $exists: true, $ne: null } } },
        { $group: { _id: '$feedback.rating', n: { $sum: 1 } } },
      ]),
      // Spend by department (Transaction → User.departments).
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        {
          $lookup: {
            from: 'users',
            let: { uid: '$user' },
            pipeline: [{ $match: { $expr: { $eq: ['$_id', '$$uid'] } } }, { $project: { departments: 1 } }],
            as: 'u',
          },
        },
        { $unwind: { path: '$u', preserveNullAndEmptyArrays: true } },
        { $unwind: { path: '$u.departments', preserveNullAndEmptyArrays: false } },
        { $group: { _id: '$u.departments', costRaw: { $sum: absTokenValue } } },
        { $sort: { costRaw: -1 } },
      ]),
    ]);

    const feedback = { up: 0, down: 0 };
    for (const f of feedbackAgg) {
      if (f._id === 'thumbsUp') feedback.up = f.n;
      else if (f._id === 'thumbsDown') feedback.down = f.n;
    }

    const feedbackAllTime = { up: 0, down: 0 };
    for (const f of feedbackAllAgg) {
      if (f._id === 'thumbsUp') feedbackAllTime.up = f.n;
      else if (f._id === 'thumbsDown') feedbackAllTime.down = f.n;
    }

    res.json({
      period: { days, since },
      dau: dau.map((d) => ({ date: d._id, users: d.users })),
      topAgents: topAgents.map((a) => ({
        agentId: a._id,
        name: a.name || 'Без имени',
        conversations: a.conversations,
      })),
      feedback,
      feedbackAllTime,
      byDepartment: byDept.map((d) => ({ department: d._id, costUsd: toUsd(d.costRaw) })),
    });
  } catch (error) {
    logger.error('[usage/activity] error:', error);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

module.exports = router;
