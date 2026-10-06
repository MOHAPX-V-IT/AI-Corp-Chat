import type { Types } from 'mongoose';

export interface IIprEntry {
  ipr_id: string;
  author: Types.ObjectId;
  employeeName: string;
  managerName: string;
  employeeDepartment: 'MP' | 'RM' | 'RGR' | 'NEWCOMER_MP';
  newcomerProfileId?: string;
  eventDate: Date;
  classification: string;
  focusSkills: string[];
  summary: string;
  fullAnalysis: string;
  conversationId?: string;
  agentId?: string;
  createdAt: Date;
  updatedAt: Date;
}
