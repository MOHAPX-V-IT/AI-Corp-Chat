import { Document, Types } from 'mongoose';
import type { GraphEdge } from 'librechat-data-provider';

export interface ISupportContact {
  name?: string;
  email?: string;
}

export interface IAgent extends Omit<Document, 'model'> {
  id: string;
  name?: string;
  description?: string;
  instructions?: string;
  avatar?: {
    filepath: string;
    source: string;
  };
  provider: string;
  model: string;
  model_parameters?: Record<string, unknown>;
  artifacts?: string;
  access_level?: number;
  recursion_limit?: number;
  tools?: string[];
  tool_kwargs?: Array<unknown>;
  actions?: string[];
  author: Types.ObjectId;
  authorName?: string;
  hide_sequential_outputs?: boolean;
  end_after_tools?: boolean;
  /** @deprecated Use edges instead */
  agent_ids?: string[];
  edges?: GraphEdge[];
  /** @deprecated Use ACL permissions instead */
  isCollaborative?: boolean;
  conversation_starters?: string[];
  tool_resources?: unknown;
  projectIds?: Types.ObjectId[];
  versions?: Omit<IAgent, 'versions'>[];
  category: string;
  support_contact?: ISupportContact;
  is_promoted?: boolean;
  /** MCP server names extracted from tools for efficient querying */
  mcpServerNames?: string[];
  /** Departments that have access to this agent. Empty array = all departments */
  departments?: string[];
  /** Allow users to upload their own files for RAG analysis in conversations */
  user_files_enabled?: boolean;
  /** Enable saving conversations to IPR tracking */
  ipr_enabled?: boolean;
  /** Target IPR tab: which IPR tab entries are saved to */
  ipr_target?: 'MP' | 'RM' | 'RGR';
}
