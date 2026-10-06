const { logger } = require('@librechat/data-schemas');
const { deepseekGenerate, recordDeepseekUsage } = require('~/server/services/deepseekClient');

// [LOCAL-DEEPSEEK] was Google Gemini (gemini-2.5-flash). Rollback: git reset --hard pre-deepseek
const TITLE_MODEL = process.env.TRANSCRIPT_TITLE_MODEL || 'deepseek-v4-flash';

/**
 * Generate a concise AI title for a transcript using Gemini Flash.
 * @param {string} transcriptText - Full transcript text
 * @param {Object} [meta] - Optional { userId } for token accounting.
 * @returns {Promise<string>} Generated title (up to 100 chars)
 */
async function generateTranscriptTitle(transcriptText, meta = {}) {
  // Take first 2000 chars to save tokens
  const excerpt = transcriptText.substring(0, 2000);

  const prompt = `Дай короткое название (до 60 символов) для этой аудиозаписи.
Только название, без кавычек, без пояснений.

Текст:
${excerpt}`;

  const { text: rawText, usage } = await deepseekGenerate({
    prompt,
    model: TITLE_MODEL,
    maxTokens: 100,
  });
  // Record token spend so this custom DeepSeek call is visible in balance/admin stats.
  await recordDeepseekUsage({
    user: meta.userId,
    model: TITLE_MODEL,
    context: 'transcript-title',
    usage,
  });
  let title = rawText.trim();

  // Strip any thinking artifacts that may leak into output
  title = title.replace(/^(THINK|think|Think)[^\n]*\n?/g, '').trim();
  // Remove wrapping quotes if present
  title = title.replace(/^["«»""]|["«»""]$/g, '').trim();

  title = title.substring(0, 100);

  if (!title) {
    throw new Error('Empty title generated');
  }

  logger.debug(`[TranscriptTitle] Generated: "${title}"`);
  return title;
}

module.exports = { generateTranscriptTitle };
