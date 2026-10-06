const os = require('os');
const { logger } = require('@librechat/data-schemas');
const { getDb, ensureTable } = require('./client');
const { tokenUsage } = require('./schema');
const { calcCost, providerFromModel } = require('./tariffs');

const DOMAIN = process.env.TOKEN_USAGE_DOMAIN || 'corp-ai-chat';
const HOST = os.hostname();

let HOST_IP = null;
try {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const ni of nets[name] || []) {
      if (ni.family === 'IPv4' && !ni.internal) {
        HOST_IP = ni.address;
        break;
      }
    }
    if (HOST_IP) {
      break;
    }
  }
} catch {
  /* ignore */
}

// Map internal LibreChat `context` → Sales-Gyroscope-style `purpose`.
const PURPOSE_MAP = {
  message: 'chat',
  incomplete: 'chat',
  'ipr-parse': 'ipr',
  'ipr-dynamics': 'ipr',
  'transcript-title': 'transcript',
  title: 'title',
};

/**
 * Record one token-usage incident into Postgres `token_usage`, mirroring the
 * Sales Gyroscope structure so it feeds the shared Grafana telemetry.
 * Non-blocking and never throws — accounting must not break the request.
 *
 * @param {Object} p
 * @param {string} p.model            - model id (matches tariffs / AVAILABLE_MODELS)
 * @param {string} [p.context]        - internal context ('message'|'ipr-parse'|'transcript-title'|'title'|…)
 * @param {number} [p.inputTokens]    - prompt tokens
 * @param {number} [p.outputTokens]   - completion tokens
 * @param {number} [p.contextTokens]  - context size for tiered pricing (defaults to inputTokens)
 * @param {string} [p.domain]         - override domain (default env/`corp-ai-chat`)
 * @param {number} [p.reportId]       - optional reports.id link
 */
async function recordTokenUsage(p = {}) {
  try {
    const d = getDb();
    if (!d || !p.model) {
      return;
    }
    const provider = providerFromModel(p.model);
    const purpose = PURPOSE_MAP[p.context] || p.context || 'chat';
    const { costInput, costOutput } = calcCost(
      p.model,
      p.inputTokens,
      p.outputTokens,
      p.contextTokens,
    );
    await d.insert(tokenUsage).values({
      domain: p.domain || DOMAIN,
      provider,
      model: p.model,
      purpose,
      inputTokens: p.inputTokens != null ? Math.round(p.inputTokens) : null,
      outputTokens: p.outputTokens != null ? Math.round(p.outputTokens) : null,
      costInput,
      costOutput,
      reportId: p.reportId != null ? p.reportId : null,
      host: HOST,
      hostIp: HOST_IP,
    });
  } catch (e) {
    logger.warn('[tokenUsage] record failed:', e?.message);
  }
}

module.exports = { recordTokenUsage, ensureTable };
