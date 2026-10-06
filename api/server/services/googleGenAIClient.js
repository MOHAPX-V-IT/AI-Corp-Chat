const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const { loadServiceKey } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');

let cachedClient = null;

/**
 * Returns a shared @google/genai client for internal Corp services
 * (IPR analysis, transcript titles, etc.).
 *
 * Priority (mirrors the main Google endpoint in @librechat/api):
 *   1. If GOOGLE_KEY is set (non-empty) -> Gemini API (AI Studio) with that key.
 *   2. Otherwise -> Vertex AI using the service account at
 *      GOOGLE_SERVICE_KEY_FILE or api/data/auth.json
 *      (location GOOGLE_LOC || GOOGLE_CLOUD_LOCATION || 'global').
 *
 * @returns {Promise<GoogleGenAI>}
 */
async function getGoogleGenAIClient() {
  if (cachedClient) {
    return cachedClient;
  }

  const apiKey = process.env.GOOGLE_KEY;
  if (apiKey && apiKey.trim() !== '') {
    logger.debug('[googleGenAIClient] Using Gemini API (AI Studio) with GOOGLE_KEY');
    cachedClient = new GoogleGenAI({ apiKey });
    return cachedClient;
  }

  const credentialsPath =
    process.env.GOOGLE_SERVICE_KEY_FILE || path.join(process.cwd(), 'api', 'data', 'auth.json');
  const serviceKey = await loadServiceKey(credentialsPath);
  if (!serviceKey || !serviceKey.project_id) {
    throw new Error(
      `[googleGenAIClient] No GOOGLE_KEY and no valid Google service account at: ${credentialsPath}`,
    );
  }

  try {
    await fs.promises.access(credentialsPath);
    process.env.GOOGLE_APPLICATION_CREDENTIALS = credentialsPath;
  } catch {
    // credentialsPath may be a JSON string / base64; skip setting the env var
  }

  const location = process.env.GOOGLE_LOC || process.env.GOOGLE_CLOUD_LOCATION || 'global';
  logger.debug(
    `[googleGenAIClient] Using Vertex AI (project=${serviceKey.project_id}, location=${location})`,
  );
  cachedClient = new GoogleGenAI({
    vertexai: true,
    project: serviceKey.project_id,
    location,
  });
  return cachedClient;
}

module.exports = { getGoogleGenAIClient };
