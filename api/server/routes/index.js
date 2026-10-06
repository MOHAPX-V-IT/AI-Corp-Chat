const accessPermissions = require('./accessPermissions');
const assistants = require('./assistants');
const categories = require('./categories');
const endpoints = require('./endpoints');
const staticRoute = require('./static');
const messages = require('./messages');
const memories = require('./memories');
const presets = require('./presets');
const prompts = require('./prompts');
const balance = require('./balance');
const actions = require('./actions');
const banner = require('./banner');
const search = require('./search');
const models = require('./models');
const convos = require('./convos');
const config = require('./config');
const agents = require('./agents');
const admin = require('./admin');
const roles = require('./roles');
const oauth = require('./oauth');
const files = require('./files');
const share = require('./share');
const tags = require('./tags');
const auth = require('./auth');
const keys = require('./keys');
const user = require('./user');
const transcripts = require('./transcripts');
const ipr = require('./ipr');
const newcomer = require('./newcomer');
const clientLog = require('./clientLog');
const usage = require('./usage');
const adminLogs = require('./adminLogs');
const mcp = require('./mcp');

module.exports = {
  mcp,
  auth,
  keys,
  user,
  tags,
  roles,
  oauth,
  files,
  share,
  admin,
  banner,
  agents,
  convos,
  search,
  config,
  models,
  prompts,
  actions,
  presets,
  balance,
  messages,
  memories,
  endpoints,
  assistants,
  categories,
  staticRoute,
  transcripts,
  ipr,
  newcomer,
  clientLog,
  usage,
  adminLogs,
  accessPermissions,
};
