const { logger } = require('@librechat/data-schemas');
const { spendTokens } = require('~/models/spendTokens');
const { recordTokenUsage } = require('~/db/tokenUsage');

/**
 * Record token usage of a direct Google Gemini call (via @google/generative-ai)
 * into the Transaction ledger. Custom AI features (IPR parsing/dynamics, transcript
 * titles) call Gemini outside the standard LibreChat client, so without this their
 * spend is invisible in the balance and admin token statistics.
 *
 * Never throws — token accounting must not break the underlying feature.
 *
 * @param {Object} params
 * @param {string|ObjectId} params.user - User id to attribute the spend to.
 * @param {string} [params.conversationId] - Related conversation id, if any.
 * @param {string} params.model - Gemini model id (must match pricing in api/models/tx.js).
 * @param {string} params.context - Spend context label, e.g. 'ipr-parse', 'ipr-dynamics', 'transcript-title'.
 * @param {Object} params.response - The `result.response` object returned by generateContent().
 * @returns {Promise<void>}
 */
async function recordGeminiUsage({ user, conversationId, agentId, model, context, response }) {
  try {
    if (!user) {
      return;
    }
    const usage = response?.usageMetadata;
    if (!usage) {
      return;
    }
    const promptTokens = usage.promptTokenCount || 0;
    // Thinking models report reasoning tokens separately; they are billed as output.
    const completionTokens = (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);
    await spendTokens(
      { user, conversationId, agentId, endpoint: 'google', model, context },
      { promptTokens, completionTokens },
    );
    // Mirror into Postgres token_usage (Grafana telemetry).
    await recordTokenUsage({
      model,
      context,
      inputTokens: promptTokens,
      outputTokens: completionTokens,
      contextTokens: promptTokens,
    });
    logger.debug(
      `[recordGeminiUsage] context=${context} model=${model} prompt=${promptTokens} completion=${completionTokens}`,
    );
  } catch (err) {
    logger.error(`[recordGeminiUsage] failed (context=${context})`, err);
  }
}

module.exports = { recordGeminiUsage };
