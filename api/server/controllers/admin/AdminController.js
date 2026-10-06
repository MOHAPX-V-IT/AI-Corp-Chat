const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { SystemRoles } = require('librechat-data-provider');
const { logger } = require('@librechat/data-schemas');

// Valid departments (роли отделов)
const VALID_DEPARTMENTS = ['MP', 'RM', 'RGR', 'ROP', 'HR', 'PRODUCTION'];

// Valid positions (должности в иерархии)
const VALID_POSITIONS = ['RM', 'RGR', 'ROP', 'TRAINER', 'HR'];

// Department labels for display
const DEPARTMENT_LABELS = {
  MP: 'МП (Медицинский представитель)',
  RM: 'РМ (Региональный менеджер)',
  RGR: 'РГР (Руководитель группы регионов)',
  ROP: 'РОП (Руководитель отдела продаж)',
  HR: 'HR-отдел',
  PRODUCTION: 'Производство',
};

/**
 * Get all users with pagination and search
 */
const getAllUsers = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const Balance = mongoose.models.Balance;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const search = req.query.search || '';
    const skip = (page - 1) * limit;

    // Build search query
    let query = {};
    if (search) {
      const regex = new RegExp(search, 'i');
      query = {
        $or: [{ email: regex }, { name: regex }, { username: regex }],
      };
    }

    // Get users
    const users = await User.find(query)
      .select('-password -totpSecret -backupCodes -refreshToken')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    // Get balances for users
    const userIds = users.map((u) => u._id);
    const balances = await Balance.find({ user: { $in: userIds } }).lean();
    const balanceMap = new Map(balances.map((b) => [b.user.toString(), b.tokenCredits || 0]));

    // Add balance to users
    const usersWithBalance = users.map((user) => ({
      ...user,
      balance: balanceMap.get(user._id.toString()) || 0,
    }));

    const total = await User.countDocuments(query);

    res.json({
      users: usersWithBalance,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[AdminController] getAllUsers error:', error);
    res.status(500).json({ message: 'Failed to get users' });
  }
};

/**
 * Create a new user (admin only)
 */
const createUserAdmin = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const { email, password, name, role = SystemRoles.USER, departments = [], position = null } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    // Validate departments if provided
    if (departments && departments.length > 0) {
      const invalidDepts = departments.filter((dept) => !VALID_DEPARTMENTS.includes(dept));
      if (invalidDepts.length > 0) {
        return res.status(400).json({ message: 'Invalid departments' });
      }
    }

    // Validate position if provided
    if (position && !VALID_POSITIONS.includes(position)) {
      return res.status(400).json({ message: 'Invalid position' });
    }

    // Check if user exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      email: email.toLowerCase(),
      password: hashedPassword,
      name: name || email.split('@')[0],
      role: role,
      departments: departments,
      position: position,
      provider: 'local',
      emailVerified: true, // Admin-created users are verified
    });

    // Return user without sensitive fields
    const userResponse = user.toObject();
    delete userResponse.password;
    delete userResponse.refreshToken;

    logger.info(`[AdminController] User created by admin: ${email}`);
    res.status(201).json(userResponse);
  } catch (error) {
    logger.error('[AdminController] createUserAdmin error:', error);
    res.status(500).json({ message: 'Failed to create user' });
  }
};

/**
 * Delete a user (admin only)
 */
const deleteUserAdmin = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const { userId } = req.params;

    // Prevent admin from deleting themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot delete your own account' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    await User.deleteOne({ _id: userId });

    logger.info(`[AdminController] User deleted by admin: ${user.email}`);
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    logger.error('[AdminController] deleteUserAdmin error:', error);
    res.status(500).json({ message: 'Failed to delete user' });
  }
};

/**
 * Update user role (admin role)
 */
const updateUserRole = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const { userId } = req.params;
    const { role } = req.body;

    // Validate role
    const validRoles = Object.values(SystemRoles);
    if (!validRoles.includes(role)) {
      return res.status(400).json({ message: 'Invalid role' });
    }

    // Prevent admin from changing their own role
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot change your own role' });
    }

    const user = await User.findByIdAndUpdate(userId, { role }, { new: true })
      .select('-password -totpSecret -backupCodes -refreshToken')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`[AdminController] User role updated: ${user.email} -> ${role}`);
    res.json(user);
  } catch (error) {
    logger.error('[AdminController] updateUserRole error:', error);
    res.status(500).json({ message: 'Failed to update user role' });
  }
};

/**
 * Update user departments (роли отделов)
 */
const updateUserDepartment = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const { userId } = req.params;
    const { departments } = req.body;

    // Validate departments array
    if (!Array.isArray(departments)) {
      return res.status(400).json({ message: 'Departments must be an array' });
    }

    // Validate each department
    const invalidDepts = departments.filter((dept) => !VALID_DEPARTMENTS.includes(dept));
    if (invalidDepts.length > 0) {
      return res.status(400).json({ message: 'Invalid departments' });
    }

    const user = await User.findByIdAndUpdate(userId, { departments }, { new: true })
      .select('-password -totpSecret -backupCodes -refreshToken')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`[AdminController] User departments updated: ${user.email} -> ${departments.join(', ')}`);
    res.json(user);
  } catch (error) {
    logger.error('[AdminController] updateUserDepartment error:', error);
    res.status(500).json({ message: 'Failed to update user departments' });
  }
};

