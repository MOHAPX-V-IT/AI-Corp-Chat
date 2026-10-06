const express = require('express');
const crypto = require('crypto');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const {
  getNewcomerProfiles,
  getActiveNewcomers,
  createNewcomerProfile,
  getNewcomerProfileById,
  updateNewcomerProfile,
  deleteNewcomerProfile,
} = require('~/models/NewcomerProfile');

const router = express.Router();
router.use(requireJwtAuth);
router.use(checkBan);

/**
 * Check if user has access to newcomer profiles
 * Allowed: ADMIN, RM, RGR, ROP, HR (by position)
 */
function hasNewcomerAccess(user) {
  if (user.role === 'ADMIN') return true;
  const allowedPositions = ['RM', 'RGR', 'ROP', 'HR', 'TRAINER'];
  return allowedPositions.includes(user.position);
}

/**
 * Middleware to check newcomer access
 */
function requireNewcomerAccess(req, res, next) {
  if (!hasNewcomerAccess(req.user)) {
    return res.status(403).json({ error: 'Access denied. Only RM, RGR, ROP, HR and ADMIN can manage newcomer profiles.' });
  }
  next();
}

/**
 * Row-level access check for a specific newcomer profile.
 * Full access: ADMIN and HR (oversee all). Otherwise the creator, or a manager
 * whose departments include the profile's department. Protects sensitive fields
 * (resumeText, bigFiveResults, managerComments) from cross-department access.
 */
function canAccessNewcomer(user, profile) {
  if (user.role === 'ADMIN' || user.position === 'HR') return true;
  const creatorId = profile.createdBy?._id?.toString() || profile.createdBy?.toString();
  if (creatorId && creatorId === user._id.toString()) return true;
  const depts = user.departments || [];
  return !!profile.department && depts.includes(profile.department);
}

router.use(requireNewcomerAccess);

/**
 * GET /api/newcomer - List newcomer profiles (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const { department, status, rm, search, page = 1, limit = 50 } = req.query;
    const filter = {};

    if (department) filter.department = department;
    if (status) filter.status = status;
    if (rm) filter.rm = { $regex: rm, $options: 'i' };

    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { rm: { $regex: search, $options: 'i' } },
      ];
    }

    // Row-level scoping for non-privileged managers: only own department or own created profiles.
    const isPrivileged = req.user.role === 'ADMIN' || req.user.position === 'HR';
    if (!isPrivileged) {
      const depts = req.user.departments || [];
      filter.$and = (filter.$and || []).concat([
        { $or: [{ department: { $in: depts } }, { createdBy: req.user._id }] },
      ]);
    }

    const result = await getNewcomerProfiles(filter, Number(page), Number(limit));
    res.json(result);
  } catch (error) {
    logger.error('[Newcomer] List error:', error);
    res.status(500).json({ error: 'Failed to list newcomer profiles' });
  }
});

/**
 * GET /api/newcomer/active - Get active newcomers for dropdown (lightweight)
 */
router.get('/active', async (req, res) => {
  try {
    const profiles = await getActiveNewcomers();
    res.json({ profiles });
  } catch (error) {
    logger.error('[Newcomer] Active list error:', error);
    res.status(500).json({ error: 'Failed to get active newcomers' });
  }
});

/**
 * POST /api/newcomer - Create new newcomer profile
 */
router.post('/', async (req, res) => {
  try {
    const { name, rm, department, startDate, resumeText, bigFiveResults, managerComments, status } = req.body;

    if (!name || !rm || !department || !startDate) {
      return res.status(400).json({ error: 'name, rm, department and startDate are required' });
    }

    const profile = await createNewcomerProfile({
      profile_id: crypto.randomUUID(),
      name,
      rm,
      department,
      startDate: new Date(startDate),
      resumeText,
      bigFiveResults,
      managerComments,
      status: status || 'candidate',
      createdBy: req.user._id,
    });

    logger.info(`[Newcomer] Created profile ${profile.profile_id} for ${name}`);
    res.status(201).json(profile);
  } catch (error) {
    logger.error('[Newcomer] Create error:', error);
    res.status(500).json({ error: 'Failed to create newcomer profile' });
  }
});

/**
 * GET /api/newcomer/:id - Get single profile (full data)
 */
router.get('/:id', async (req, res) => {
  try {
    const profile = await getNewcomerProfileById(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Newcomer profile not found' });
    }
    if (!canAccessNewcomer(req.user, profile)) {
      return res.status(403).json({ error: 'Access denied to this newcomer profile' });
    }
    res.json(profile);
  } catch (error) {
    logger.error('[Newcomer] Get error:', error);
    res.status(500).json({ error: 'Failed to get newcomer profile' });
  }
});

/**
 * PUT /api/newcomer/:id - Update profile
 */
router.put('/:id', async (req, res) => {
  try {
    const profile = await getNewcomerProfileById(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Newcomer profile not found' });
    }
    if (!canAccessNewcomer(req.user, profile)) {
      return res.status(403).json({ error: 'Access denied to this newcomer profile' });
    }

    const updated = await updateNewcomerProfile(req.params.id, req.body);
    logger.info(`[Newcomer] Updated profile ${req.params.id}`);
    res.json(updated);
  } catch (error) {
    logger.error('[Newcomer] Update error:', error);
    res.status(500).json({ error: 'Failed to update newcomer profile' });
  }
});

/**
 * DELETE /api/newcomer/:id - Delete profile
 */
router.delete('/:id', async (req, res) => {
  try {
    const profile = await getNewcomerProfileById(req.params.id);
    if (!profile) {
      return res.status(404).json({ error: 'Newcomer profile not found' });
    }

    const isAdmin = req.user.role === 'ADMIN';
    const isCreator = profile.createdBy?._id?.toString() === req.user._id.toString();
    if (!isAdmin && !isCreator) {
      return res.status(403).json({ error: 'Only creator or admin can delete' });
    }

    await deleteNewcomerProfile(req.params.id);
    logger.info(`[Newcomer] Deleted profile ${req.params.id}`);
    res.json({ success: true });
  } catch (error) {
    logger.error('[Newcomer] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete newcomer profile' });
  }
});

module.exports = router;
