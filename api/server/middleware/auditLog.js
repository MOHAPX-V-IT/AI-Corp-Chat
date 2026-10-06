const { recordAppLog } = require('~/models/AppLog');

/**
 * Audit-log middleware: records the outcome of mutating API requests
 * (POST/PUT/DELETE/PATCH) into the applogs store with a level derived from the
 * response status — success (2xx), warn (4xx), error (5xx). Powers the admin
 * "Логи" viewer (all logs / by user / by type). Non-blocking.
 */
function auditLog(req, res, next) {
  if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    return next();
  }
  const path = (req.originalUrl || req.url || '').split('?')[0];
  // Skip the client-log sink (records its own entries) and routine/noisy
  // endpoints that add no audit value and flood the log viewer.
  const SKIP_PREFIXES = ['/api/client-log', '/api/auth/refresh'];
  if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
    return next();
  }
  res.on('finish', () => {
    try {
      const status = res.statusCode;
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'success';
      recordAppLog({
        level,
        source: 'api',
        method: req.method,
        path,
        status,
        message: `${req.method} ${path} → ${status}`,
        userId: req.user?.id,
        userEmail: req.user?.email,
      });
    } catch {
      /* ignore */
    }
  });
  next();
}

module.exports = auditLog;
