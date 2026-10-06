const express = require('express');
const mongoose = require('mongoose');
const {
  updateUserPluginsController,
  resendVerificationController,
  getTermsStatusController,
  acceptTermsController,
  verifyEmailController,
  deleteUserController,
  getUserController,
} = require('~/server/controllers/UserController');
const {
  verifyEmailLimiter,
  configMiddleware,
  canDeleteAccount,
  requireJwtAuth,
} = require('~/server/middleware');

const settings = require('./settings');

const router = express.Router();

router.use('/settings', settings);
router.get('/', requireJwtAuth, getUserController);
router.get('/terms', requireJwtAuth, getTermsStatusController);
router.post('/terms/accept', requireJwtAuth, acceptTermsController);
router.post('/plugins', requireJwtAuth, updateUserPluginsController);
router.delete('/delete', requireJwtAuth, canDeleteAccount, configMiddleware, deleteUserController);
router.post('/verify', verifyEmailController);
router.post('/verify/resend', verifyEmailLimiter, resendVerificationController);

// [UI] Автокомплит руководителей для формы новичка: только пользователи с
// руководящей должностью (RM/RGR/ROP/TRAINER), поиск по имени, минимум полей.
const MANAGER_POSITIONS = ['RM', 'RGR', 'ROP', 'TRAINER'];
router.get('/lookup/managers', requireJwtAuth, async (req, res) => {
  try {
    const User = mongoose.models.User;
    const q = (req.query.q || '').toString().trim();
    const filter = { position: { $in: MANAGER_POSITIONS } };
    if (q) {
      const safe = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.name = new RegExp(safe, 'i');
    }
    const managers = await User.find(filter)
      .sort({ name: 1 })
      .limit(20)
      .select('name position departments')
      .lean();
    res.json({
      managers: managers.map((u) => ({
        id: String(u._id),
        name: u.name,
        position: u.position,
        departments: u.departments || [],
      })),
    });
  } catch (err) {
    res.status(500).json({ message: 'lookup failed' });
  }
});

module.exports = router;
