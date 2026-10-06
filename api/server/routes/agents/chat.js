const express = require('express');
const { generateCheckAccess, skipAgentCheck } = require('@librechat/api');
const { PermissionTypes, Permissions, PermissionBits } = require('librechat-data-provider');
const {
  moderateText,
  // validateModel,
  validateConvoAccess,
  buildEndpointOption,
  canAccessAgentFromBody,
} = require('~/server/middleware');
const { initializeClient } = require('~/server/services/Endpoints/agents');
const AgentController = require('~/server/controllers/agents/request');
const addTitle = require('~/server/services/Endpoints/agents/title');
const { getRoleByName } = require('~/models/Role');

const router = express.Router();

const SUPPLIER_AGENT_ID = 'agent_6aa134ac49188665fc8ce';

/**
 * File-only messages are valid, but Google rejects an empty prompt before an
 * agent can inspect attachments. Supply a deterministic prompt for every
 * agent while keeping the supplier agent's mode-selection behaviour.
 */
const ensureFilePrompt = (req, _res, next) => {
  const hasFiles = Array.isArray(req.body?.files) && req.body.files.length > 0;
  const hasText = typeof req.body?.text === 'string' && req.body.text.trim().length > 0;
  if (hasFiles && !hasText) {
    if (req.body?.agent_id === SUPPLIER_AGENT_ID) {
      req.body.text =
        req.body.files.length >= 2
          ? 'Сравни приложенные коммерческие предложения и сформируй итоговую таблицу Excel.'
          : 'Определи подходящий режим для приложенного документа. Если это англоязычный документ, полностью переведи его на русский и сформируй Word в двух колонках. Если режим неочевиден, задай уточняющий вопрос.';
    } else {
      req.body.text =
        'Проанализируй приложенные файлы в соответствии со своими инструкциями.';
    }
  }
  next();
};

const checkAgentAccess = generateCheckAccess({
  permissionType: PermissionTypes.AGENTS,
  permissions: [Permissions.USE],
  skipCheck: skipAgentCheck,
  getRoleByName,
});
const checkAgentResourceAccess = canAccessAgentFromBody({
  requiredPermission: PermissionBits.VIEW,
});

router.use(ensureFilePrompt);
router.use(moderateText);
router.use(checkAgentAccess);
router.use(checkAgentResourceAccess);
router.use(validateConvoAccess);
router.use(buildEndpointOption);

const controller = async (req, res, next) => {
  await AgentController(req, res, next, initializeClient, addTitle);
};

/**
 * @route POST / (regular endpoint)
 * @desc Chat with an assistant
 * @access Public
 * @param {express.Request} req - The request object, containing the request data.
 * @param {express.Response} res - The response object, used to send back a response.
 * @returns {void}
 */
router.post('/', controller);

/**
 * @route POST /:endpoint (ephemeral agents)
 * @desc Chat with an assistant
 * @access Public
 * @param {express.Request} req - The request object, containing the request data.
 * @param {express.Response} res - The response object, used to send back a response.
 * @returns {void}
 */
router.post('/:endpoint', controller);

module.exports = router;
