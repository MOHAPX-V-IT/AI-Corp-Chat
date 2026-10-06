const { isEnabled } = require('@librechat/api');
const { logger } = require('@librechat/data-schemas');
const { CacheKeys } = require('librechat-data-provider');
const getLogStores = require('~/cache/getLogStores');
const { saveConvo } = require('~/models');

/**
 * Add title to conversation in a way that avoids memory retention
 */
const addTitle = async (req, { text, response, client }) => {
  const key = `${req.user.id}-${response.conversationId}`;
  logger.debug(`[${key}] Starting title generation for text: "${text?.substring(0, 50)}..."`);

  const { TITLE_CONVO = true } = process.env ?? {};
  if (!isEnabled(TITLE_CONVO)) {
    logger.debug(`[${key}] Title generation disabled by TITLE_CONVO env`);
    return;
  }

  if (client.options.titleConvo === false) {
    logger.debug(`[${key}] Title generation disabled by client.options.titleConvo`);
    return;
  }

  // Skip title generation for temporary conversations
  if (req?.body?.isTemporary) {
    logger.debug(`[${key}] Skipping title for temporary conversation`);
    return;
  }

  const titleCache = getLogStores(CacheKeys.GEN_TITLE);
  /** @type {NodeJS.Timeout} */
  let timeoutId;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timeoutId = setTimeout(() => reject(new Error('Title generation timeout')), 45000);
    }).catch((error) => {
      logger.error('Title error:', error);
    });

    let titlePromise;
    let abortController = new AbortController();
    if (client && typeof client.titleConvo === 'function') {
      titlePromise = Promise.race([
        client
          .titleConvo({
            text,
            abortController,
          })
          .catch((error) => {
            logger.error('Client title error:', error);
          }),
        timeoutPromise,
      ]);
    } else {
      return;
    }

    const title = await titlePromise;
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    if (!title) {
      logger.debug(`[${key}] No title generated`);
      return;
    }

    await titleCache.set(key, title, 120000);
    await saveConvo(
      req,
      {
        conversationId: response.conversationId,
        title,
      },
      { context: 'api/server/services/Endpoints/agents/title.js' },
    );
    logger.debug(`[${key}] Title generated successfully: "${title}"`);
  } catch (error) {
    logger.error('Error generating title:', error);
  }
};

module.exports = addTitle;