/**
 * Update user position (должность в иерархии)
 */
const updateUserPosition = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const { userId } = req.params;
    const { position } = req.body;

    // position can be null (to clear)
    if (position !== null && position !== undefined && !VALID_POSITIONS.includes(position)) {
      return res.status(400).json({ message: 'Invalid position' });
    }

    const user = await User.findByIdAndUpdate(userId, { position: position || null }, { new: true })
      .select('-password -totpSecret -backupCodes -refreshToken')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`[AdminController] User position updated: ${user.email} -> ${position}`);
    res.json(user);
  } catch (error) {
    logger.error('[AdminController] updateUserPosition error:', error);
    res.status(500).json({ message: 'Failed to update user position' });
  }
};

/**
 * Ban/unban a user
 */
const banUser = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const { userId } = req.params;
    const { banned, reason } = req.body;

    // Prevent admin from banning themselves
    if (userId === req.user.id) {
      return res.status(400).json({ message: 'Cannot ban your own account' });
    }

    const updateData = {
      banned: Boolean(banned),
      banReason: banned ? reason || 'Banned by admin' : null,
      bannedAt: banned ? new Date() : null,
    };

    const user = await User.findByIdAndUpdate(userId, updateData, { new: true })
      .select('-password -totpSecret -backupCodes -refreshToken')
      .lean();

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    logger.info(`[AdminController] User ${banned ? 'banned' : 'unbanned'}: ${user.email}`);
    res.json(user);
  } catch (error) {
    logger.error('[AdminController] banUser error:', error);
    res.status(500).json({ message: 'Failed to ban/unban user' });
  }
};

/**
 * Add balance to user
 */
const addUserBalance = async (req, res) => {
  try {
    const Balance = mongoose.models.Balance;
    const { userId } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({ message: 'Amount is required and must be a number' });
    }

    const balance = await Balance.findOneAndUpdate(
      { user: userId },
      { $inc: { tokenCredits: amount } },
      { new: true, upsert: true },
    ).lean();

    logger.info(`[AdminController] Balance updated for user ${userId}: ${amount > 0 ? '+' : ''}${amount}`);
    res.json({ balance: balance.tokenCredits });
  } catch (error) {
    logger.error('[AdminController] addUserBalance error:', error);
    res.status(500).json({ message: 'Failed to update balance' });
  }
};

/**
 * Get user transactions
 */
