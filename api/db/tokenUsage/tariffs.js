/**
 * Tariffs mirrored from the shared Google Sheet `tariffs` tab (Cost per 1M tokens, USD).
 * Tiered by context size: if contextTokens > threshold, the "high" tier applies.
 * This is the source of truth for calc_cost — model ids must match the ids written
 * into token_usage.model (AVAILABLE_MODELS).
 */
const TARIFFS = {
  'gemini-3.1-pro-preview': { threshold: 200000, low: { in: 2, out: 12 }, high: { in: 4, out: 18 } },
  'gemini-3.5-flash': { threshold: 0, low: { in: 1.5, out: 9 }, high: { in: 1.5, out: 9 } },
  'gpt-5.4': { threshold: 272000, low: { in: 2.5, out: 15 }, high: { in: 5, out: 30 } },
  'deepseek-v4-pro': { threshold: 0, low: { in: 0.44, out: 0.87 }, high: { in: 0.44, out: 0.87 } },
  'deepseek-v4-flash': { threshold: 0, low: { in: 0.14, out: 0.28 }, high: { in: 0.14, out: 0.28 } },
  'gemini-3.1-flash-lite-preview': { threshold: 0, low: { in: 0.25, out: 1.5 }, high: { in: 0.25, out: 1.5 } },
};

/**
 * Cost in USD. Prices are per 1M tokens, so cost = tokens / 1e6 * pricePerMillion.
 * Returns strings (str(float)) to match the reference schema (aggregate via ::numeric).
 * Unknown model → nulls (cost not computable), mirroring the source behaviour.
 */
function calcCost(model, inputTokens, outputTokens, contextTokens) {
  const t = TARIFFS[model];
  if (!t) {
    return { costInput: null, costOutput: null };
  }
  const ctx = contextTokens != null ? contextTokens : inputTokens != null ? inputTokens : 0;
  const tier = ctx > t.threshold ? t.high : t.low;
  const ci = inputTokens != null ? (inputTokens / 1e6) * tier.in : null;
  const co = outputTokens != null ? (outputTokens / 1e6) * tier.out : null;
  return { costInput: fmtCost(ci), costOutput: fmtCost(co) };
}

/**
 * Format a USD cost as a clean decimal string (no float noise, no scientific
 * notation) that fits token_usage.cost_* varchar(20). str(float) in JS otherwise
 * yields values like "0.00028000000000000003" (22 chars) → 22001 overflow.
 */
function fmtCost(n) {
  if (n == null) {
    return null;
  }
  let s = n.toFixed(10).replace(/\.?0+$/, '');
  if (s === '' || s === '-0') {
    s = '0';
  }
  return s.slice(0, 20);
}

function providerFromModel(model = '') {
  const m = String(model).toLowerCase();
  if (m.includes('claude')) return 'anthropic';
  if (m.includes('gemini')) return 'google';
  if (m.includes('deepseek')) return 'deepseek';
  if (m.includes('gpt') || m.startsWith('o1') || m.startsWith('o3') || m.startsWith('o4')) return 'openai';
  return 'unknown';
}

module.exports = { TARIFFS, calcCost, providerFromModel };
