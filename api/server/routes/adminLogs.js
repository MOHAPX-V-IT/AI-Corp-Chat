const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { queryLogs, distinctLogUsers } = require('~/models/AppLog');

const router = express.Router();
router.use(requireJwtAuth);
router.use(checkBan);
router.use((req, res, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ error: 'Admin only' });
  }
  next();
});

/** GET /api/logs?level=&userId=&source=&search=&page=&limit= */
router.get('/', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const data = await queryLogs({
      level: req.query.level,
      userId: req.query.userId,
      source: req.query.source,
      search: req.query.search,
      page,
      limit,
    });
    res.json(data);
  } catch (error) {
    logger.error('[adminLogs] list error:', error);
    res.status(500).json({ error: 'Failed to load logs' });
  }
});

/** GET /api/logs/users — distinct users present in the logs (for filtering). */
router.get('/users', async (req, res) => {
  try {
    res.json({ users: await distinctLogUsers() });
  } catch (error) {
    logger.error('[adminLogs] users error:', error);
    res.status(500).json({ error: 'Failed to load log users' });
  }
});

module.exports = router;
