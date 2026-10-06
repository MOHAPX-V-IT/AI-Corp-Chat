const { logger } = require('@librechat/data-schemas');

/**
 * Get paginated list of IPR entries
 * @param {Object} filter - MongoDB filter object
 * @param {number} page - Page number (1-indexed)
 * @param {number} limit - Entries per page
 * @returns {Promise<{entries: Array, total: number, page: number, pages: number}>}
 */
const getIprEntries = async (filter, page = 1, limit = 50) => {
  try {
    const { IprEntry } = require('~/db/models');
    const skip = (page - 1) * limit;

    const [entries, total] = await Promise.all([
      IprEntry.find(filter)
        .populate('author', 'name email')
        .sort({ eventDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      IprEntry.countDocuments(filter),
    ]);

    return {
      entries,
      total,
      page: Number(page),
      pages: Math.ceil(total / limit),
    };
  } catch (error) {
    logger.error('[IprEntry] getIprEntries error:', error);
    throw error;
  }
};

/**
 * Get all IPR entries for a filter (for analysis, no pagination)
 * @param {Object} filter - MongoDB filter object
 * @returns {Promise<Array>}
 */
const getAllIprEntries = async (filter) => {
  try {
    const { IprEntry } = require('~/db/models');
    return await IprEntry.find(filter)
      .sort({ eventDate: 1 }) // Chronological order for analysis
      .lean();
  } catch (error) {
    logger.error('[IprEntry] getAllIprEntries error:', error);
    throw error;
  }
};

/**
 * Create a new IPR entry
 * @param {Object} data - IPR entry data
 * @returns {Promise<Object>}
 */
const createIprEntry = async (data) => {
  try {
    const { IprEntry } = require('~/db/models');
    return await IprEntry.create(data);
  } catch (error) {
    logger.error('[IprEntry] createIprEntry error:', error);
    throw error;
  }
};

/**
 * Get IPR entry by ID
 * @param {string} ipr_id - IPR entry ID
 * @returns {Promise<Object|null>}
 */
const getIprEntryById = async (ipr_id) => {
  try {
    const { IprEntry } = require('~/db/models');
    return await IprEntry.findOne({ ipr_id }).lean();
  } catch (error) {
    logger.error('[IprEntry] getIprEntryById error:', error);
    throw error;
  }
};

/**
 * Delete IPR entry by ID
 * @param {string} ipr_id - IPR entry ID
 * @returns {Promise<Object|null>}
 */
const deleteIprEntry = async (ipr_id) => {
  try {
    const { IprEntry } = require('~/db/models');
    return await IprEntry.findOneAndDelete({ ipr_id }).lean();
  } catch (error) {
    logger.error('[IprEntry] deleteIprEntry error:', error);
    throw error;
  }
};

/**
 * Update IPR entry fields by ipr_id
 * @param {string} ipr_id - IPR entry ID
 * @param {Object} updates - Fields to update
 * @returns {Promise<Object|null>}
 */
const updateIprEntry = async (ipr_id, updates) => {
  try {
    const { IprEntry } = require('~/db/models');
    const allowedFields = ['employeeName', 'managerName', 'eventDate', 'classification', 'focusSkills', 'summary'];
    const safeUpdates = {};
    for (const key of allowedFields) {
      if (updates[key] !== undefined) {
        safeUpdates[key] = updates[key];
      }
    }
    return await IprEntry.findOneAndUpdate(
      { ipr_id },
      { $set: safeUpdates },
      { new: true, runValidators: true },
    ).populate('author', 'name email').lean();
  } catch (error) {
    logger.error('[IprEntry] updateIprEntry error:', error);
    throw error;
  }
};

/**
 * Get unique employee names from IPR entries
 * @param {Object} filter - Optional MongoDB filter
 * @returns {Promise<string[]>}
 */
const getUniqueEmployeeNames = async (filter = {}) => {
  try {
    const { IprEntry } = require('~/db/models');
    return await IprEntry.distinct('employeeName', filter);
  } catch (error) {
    logger.error('[IprEntry] getUniqueEmployeeNames error:', error);
    throw error;
  }
};

/**
 * Get IPR entries by array of ipr_ids
 * @param {string[]} iprIds - Array of ipr_id values
 * @returns {Promise<Array>}
 */
const getIprEntriesByIds = async (iprIds) => {
  try {
    const { IprEntry } = require('~/db/models');
    return await IprEntry.find({ ipr_id: { $in: iprIds } })
      .sort({ eventDate: 1 })
      .lean();
  } catch (error) {
    logger.error('[IprEntry] getIprEntriesByIds error:', error);
    throw error;
  }
};

module.exports = {
  getIprEntries,
  getAllIprEntries,
  createIprEntry,
  getIprEntryById,
  deleteIprEntry,
  updateIprEntry,
  getUniqueEmployeeNames,
  getIprEntriesByIds,
};
