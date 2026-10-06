const fs = require('fs');
const axios = require('axios');
const path = require('path');
const { logger } = require('@librechat/data-schemas');

const DEEPGRAM_API_URL = 'https://api.deepgram.com/v1/listen';

const MIME_MAP = {
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.m4a': 'audio/mp4',
  '.flac': 'audio/flac',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.aac': 'audio/aac',
};

/**
 * Transcribe an audio file using DeepGram Nova 3.
 * @param {string} filePath - Path to the audio file on disk
 * @param {Object} options
 * @param {string} [options.language='ru'] - Language code
 * @param {string[]} [options.keyterms=[]] - Keyterms for boosting recognition (Nova-3 only)
 * @returns {Promise<{ transcript: string, segments: Array, duration: number, speakersCount: number, confidence: number }>}
 */
async function transcribeAudio(filePath, options = {}) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPGRAM_API_KEY is not configured in environment variables');
  }

  const { language = 'ru', keyterms = [] } = options;

  const params = new URLSearchParams({
    model: 'nova-3',
    language,
    diarize: 'true',
    smart_format: 'true',
  });

  for (const term of keyterms.slice(0, 100)) {
    if (term.trim()) {
      params.append('keyterm', term.trim());
    }
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_MAP[ext] || 'audio/mpeg';
  const fileSizeMb = (fs.statSync(filePath).size / 1024 / 1024).toFixed(1);

  logger.info(
    `[DeepgramService] Transcribing ${fileSizeMb}MB, ` +
    `language=${language}, keyterms=${keyterms.length}, format=${ext}`,
  );

  // Stream the file instead of buffering it fully in memory (avoids OOM on large audio).
  const audioStream = fs.createReadStream(filePath);
  const response = await axios.post(
    `${DEEPGRAM_API_URL}?${params.toString()}`,
    audioStream,
    {
      headers: {
        Authorization: `Token ${apiKey}`,
        'Content-Type': contentType,
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
      timeout: 10 * 60 * 1000,
    },
  );

  const result = response.data;
  const channel = result.results?.channels?.[0];
  const alternative = channel?.alternatives?.[0];

  if (!alternative) {
    throw new Error('No transcription result returned from DeepGram');
  }

  // Group consecutive words by speaker into segments
  const words = alternative.words || [];
  const segments = [];
  let current = null;

  for (const w of words) {
    const speaker = w.speaker ?? 0;
    if (!current || current.speaker !== speaker) {
      if (current) {
        segments.push(current);
      }
      current = { speaker, start: w.start, end: w.end, text: w.punctuated_word || w.word };
    } else {
      current.end = w.end;
      current.text += ' ' + (w.punctuated_word || w.word);
    }
  }
  if (current) {
    segments.push(current);
  }

  const uniqueSpeakers = new Set(segments.map((s) => s.speaker));

  logger.info(
    `[DeepgramService] Done: ${result.metadata?.duration?.toFixed(1)}s, ` +
    `${uniqueSpeakers.size} speakers, confidence=${alternative.confidence?.toFixed(3)}`,
  );

  return {
    transcript: alternative.transcript || '',
    segments,
    duration: result.metadata?.duration || 0,
    speakersCount: uniqueSpeakers.size || 1,
    confidence: alternative.confidence || 0,
  };
}

module.exports = { transcribeAudio };
