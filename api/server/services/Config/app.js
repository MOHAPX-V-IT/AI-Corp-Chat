const { CacheKeys } = require('librechat-data-provider');
const { logger, AppService } = require('@librechat/data-schemas');
const { loadAndFormatTools } = require('~/server/services/start/tools');
const loadCustomConfig = require('./loadCustomConfig');
const { setCachedTools } = require('./getCachedTools');
const getLogStores = require('~/cache/getLogStores');
const paths = require('~/config/paths');

const BASE_CONFIG_KEY = '_BASE_';

const loadBaseConfig = async () => {
  /** @type {TCustomConfig} */
  const config = (await loadCustomConfig()) ?? {};
  /** @type {Record<string, FunctionTool>} */
  const systemTools = loadAndFormatTools({
    adminFilter: config.filteredTools,
    adminIncluded: config.includedTools,
    directory: paths.structuredTools,
  });
  return AppService({ config, paths, systemTools });
};

/**
 * Get the app configuration based on user context
 * @param {Object} [options]
 * @param {string} [options.role] - User role for role-based config
 * @param {boolean} [options.refresh] - Force refresh the cache
 * @returns {Promise<AppConfig>}
 */
async function getAppConfig(options = {}) {
  const { role, refresh } = options;

  const cache = getLogStores(CacheKeys.APP_CONFIG);
  const cacheKey = role ? role : BASE_CONFIG_KEY;

  if (!refresh) {
    const cached = await cache.get(cacheKey);
    if (cached) {
      return cached;
    }
  }

  let baseConfig = await cache.get(BASE_CONFIG_KEY);
  if (!baseConfig) {
    logger.info('[getAppConfig] App configuration not initialized. Initializing AppService...');
    baseConfig = await loadBaseConfig();

    if (!baseConfig) {
      throw new Error('Failed to initialize app configuration through AppService.');
    }

    if (baseConfig.availableTools) {
      await setCachedTools(baseConfig.availableTools);
    }

    await cache.set(BASE_CONFIG_KEY, baseConfig);
  }

  // Apply role-based config modifications
  logger.info(`[getAppConfig] Loading config for role: ${role || 'no role'}`);
  logger.info(`[getAppConfig] Base endpoints: ${Object.keys(baseConfig.endpoints || {}).join(', ')}`);

  if (role && role !== 'ADMIN') {
    // Non-admin users: filter endpoints to only include Google (Gemini)
    const roleConfig = JSON.parse(JSON.stringify(baseConfig)); // Deep clone

    if (roleConfig.endpoints) {
      const allowedEndpoints = ['google', 'agents'];
      const filteredEndpoints = {};

      for (const [key, value] of Object.entries(roleConfig.endpoints)) {
        if (allowedEndpoints.includes(key)) {
          filteredEndpoints[key] = value;
        }
      }

      roleConfig.endpoints = filteredEndpoints;
    }

    // For non-admin users: enforce modelSpecs so only named models are shown
    // This hides the raw "Google" endpoint and shows only "Gemini 3 Думающая", "Gemini 3 Быстрая"
    if (roleConfig.modelSpecs) {
      roleConfig.modelSpecs.enforce = true;
    }

    logger.info(`[getAppConfig] USER filtered endpoints: ${Object.keys(roleConfig.endpoints || {}).join(', ')}`);
    await cache.set(cacheKey, roleConfig);
    return roleConfig;
  }

  // Admin users or no role: return full config with all endpoints
  logger.info(`[getAppConfig] ADMIN full endpoints: ${Object.keys(baseConfig.endpoints || {}).join(', ')}`);
  return baseConfig;
}

/**
 * Clear the app configuration cache
 * @returns {Promise<boolean>}
 */
async function clearAppConfigCache() {
  const cache = getLogStores(CacheKeys.CONFIG_STORE);
  const cacheKey = CacheKeys.APP_CONFIG;
  return await cache.delete(cacheKey);
}

module.exports = {
  getAppConfig,
  clearAppConfigCache,
};
