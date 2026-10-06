const express = require('express');
const { logger } = require('@librechat/data-schemas');
const { recordAppLog } = require('~/models/AppLog');

const router = express.Router();

/**
 * POST /api/client-log
 * Central sink for client-side errors so failures in users' browsers are captured
 * in the server logs (winston error-*.log) instead of being invisible (note #4).
 *
 * Intentionally unauthenticated so pre-login errors are also captured; abuse is
 * bounded by a lightweight per-IP throttle and truncated fields. Not a full
 * telemetry pipeline — see 4b (Sentry/GlitchTip) for that.
 */
const trunc = (s, n) => (typeof s === 'string' ? s.slice(0, n) : undefined);

// Lightweight in-memory per-IP throttle (no external dependency).
const WINDOW_MS = 60 * 1000;
const MAX_PER_WINDOW = 60;
const hits = new Map();

function throttled(ip) {
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.reset) {
    hits.set(ip, { count: 1, reset: now + WINDOW_MS });
    return false;
  }
  entry.count += 1;
  return entry.count > MAX_PER_WINDOW;
}

// Occasional cleanup to keep the map bounded.
function sweep() {
  const now = Date.now();
  for (const [ip, entry] of hits) {
    if (now > entry.reset) {
      hits.delete(ip);
    }
  }
}

router.post('/', (req, res) => {
  try {
    const ip = req.ip;
    if (hits.size > 5000) {
      sweep();
    }
    if (throttled(ip)) {
      return res.status(429).end();
    }
    const { message, stack, source, url, level, userAgent, userId, extra } = req.body || {};
    logger.error('[client-log]', {
      ip,
      userId: trunc(userId, 64),
      level: trunc(level, 16) || 'error',
      message: trunc(message, 2000) || '(no message)',
      source: trunc(source, 512),
      url: trunc(url, 1024),
      userAgent: trunc(userAgent, 512) || trunc(req.get('user-agent'), 512),
      stack: trunc(stack, 8000),
      extra: extra && typeof extra === 'object' ? extra : undefined,
    });
    // Also persist to the queryable applogs store for the admin "Логи" viewer.
    recordAppLog({
      level: 'error',
      source: 'client',
      message: trunc(message, 2000) || '(no message)',
      path: trunc(url, 1024),
      userId: trunc(userId, 64) || req.user?.id,
      userEmail: req.user?.email,
      meta: { stack: trunc(stack, 4000), source: trunc(source, 512), ip },
    });
  } catch (err) {
    logger.warn('[client-log] failed to record client log', err);
  }
  // Always succeed quietly so the reporter never loops on its own failures.
  res.status(204).end();
});

module.exports = router;
