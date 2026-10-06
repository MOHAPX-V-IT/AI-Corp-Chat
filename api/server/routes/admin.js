const express = require('express');
const { requireJwtAuth } = require('~/server/middleware');
const checkAdmin = require('~/server/middleware/roles/admin');
const {
  getAllUsers,
  createUserAdmin,
  deleteUserAdmin,
  updateUserRole,
  updateUserDepartment,
  updateUserPosition,
  updateUserProfile,
  banUser,
  getAdminStats,
  getUserTransactions,
  addUserBalance,
  getDepartments,
} = require('~/server/controllers/admin/AdminController');

const router = express.Router();

// All routes require JWT auth and admin role
router.use(requireJwtAuth);
router.use(checkAdmin);

// User management
router.get('/users', getAllUsers);
router.post('/users', createUserAdmin);
router.delete('/users/:userId', deleteUserAdmin);
router.put('/users/:userId/role', updateUserRole);
router.put('/users/:userId/departments', updateUserDepartment);
router.put('/users/:userId/position', updateUserPosition);
router.put('/users/:userId/profile', updateUserProfile);
router.post('/users/:userId/ban', banUser);

// Departments
router.get('/departments', getDepartments);

// Balance management
router.post('/users/:userId/balance', addUserBalance);
router.get('/users/:userId/transactions', getUserTransactions);

// Statistics
router.get('/stats', getAdminStats);

module.exports = router;
