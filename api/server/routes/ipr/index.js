const express = require('express');
const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { createAiFeatureLimiter } = require('~/server/middleware/limiters/aiFeatureLimiters');
const {
  getIprEntries,
  getAllIprEntries,
  createIprEntry,
  getIprEntryById,
  deleteIprEntry,
  updateIprEntry,
  getUniqueEmployeeNames,
  getIprEntriesByIds,
} = require('~/models/IprEntry');
const { getMessages } = require('~/models/Message');
const { parseDialogForIpr } = require('~/server/services/IprParserService');
const { generateDynamicsAnalysis } = require('~/server/services/IprDynamicsService');

const router = express.Router();
router.use(requireJwtAuth);
router.use(checkBan);
// Keep the restored screens under the existing manager hierarchy.
router.use((req, res, next) => {
  if (!getManagerRole(req.user)) return res.status(403).json({ error: 'Access denied' });
  next();
});

// Rate limiter for expensive Gemini-backed analysis endpoints.
const iprAiLimiter = createAiFeatureLimiter('ipr');

/**
 * Determine user's manager role from position field
 */
function getManagerRole(user) {
  if (user.role === 'ADMIN') return 'ROP';
  const pos = user.position;
  if (pos === 'ROP' || pos === 'TRAINER') return 'ROP';
  if (pos === 'RGR') return 'RGR';
  if (pos === 'RM') return 'RM';
  return null;
}

/**
 * Build filter for hierarchical access
 */
function buildIprFilter({ userManagerRole, isAdmin, userId, tab, dateFrom, dateTo, search }) {
  const filter = {};

  if (!isAdmin) {
    if (userManagerRole === 'RM') {
      // РМ видит только ИПР МП и только свои записи
      filter.employeeDepartment = 'MP';
      filter.author = userId;
    } else if (userManagerRole === 'RGR') {
      // РГР видит ИПР МП (все) + ИПР РМ (свои) + Новички
      if (tab === 'mp') {
        filter.employeeDepartment = 'MP';
      } else if (tab === 'rm') {
        filter.employeeDepartment = 'RM';
        filter.author = userId;
      } else if (tab === 'newcomer') {
        filter.employeeDepartment = 'NEWCOMER_MP';
      } else {
        filter.employeeDepartment = 'MP'; // Default
      }
    } else if (userManagerRole === 'ROP') {
      // РОП видит всё
      const tabMap = { mp: 'MP', rm: 'RM', rgr: 'RGR', newcomer: 'NEWCOMER_MP' };
      if (tab) {
        filter.employeeDepartment = tabMap[tab];
      }
    } else {
      // Нет доступа
      filter._id = null;
    }
  } else {
    // Admin видит всё
    const tabMap = { mp: 'MP', rm: 'RM', rgr: 'RGR', newcomer: 'NEWCOMER_MP' };
    if (tab) {
      filter.employeeDepartment = tabMap[tab];
    }
  }

  // Date range filter
  if (dateFrom || dateTo) {
    filter.eventDate = {};
    if (dateFrom) {
      filter.eventDate.$gte = new Date(dateFrom);
    }
    if (dateTo) {
      filter.eventDate.$lte = new Date(dateTo);
    }
  }

  // Search filter
  if (search) {
    filter.$or = [
      { employeeName: { $regex: search, $options: 'i' } },
      { managerName: { $regex: search, $options: 'i' } },
    ];
  }

  return filter;
}

/**
 * Row-level READ access for a single IPR entry. Mirrors the visibility of the
 * list (buildIprFilter) so a manager who sees an entry in the list can also open
 * it. Fixes the mismatch where ROP/RGR saw entries in the list but got 403 on open.
 */
function canReadIprEntry(user, entry) {
  if (user.role === 'ADMIN') {
    return true;
  }
  const role = getManagerRole(user);
  const dept = entry.employeeDepartment;
  const isAuthor = entry.author?.toString() === user._id.toString();
  if (role === 'ROP') {
    return true;
  }
  if (role === 'RGR') {
    if (dept === 'MP' || dept === 'NEWCOMER_MP') {
      return true;
    }
    return dept === 'RM' && isAuthor;
  }
  if (role === 'RM') {
    return dept === 'MP' && isAuthor;
  }
  return false;
}

/**
 * GET /api/ipr - List IPR entries with role-based filtering
 */
router.get('/', async (req, res) => {
  try {
    const userManagerRole = getManagerRole(req.user);
    const isAdmin = req.user.role === 'ADMIN';
    const { tab, dateFrom, dateTo, search, page = 1, limit = 50 } = req.query;

    const filter = buildIprFilter({
      userManagerRole,
      isAdmin,
      userId: req.user._id,
      tab,
      dateFrom,
      dateTo,
      search,
    });

    const result = await getIprEntries(filter, Number(page), Number(limit));
    res.json(result);
  } catch (error) {
    logger.error('[IPR] List error:', error);
    res.status(500).json({ error: 'Failed to list IPR entries' });
  }
});

