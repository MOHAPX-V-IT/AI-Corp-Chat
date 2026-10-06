const fs = require('fs');
const path = require('path');
const { logger } = require('@librechat/data-schemas');
const { spendTokens } = require('~/models/spendTokens');

// [CORP] Provider-agnostic client for the internal AI features (IPR parse/dynamics,
// transcript titles). Auto-selects the connection so the SAME code runs on the local
// DeepSeek stand AND deploys unchanged to the Gemini production:
//   - Google Gemini (via getGoogleGenAIClient) when Google/Vertex creds are present (prod).
//   - DeepSeek (OpenAI-compatible) when only DEEPSEEK_API_KEY is set (local stand).
// Force with CORP_INTERNAL_AI_PROVIDER = 'gemini' | 'deepseek'.
// The exported interface (deepseekGenerate / recordDeepseekUsage) is intentionally
// unchanged so callers need no edits.

// Optional Postgres token_usage recorder — absent on older deploys -> ledger-only, never breaks.
let recordTokenUsage = null;
try {
  ({ recordTokenUsage } = require('~/db/tokenUsage'));
} catch {
  /* token-usage module not present */
}

const DEEPSEEK_BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, '');
const DEEPSEEK_DEFAULT_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-v4-flash';
const GEMINI_DEFAULT_MODEL = process.env.CORP_GEMINI_MODEL || 'gemini-3.5-flash';

/** Whether Google/Vertex credentials are available (true on prod). */
function googleCredsAvailable() {
  if (process.env.GOOGLE_KEY && process.env.GOOGLE_KEY.trim() !== '') {
    return true;
  }
  if (process.env.GOOGLE_SERVICE_KEY_FILE || process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    return true;
  }
  try {
    return fs.existsSync(path.join(process.cwd(), 'api', 'data', 'auth.json'));
  } catch {
    return false;
  }
}

/** Active provider: explicit override -> google creds (prod) -> deepseek key (local) -> gemini. */
function resolveProvider() {
  const forced = (process.env.CORP_INTERNAL_AI_PROVIDER || '').toLowerCase();
  if (forced === 'gemini' || forced === 'google') {
    return 'gemini';
  }
  if (forced === 'deepseek') {
    return 'deepseek';
  }
  if (googleCredsAvailable()) {
    return 'gemini';
  }
  if (process.env.DEEPSEEK_API_KEY) {
    return 'deepseek';
  }
  return 'gemini';
}

/** Map an incoming model id to a Gemini model (deepseek-* ids are neutralized). */
function toGeminiModel(model) {
  if (model && !/deepseek/i.test(model)) {
    return model;
  }
  return GEMINI_DEFAULT_MODEL;
}

/** Gemini implementation (prod). Lazy-requires the SDK so the local stand never loads it. */
async function geminiGenerate({ prompt, model, maxTokens, json, temperature, systemPrompt }) {
  const { getGoogleGenAIClient } = require('~/server/services/googleGenAIClient');
  const geminiModel = toGeminiModel(model);
  const ai = await getGoogleGenAIClient();

  const config = {
    maxOutputTokens: maxTokens,
    // gemini-3.x is a thinking model: without this, "thoughts" consume the output budget
    // and result.text comes back empty. The DeepSeek-style callers expect a direct answer.
    thinkingConfig: { thinkingBudget: 0 },
  };
  if (systemPrompt) config.systemInstruction = systemPrompt;
  if (json) {
    config.responseMimeType = 'application/json';
  }
  if (typeof temperature === 'number') {
    config.temperature = temperature;
  }

  const result = await ai.models.generateContent({ model: geminiModel, contents: prompt, config });
  let text = '';
  try {
    text = (typeof result.text === 'string' ? result.text : (result?.text ?? '')) || '';
  } catch {
    text = '';
  }
  const um = result?.usageMetadata || {};
  return {
    text,
    usage: {
      promptTokens: um.promptTokenCount || 0,
      completionTokens: um.candidatesTokenCount || 0,
    },
    model: geminiModel,
  };
}

/** DeepSeek implementation (local stand). OpenAI-compatible chat/completions. */
async function deepseekGenerateRaw({ prompt, model, maxTokens, json, temperature, systemPrompt }) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error('DEEPSEEK_API_KEY not configured');
  }

  const body = {
    model: model || DEEPSEEK_DEFAULT_MODEL,
    messages: [...(systemPrompt ? [{ role: 'system', content: systemPrompt }] : []), { role: 'user', content: prompt }],
    max_tokens: maxTokens,
  };
  if (json) {
    body.response_format = { type: 'json_object' };
  }
  if (typeof temperature === 'number') {
    body.temperature = temperature;
  }

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`DeepSeek API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  return {
    text: data?.choices?.[0]?.message?.content ?? '',
    usage: {
      promptTokens: data?.usage?.prompt_tokens || 0,
      completionTokens: data?.usage?.completion_tokens || 0,
    },
    model: body.model,
  };
}

/**
 * Generate text via the active internal AI provider (Gemini on prod, DeepSeek on the local stand).
 * @param {Object} params
 * @param {string} params.prompt
 * @param {string} [params.model]
 * @param {number} [params.maxTokens]
 * @param {boolean} [params.json]
 * @param {number} [params.temperature]
 * @returns {Promise<{ text: string, usage: { promptTokens: number, completionTokens: number }, model: string }>}
 */
async function deepseekGenerate({ prompt, model, maxTokens = 2048, json = false, temperature, systemPrompt }) {
  if (resolveProvider() === 'gemini') {
    return geminiGenerate({ prompt, model, maxTokens, json, temperature, systemPrompt });
  }
  return deepseekGenerateRaw({ prompt, model, maxTokens, json, temperature, systemPrompt });
}

/**
 * Record internal-AI token spend into the Transaction ledger + Postgres token_usage.
 * Never throws — accounting must not break the feature. Endpoint tag matches the provider.
 * @param {Object} params
 * @param {string|ObjectId} params.user
 * @param {string} [params.conversationId]
 * @param {string} [params.agentId]
 * @param {string} params.model
 * @param {string} params.context - e.g. 'ipr-parse', 'ipr-dynamics', 'transcript-title'.
 * @param {{ promptTokens: number, completionTokens: number }} params.usage
 */
async function recordDeepseekUsage({ user, conversationId, agentId, model, context, usage }) {
  try {
    if (!user || !usage) {
      return;
    }
    const promptTokens = usage.promptTokens || 0;
    const completionTokens = usage.completionTokens || 0;
    const endpoint = resolveProvider() === 'gemini' ? 'google' : 'DeepSeek';
    await spendTokens(
      { user, conversationId, agentId, endpoint, model, context },
      { promptTokens, completionTokens },
    );
    if (recordTokenUsage) {
      await recordTokenUsage({
        model,
        context,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        contextTokens: promptTokens,
      });
    }
    logger.debug(
      `[recordInternalAIUsage] provider=${endpoint} context=${context} model=${model} prompt=${promptTokens} completion=${completionTokens}`,
    );
  } catch (err) {
    logger.error(`[recordInternalAIUsage] failed (context=${context})`, err);
  }
}

module.exports = { deepseekGenerate, recordDeepseekUsage };
