import { Schema } from 'mongoose';
import type { IAgent } from '~/types';

const agentSchema = new Schema<IAgent>(
  {
    id: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    name: {
      type: String,
    },
    description: {
      type: String,
    },
    instructions: {
      type: String,
    },
    avatar: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    provider: {
      type: String,
      required: true,
    },
    model: {
      type: String,
      required: true,
    },
    model_parameters: {
      type: Object,
    },
    artifacts: {
      type: String,
    },
    access_level: {
      type: Number,
    },
    recursion_limit: {
      type: Number,
    },
    tools: {
      type: [String],
      default: undefined,
    },
    tool_kwargs: {
      type: [{ type: Schema.Types.Mixed }],
    },
    actions: {
      type: [String],
      default: undefined,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    authorName: {
      type: String,
      default: undefined,
    },
    hide_sequential_outputs: {
      type: Boolean,
    },
    end_after_tools: {
      type: Boolean,
    },
    /** @deprecated Use edges instead */
    agent_ids: {
      type: [String],
    },
    edges: {
      type: [{ type: Schema.Types.Mixed }],
      default: [],
    },
    isCollaborative: {
      type: Boolean,
      default: undefined,
    },
    conversation_starters: {
      type: [String],
      default: [],
    },
    tool_resources: {
      type: Schema.Types.Mixed,
      default: {},
    },
    projectIds: {
      type: [Schema.Types.ObjectId],
      ref: 'Project',
      index: true,
    },
    versions: {
      type: [Schema.Types.Mixed],
      default: [],
    },
    category: {
      type: String,
      trim: true,
      index: true,
      default: 'general',
    },
    support_contact: {
      type: Schema.Types.Mixed,
      default: undefined,
    },
    is_promoted: {
      type: Boolean,
      default: false,
      index: true,
    },
    /** MCP server names extracted from tools for efficient querying */
    mcpServerNames: {
      type: [String],
      default: [],
      index: true,
    },
    /** Departments that have access to this agent. Empty array = all departments */
    departments: {
      type: [String],
      enum: ['MP', 'RM', 'RGR', 'ROP', 'HR', 'PRODUCTION'],
      default: [],
      index: true,
    },
    /** Allow users to upload their own files for RAG analysis in conversations */
    user_files_enabled: {
      type: Boolean,
      // NOTE: No default value - let it be undefined if not set
    },
    /** Enable saving conversations to IPR (Individual Development Plan) tracking */
    ipr_enabled: {
      type: Boolean,
      // NOTE: No default value - let it be undefined if not set
    },
    /** Target IPR tab: determines which IPR tab entries are saved to when ipr_enabled */
    ipr_target: {
      type: String,
      enum: ['MP', 'RM', 'RGR', 'NEWCOMER_MP'],
    },
  },
  {
    timestamps: true,
  },
);

agentSchema.index({ updatedAt: -1, _id: 1 });
agentSchema.index({ 'edges.to': 1 });

export default agentSchema;
