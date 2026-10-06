const { logger } = require('@librechat/data-schemas');
const { Transcript } = require('~/db/models');

/**
 * Finds a transcript by its transcript_id.
 * @param {string} transcript_id
 * @returns {Promise<Object|null>}
 */
const findTranscriptById = async (transcript_id) => {
  return await Transcript.findOne({ transcript_id }).lean();
};

/**
 * Lists transcripts for a user with pagination.
 * Excludes large fields (plainText, segments) for list view.
 * @param {Object} filter - Query filter
 * @param {number} page - Page number (1-based)
 * @param {number} limit - Items per page
 * @returns {Promise<{ transcripts: Object[], total: number, page: number, pages: number }>}
 */
const getTranscripts = async (filter, page = 1, limit = 20) => {
  const skip = (page - 1) * limit;
  const selectFields = { plainText: 0, segments: 0 };
  const [transcripts, total] = await Promise.all([
    Transcript.find(filter)
      .select(selectFields)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    Transcript.countDocuments(filter),
  ]);
  return { transcripts, total, page, pages: Math.ceil(total / limit) };
};

/**
 * Creates a new transcript record.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
const createTranscript = async (data) => {
  return await Transcript.create(data);
};

/**
 * Updates a transcript by transcript_id.
 * @param {string} transcript_id
 * @param {Object} update - Fields to update
 * @returns {Promise<Object|null>}
 */
const updateTranscript = async (transcript_id, update) => {
  return await Transcript.findOneAndUpdate(
    { transcript_id },
    { $set: update },
    { new: true },
  ).lean();
};

/**
 * Deletes a transcript by transcript_id and user.
 * @param {string} transcript_id
 * @param {string|Object} userId
 * @returns {Promise<Object|null>}
 */
const deleteTranscript = async (transcript_id, userId) => {
  return await Transcript.findOneAndDelete({ transcript_id, user: userId }).lean();
};

/**
 * Marks transcripts stuck in `processing` as `failed`. Transcription runs in a
 * fire-and-forget background task that does not survive a server restart/crash,
 * so any `processing` record left at startup is orphaned. Run once on boot.
 * @returns {Promise<number>} Number of transcripts reconciled.
 */
const reconcileStuckTranscripts = async () => {
  const result = await Transcript.updateMany(
    { status: 'processing' },
    {
      $set: {
        status: 'failed',
        errorMessage: 'Обработка прервана (перезапуск сервера). Загрузите запись повторно.',
      },
    },
  );
  return result?.modifiedCount ?? 0;
};

module.exports = {
  findTranscriptById,
  getTranscripts,
  createTranscript,
  updateTranscript,
  deleteTranscript,
  reconcileStuckTranscripts,
};
