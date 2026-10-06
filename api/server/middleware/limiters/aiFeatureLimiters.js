const rateLimit = require('express-rate-limit');
const { limiterCache } = require('@librechat/api');

/**
 * Per-user rate limiter for expensive custom AI endpoints (IPR analysis via Gemini Pro,
 * audio transcription via Deepgram + large uploads). Guards against runaway cost / DoS.
 *
 * Configurable via env:
 *   AI_FEATURE_USER_MAX  - max requests per window per user (default 20)
 *   AI_FEATURE_WINDOW    - window length in minutes (default 5)
 *
 * @param {string} name - Unique limiter name (used for the cache store key).
 * @returns {import('express').RequestHandler}
 */
function createAiFeatureLimiter(name) {
  const max = parseInt(process.env.AI_FEATURE_USER_MAX, 10) || 20;
  const windowMin = parseInt(process.env.AI_FEATURE_WINDOW, 10) || 5;
  return rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    // These routes are behind requireJwtAuth, so key strictly by user id. Avoids the
    // express-rate-limit IPv6 keyGenerator validation and any per-IP bypass.
    keyGenerator: (req) => `u:${req.user?.id || 'anonymous'}`,
    store: limiterCache(`ai_feature_${name}_limiter`),
    handler: (req, res) =>
      res.status(429).json({ message: 'Слишком много запросов к AI-функции. Попробуйте позже.' }),
  });
}

module.exports = { createAiFeatureLimiter };