/**
 * POST /api/ipr/parse - Parse conversation and create IPR entry
 */
router.post('/parse', iprAiLimiter, async (req, res) => {
  try {
    const { conversationId, agentId, newcomerProfileId } = req.body;

    if (!conversationId) {
      return res.status(400).json({ error: 'conversationId is required' });
    }

    // Get conversation
    const { Conversation } = require('~/db/models');
    const conversation = await Conversation.findOne({
      conversationId,
      user: req.user._id,
    }).lean();

    if (!conversation) {
      return res.status(404).json({ error: 'Conversation not found' });
    }

    // Get messages for this conversation
    const messages = await getMessages({ conversationId });

    // Add messages to conversation object for parsing
    conversation.messages = messages;

    // Determine employeeDepartment from agent's ipr_target field
    let employeeDepartment = 'MP'; // default
    let iprTarget = null;
    if (agentId) {
      const { getAgent } = require('~/models/Agent');
      const agent = await getAgent({ id: agentId });
      if (agent && agent.ipr_target) {
        employeeDepartment = agent.ipr_target;
        iprTarget = agent.ipr_target;
        logger.info(`[IPR] Agent ipr_target: ${agent.ipr_target} → employeeDepartment: ${employeeDepartment}`);
      } else {
        logger.info(`[IPR] Agent has no ipr_target, defaulting to MP`);
      }
    }

    // Parse with AI (pass ipr_target for context-specific prompts)
    const parsedData = await parseDialogForIpr(conversation, {
      iprTarget,
      userId: req.user._id,
      conversationId,
      agentId,
    });

    // Create IPR entry
    const ipr_id = crypto.randomUUID();
    const entry = await createIprEntry({
      ipr_id,
      author: req.user._id,
      managerName: req.user.name,
      conversationId,
      agentId,
      ...parsedData,
      employeeDepartment, // Override AI-extracted value with logic-based value
      ...(newcomerProfileId && { newcomerProfileId }),
    });

    logger.info(`[IPR] Created entry ${ipr_id} for employee ${parsedData.employeeName}`);
    res.status(201).json(entry);
  } catch (error) {
    logger.error('[IPR] Parse error:', error);
    res.status(500).json({ error: error.message || 'Failed to parse and save IPR entry' });
  }
});


/**
 * GET /api/ipr/employees - Get unique employee names for dropdown
 */
router.get('/employees', async (req, res) => {
  try {
    const filter = buildIprFilter({
      userManagerRole: getManagerRole(req.user), isAdmin: req.user.role === 'ADMIN',
      userId: req.user._id, tab: req.query.tab,
    });
    const names = await getUniqueEmployeeNames(filter);
    res.json({ names: names.sort() });
  } catch (error) {
    logger.error('[IPR] Get employees error:', error);
    res.status(500).json({ error: 'Failed to get employee names' });
  }
});

/**
 * POST /api/ipr/analyze-selected - Analyze dynamics for selected IPR entries
 */
router.post('/analyze-selected', iprAiLimiter, async (req, res) => {
  try {
    const { iprIds } = req.body;
    if (!iprIds || !Array.isArray(iprIds) || iprIds.length === 0) {
      return res.status(400).json({ error: 'iprIds array is required' });
    }

    const entries = await getIprEntriesByIds(iprIds);
    if (entries.some((entry) => !canReadIprEntry(req.user, entry))) {
      return res.status(403).json({ error: 'Access denied' });
    }
    if (entries.length === 0) {
      return res.status(404).json({ error: 'No entries found for given IDs' });
    }

    const uniqueNames = [...new Set(entries.map((e) => e.employeeName))];
    const label = uniqueNames.length === 1 ? uniqueNames[0] : `${uniqueNames.length} сотрудников`;

    const analysis = await generateDynamicsAnalysis(label, entries, { userId: req.user._id });

    logger.info(`[IPR] Generated analysis for selected entries (${entries.length} entries)`);
    res.json({
      employeeName: label,
      entriesCount: entries.length,
      analysis,
    });
  } catch (error) {
    logger.error('[IPR] Analyze selected error:', error);
    res.status(500).json({ error: 'Failed to analyze selected entries' });
  }
});

/**
 * POST /api/ipr/analyze-dynamics - Generate visual dynamics dashboard data
 */
