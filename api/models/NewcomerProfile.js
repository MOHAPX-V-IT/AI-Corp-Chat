const { logger } = require('@librechat/data-schemas');

/**
 * Get paginated list of newcomer profiles
 */
const getNewcomerProfiles = async (filter, page = 1, limit = 50) => {
  try {
    const { NewcomerProfile } = require('~/db/models');
    const skip = (page - 1) * limit;

    const [profiles, total] = await Promise.all([
      NewcomerProfile.find(filter)
        .populate('createdBy', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      NewcomerProfile.countDocuments(filter),
    ]);

    return {
      profiles,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('[NewcomerProfile] getNewcomerProfiles error:', error);
    throw error;
  }
};

/**
 * Get active newcomers for dropdown (lightweight, no large text fields)
 */
const getActiveNewcomers = async (filter = {}) => {
  try {
    const { NewcomerProfile } = require('~/db/models');
    return await NewcomerProfile.find(
      { ...filter, status: { $ne: 'completed' } },
      { profile_id: 1, name: 1, department: 1, status: 1, rm: 1 },
    )
      .sort({ name: 1 })
      .lean();
  } catch (error) {
    logger.error('[NewcomerProfile] getActiveNewcomers error:', error);
    throw error;
  }
};

/**
 * Create a new newcomer profile
 */
const createNewcomerProfile = async (data) => {
  try {
    const { NewcomerProfile } = require('~/db/models');
    return await NewcomerProfile.create(data);
  } catch (error) {
    logger.error('[NewcomerProfile] createNewcomerProfile error:', error);
    throw error;
  }
};

/**
 * Get newcomer profile by profile_id
 */
const getNewcomerProfileById = async (profile_id) => {
  try {
    const { NewcomerProfile } = require('~/db/models');
    return await NewcomerProfile.findOne({ profile_id })
      .populate('createdBy', 'name email')
      .lean();
  } catch (error) {
    logger.error('[NewcomerProfile] getNewcomerProfileById error:', error);
    throw error;
  }
};

/**
 * Update newcomer profile
 */
const updateNewcomerProfile = async (profile_id, updates) => {
  try {
    const { NewcomerProfile } = require('~/db/models');
    const allowedFields = [
      'name', 'rm', 'department', 'startDate',
      'resumeText', 'bigFiveResults', 'managerComments', 'status',
    ];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }
    return await NewcomerProfile.findOneAndUpdate(
      { profile_id },
      { $set: safeUpdates },
      { new: true, runValidators: true },
    ).populate('createdBy', 'name email').lean();
  } catch (error) {
    logger.error('[NewcomerProfile] updateNewcomerProfile error:', error);
    throw error;
  }
};

/**
 * Delete newcomer profile
 */
const deleteNewcomerProfile = async (profile_id) => {
  try {
    const { NewcomerProfile } = require('~/db/models');
    return await NewcomerProfile.findOneAndDelete({ profile_id }).lean();
  } catch (error) {
    logger.error('[NewcomerProfile] deleteNewcomerProfile error:', error);
    throw error;
  }
};

module.exports = {
  getNewcomerProfiles,
  getActiveNewcomers,
  createNewcomerProfile,
  getNewcomerProfileById,
  updateNewcomerProfile,
  deleteNewcomerProfile,
};