const getUserTransactions = async (req, res) => {
  try {
    const Transaction = mongoose.models.Transaction;
    const { userId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Transaction.countDocuments({ user: userId });

    res.json({
      transactions,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    logger.error('[AdminController] getUserTransactions error:', error);
    res.status(500).json({ message: 'Failed to get transactions' });
  }
};

/**
 * Get admin statistics
 */
const getAdminStats = async (req, res) => {
  try {
    const User = mongoose.models.User;
    const Transaction = mongoose.models.Transaction;
    const Conversation = mongoose.models.Conversation;
    const Message = mongoose.models.Message;

    // Get date ranges
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

    // User stats
    const totalUsers = await User.countDocuments();
    const newUsersToday = await User.countDocuments({ createdAt: { $gte: today } });
    const newUsersWeek = await User.countDocuments({ createdAt: { $gte: weekAgo } });
    const newUsersMonth = await User.countDocuments({ createdAt: { $gte: monthAgo } });

    // Token stats — all time, split input/output + USD cost
    const tokenStats = await Transaction.aggregate([
      {
        $group: {
          _id: null,
          totalInput: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: { $ifNull: ['$rawAmount', 0] } }, 0],
            },
          },
          totalOutput: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: { $ifNull: ['$rawAmount', 0] } }, 0],
            },
          },
          totalCostRaw: {
            $sum: { $abs: { $ifNull: ['$tokenValue', 0] } },
          },
        },
      },
    ]);

    // Count actual requests — all time
    const requestCount = await Transaction.countDocuments({
      tokenType: 'completion',
      context: { $ne: 'title' },
    });

    // Conversation stats
    const totalConversations = await Conversation.countDocuments();
    const conversationsToday = await Conversation.countDocuments({ createdAt: { $gte: today } });
    const conversationsWeek = await Conversation.countDocuments({ createdAt: { $gte: weekAgo } });

    // Message stats
    const totalMessages = await Message.countDocuments();
    const messagesToday = await Message.countDocuments({ createdAt: { $gte: today } });

    // Token usage by model — all time, with input/output/cost
    const tokensByModel = await Transaction.aggregate([
      {
        $match: {
          model: { $exists: true, $ne: null },
        },
      },
      {
        $group: {
          _id: '$model',
          inputTokens: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: { $ifNull: ['$rawAmount', 0] } }, 0],
            },
          },
          outputTokens: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: { $ifNull: ['$rawAmount', 0] } }, 0],
            },
          },
          totalCostRaw: {
            $sum: { $abs: { $ifNull: ['$tokenValue', 0] } },
          },
          requestCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$tokenType', 'completion'] },
                    { $ne: ['$context', 'title'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { totalCostRaw: -1 } },
      {
        $project: {
          _id: 1,
          inputTokens: 1,
          outputTokens: 1,
          costUsd: { $divide: ['$totalCostRaw', 1000000] },
          requestCount: 1,
        },
      },
    ]);

    // User spending — ALL users, all time, with input/output/cost
    const userSpending = await Transaction.aggregate([
      {
        $group: {
          _id: '$user',
          inputTokens: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: { $ifNull: ['$rawAmount', 0] } }, 0],
            },
          },
          outputTokens: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: { $ifNull: ['$rawAmount', 0] } }, 0],
            },
          },
          inputCostRaw: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'prompt'] }, { $abs: { $ifNull: ['$tokenValue', 0] } }, 0],
            },
          },
          outputCostRaw: {
            $sum: {
              $cond: [{ $eq: ['$tokenType', 'completion'] }, { $abs: { $ifNull: ['$tokenValue', 0] } }, 0],
            },
          },
          requestCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$tokenType', 'completion'] },
                    { $ne: ['$context', 'title'] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
      { $sort: { inputCostRaw: -1 } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user',
        },
      },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          inputTokens: 1,
          outputTokens: 1,
          inputCostUsd: { $divide: ['$inputCostRaw', 1000000] },
          outputCostUsd: { $divide: ['$outputCostRaw', 1000000] },
          totalCostUsd: { $divide: [{ $add: ['$inputCostRaw', '$outputCostRaw'] }, 1000000] },
          requestCount: 1,
          'user.name': 1,
          'user.email': 1,
        },
      },
    ]);

    const stats = tokenStats[0] || { totalInput: 0, totalOutput: 0, totalCostRaw: 0 };

    res.json({
      users: {
        total: totalUsers,
        newToday: newUsersToday,
        newWeek: newUsersWeek,
        newMonth: newUsersMonth,
      },
      tokens: {
        totalInput: stats.totalInput,
        totalOutput: stats.totalOutput,
        totalCostUsd: stats.totalCostRaw / 1000000,
        requests: requestCount,
      },
      conversations: {
        total: totalConversations,
        today: conversationsToday,
        week: conversationsWeek,
      },
      messages: {
        total: totalMessages,
        today: messagesToday,
      },
      tokensByModel,
      userSpending,
      departments: DEPARTMENT_LABELS,
    });
  } catch (error) {
    logger.error('[AdminController] getAdminStats error:', error);
    res.status(500).json({ message: 'Failed to get statistics' });
  }
};

/**
 * Get available departments
 */
const getDepartments = async (req, res) => {
  res.json({
    departments: VALID_DEPARTMENTS,
    labels: DEPARTMENT_LABELS,
  });
};

/**
 * Update user profile (email, name, password)
 * Admin can update any user's profile information
 */
const updateUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;
    const { email, name, password } = req.body;

    const User = mongoose.models.User;

    // Validate userId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    // Find user
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const updates = {};

    // Update email if provided
    if (email && email !== user.email) {
      // Check if email already exists
      const existingUser = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: userId }
      });

      if (existingUser) {
        return res.status(400).json({
          message: 'Email already in use by another user'
        });
      }

      updates.email = email.toLowerCase();
      updates.username = email.toLowerCase(); // Sync username with email
    }

    // Update name if provided
    if (name !== undefined && name !== user.name) {
      updates.name = name;
    }

    // Update password if provided
    if (password) {
      // Validate password length
      if (password.length < 8) {
        return res.status(400).json({
          message: 'Password must be at least 8 characters'
        });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      updates.password = await bcrypt.hash(password, salt);
    }

    // Check if there are any updates
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No changes provided'
      });
    }

    // Update user
    await User.updateOne({ _id: userId }, { $set: updates });

    logger.info(`[AdminController] User profile updated by admin: ${userId}`, {
      updatedFields: Object.keys(updates),
      adminId: req.user.id,
    });

    res.json({
      message: 'User profile updated successfully',
      updatedFields: Object.keys(updates)
    });
  } catch (error) {
    logger.error('[AdminController] updateUserProfile error:', error);
    res.status(500).json({ message: 'Failed to update user profile' });
  }
};

module.exports = {
  getAllUsers,
  createUserAdmin,
  deleteUserAdmin,
  updateUserRole,
  updateUserDepartment,
  updateUserPosition,
  updateUserProfile,
  banUser,
  addUserBalance,
  getUserTransactions,
  getAdminStats,
  getDepartments,
};