router.post('/analyze-dynamics', iprAiLimiter, async (req, res) => {
  try {
    const { iprIds, employeeName, dateFrom, dateTo } = req.body;

    let entries;
    if (iprIds && Array.isArray(iprIds) && iprIds.length > 0) {
      // Mode A: by selected entry IDs
      entries = await getIprEntriesByIds(iprIds);
      if (entries.some((entry) => !canReadIprEntry(req.user, entry))) {
        return res.status(403).json({ error: 'Access denied' });
      }
    } else if (employeeName) {
      // Mode B: by employee name + optional date range
      const filter = { employeeName };
      if (dateFrom || dateTo) {
        filter.eventDate = {};
        if (dateFrom) filter.eventDate.$gte = new Date(dateFrom);
        if (dateTo) filter.eventDate.$lte = new Date(dateTo);
      }
      entries = (await getAllIprEntries(filter)).filter((entry) => canReadIprEntry(req.user, entry));
    } else {
      return res.status(400).json({ error: 'iprIds or employeeName is required' });
    }

    if (!entries || entries.length === 0) {
      return res.status(404).json({ error: 'No entries found' });
    }

    const uniqueNames = [...new Set(entries.map((e) => e.employeeName))];
    const resolvedName = uniqueNames.length === 1 ? uniqueNames[0] : uniqueNames.join(', ');
    const employeeDepartment = entries[0].employeeDepartment || '';
    const managerName = entries[0].managerName || '';

    const dates = entries.map((e) => new Date(e.eventDate)).sort((a, b) => a - b);
    const from = dates[0].toISOString().slice(0, 10);
    const to = dates[dates.length - 1].toISOString().slice(0, 10);
    const days = Math.round((dates[dates.length - 1] - dates[0]) / (1000 * 60 * 60 * 24));

    const dynamics = await generateDynamicsAnalysis(resolvedName, entries, { userId: req.user._id });

    logger.info(`[IPR] Generated dynamics dashboard for ${resolvedName} (${entries.length} entries)`);
    res.json({
      employeeName: resolvedName,
      employeeDepartment,
      managerName,
      entriesCount: entries.length,
      period: { from, to, days },
      dynamics,
    });
  } catch (error) {
    logger.error('[IPR] Analyze dynamics error:', error);
    res.status(500).json({ error: 'Failed to generate dynamics analysis' });
  }
});

/**
 * POST /api/ipr/save-dynamics - Save dynamics analysis as IPR entry
 */
router.post('/save-dynamics', async (req, res) => {
  try {
    const { employeeName, employeeDepartment, dynamicsJson, period } = req.body;

    if (!employeeName || !dynamicsJson) {
      return res.status(400).json({ error: 'employeeName and dynamicsJson are required' });
    }

    const dynamics = typeof dynamicsJson === 'string' ? JSON.parse(dynamicsJson) : dynamicsJson;

    const ipr_id = crypto.randomUUID();
    const entry = await createIprEntry({
      ipr_id,
      author: req.user._id,
      managerName: req.user.name,
      employeeName,
      employeeDepartment: employeeDepartment || 'MP',
      eventDate: period?.to ? new Date(period.to) : new Date(),
      classification: 'Анализ динамики',
      focusSkills: (dynamics.skills || []).map((s) => s.name),
      summary: dynamics.verdict?.paragraphs?.join(' ').substring(0, 1000) || dynamics.verdict?.title || 'Анализ динамики ИПР',
      fullAnalysis: JSON.stringify(dynamics),
    });

    logger.info(`[IPR] Saved dynamics analysis ${ipr_id} for ${employeeName}`);
    res.status(201).json(entry);
  } catch (error) {
    logger.error('[IPR] Save dynamics error:', error);
    res.status(500).json({ error: 'Failed to save dynamics analysis' });
  }
});

/**
 * PUT /api/ipr/:id - Update IPR entry fields
 */
router.put('/:id', async (req, res) => {
  try {
    const entry = await getIprEntryById(req.params.id);
    if (!entry) {
      return res.status(404).json({ error: 'IPR entry not found' });
    }

    const isAuthor = entry.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';
    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Only author or admin can edit' });
    }

    const updated = await updateIprEntry(req.params.id, req.body);
    logger.info(`[IPR] Updated entry ${req.params.id}`);
    res.json(updated);
  } catch (error) {
    logger.error('[IPR] Update error:', error);
    res.status(500).json({ error: 'Failed to update IPR entry' });
  }
});

/**
 * GET /api/ipr/:id - Get single IPR entry
 */
router.get('/:id', async (req, res) => {
  try {
    const entry = await getIprEntryById(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'IPR entry not found' });
    }

    // Read access mirrors list visibility (ROP: all, RGR: MP/newcomer + own RM, RM: own MP).
    if (!canReadIprEntry(req.user, entry)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(entry);
  } catch (error) {
    logger.error('[IPR] Get error:', error);
    res.status(500).json({ error: 'Failed to get IPR entry' });
  }
});

/**
 * DELETE /api/ipr/:id - Delete IPR entry
 */
router.delete('/:id', async (req, res) => {
  try {
    const entry = await getIprEntryById(req.params.id);

    if (!entry) {
      return res.status(404).json({ error: 'IPR entry not found' });
    }

    const isAuthor = entry.author.toString() === req.user._id.toString();
    const isAdmin = req.user.role === 'ADMIN';

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Only author or admin can delete' });
    }

    await deleteIprEntry(req.params.id);

    logger.info(`[IPR] Deleted entry ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[IPR] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete IPR entry' });
  }
});

module.exports = router;
