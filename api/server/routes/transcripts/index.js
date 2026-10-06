const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth, checkBan } = require('~/server/middleware');
const { createAiFeatureLimiter } = require('~/server/middleware/limiters/aiFeatureLimiters');
const {
  findTranscriptById,
  getTranscripts,
  createTranscript,
  updateTranscript,
  deleteTranscript,
} = require('~/models/Transcript');
const { transcribeAudio } = require('~/server/services/DeepgramService');
const { generateTranscriptTitle } = require('~/server/services/TranscriptTitleService');

const router = express.Router();
router.use(requireJwtAuth);
router.use(checkBan);

// Rate limiter for expensive transcription uploads (Deepgram + large files).
const transcriptAiLimiter = createAiFeatureLimiter('transcripts');

// Multer config for audio uploads
const audioStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(process.cwd(), 'uploads', 'transcripts', req.user.id);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomUUID()}${ext}`);
  },
});

const audioFilter = (req, file, cb) => {
  const audioMimes = [
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4',
    'audio/flac', 'audio/webm', 'audio/x-m4a', 'audio/aac',
    'audio/x-wav', 'audio/wave', 'audio/mp3',
    'audio/vnd.dlna.adts', 'audio/aac', 'audio/x-aac',
    'video/mp4', 'video/webm', 'video/3gpp',
  ];
  if (audioMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not supported. Only audio files are allowed.`), false);
  }
};

const upload = multer({
  storage: audioStorage,
  fileFilter: audioFilter,
  limits: { fileSize: 2 * 1024 * 1024 * 1024 },
});

/**
 * GET /api/transcripts - List user's transcripts (paginated)
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = { user: req.user._id };

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: 'i' } },
        { originalFilename: { $regex: search, $options: 'i' } },
      ];
    }

    const result = await getTranscripts(filter, Number(page), Number(limit));
    res.json(result);
  } catch (error) {
    logger.error('[Transcripts] List error:', error);
    res.status(500).json({ error: 'Failed to list transcripts' });
  }
});

/**
 * POST /api/transcripts - Upload audio and start transcription
 * Returns immediately with the transcript record (status=processing).
 * Transcription happens in the background.
 */
router.post('/', transcriptAiLimiter, upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    const transcript_id = crypto.randomUUID();
    const { language = 'ru', keyterms: keytermsRaw = '' } = req.body;
    const keyterms = keytermsRaw
      ? keytermsRaw.split(',').map((k) => k.trim()).filter(Boolean)
      : [];

    const transcript = await createTranscript({
      transcript_id,
      user: req.user._id,
      status: 'processing',
      language,
      keyterms,
      originalFilename: req.file.originalname,
      audioFileId: req.file.filename,
    });

    res.status(201).json(transcript.toObject ? transcript.toObject() : transcript);

    // Background processing
    const filePath = req.file.path;
    (async () => {
      try {
        const result = await transcribeAudio(filePath, { language, keyterms });

        // AI title generation with fallback
        let title = result.transcript.substring(0, 80) +
          (result.transcript.length > 80 ? '...' : '');
        try {
          title = await generateTranscriptTitle(result.transcript, { userId: req.user._id });
        } catch (titleErr) {
          logger.warn(`[Transcripts] AI title generation failed for ${transcript_id}, using fallback:`, titleErr.message);
        }

        await updateTranscript(transcript_id, {
          status: 'completed',
          plainText: result.transcript,
          segments: result.segments,
          duration: result.duration,
          speakersCount: result.speakersCount,
          confidence: result.confidence,
          title,
        });

        logger.info(
          `[Transcripts] Completed ${transcript_id}: ` +
          `${result.duration.toFixed(1)}s, ${result.speakersCount} speakers`,
        );
      } catch (err) {
        logger.error(`[Transcripts] Processing failed for ${transcript_id}:`, err.message);
        await updateTranscript(transcript_id, {
          status: 'failed',
          errorMessage: err.message || 'Unknown error during transcription',
        });
      } finally {
        try {
          fs.unlinkSync(filePath);
          logger.debug(`[Transcripts] Cleaned up audio file for ${transcript_id}`);
        } catch (cleanupErr) {
          logger.warn(`[Transcripts] Failed to clean up audio: ${cleanupErr.message}`);
        }
      }
    })();
  } catch (error) {
    logger.error('[Transcripts] Upload error:', error);
    res.status(500).json({ error: 'Failed to upload and process audio' });
  }
});

/**
 * GET /api/transcripts/:id - Get full transcript details (including segments)
 */
router.get('/:id', async (req, res) => {
  try {
    const transcript = await findTranscriptById(req.params.id);
    if (!transcript) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    if (transcript.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    res.json(transcript);
  } catch (error) {
    logger.error('[Transcripts] Get error:', error);
    res.status(500).json({ error: 'Failed to get transcript' });
  }
});

/**
 * PUT /api/transcripts/:id - Update transcript (edit title, text, segments)
 */
router.put('/:id', async (req, res) => {
  try {
    const existing = await findTranscriptById(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Transcript not found' });
    }

    if (existing.user.toString() !== req.user._id.toString()) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const allowedFields = ['title', 'summary', 'plainText', 'segments', 'keyterms', 'speakerNames'];
    const update = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        update[field] = req.body[field];
      }
    }

    const updated = await updateTranscript(req.params.id, update);
    res.json(updated);
  } catch (error) {
    logger.error('[Transcripts] Update error:', error);
    res.status(500).json({ error: 'Failed to update transcript' });
  }
});

/**
 * DELETE /api/transcripts/:id - Delete transcript
 */
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await deleteTranscript(req.params.id, req.user._id);
    if (!deleted) {
      return res.status(404).json({ error: 'Transcript not found' });
    }
    res.json({ success: true });
  } catch (error) {
    logger.error('[Transcripts] Delete error:', error);
    res.status(500).json({ error: 'Failed to delete transcript' });
  }
});

module.exports = router;
