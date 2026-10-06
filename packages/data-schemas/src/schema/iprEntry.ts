import { Schema } from 'mongoose';
import type { IIprEntry } from '~/types';

const iprEntrySchema = new Schema<IIprEntry>(
  {
    ipr_id: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    // Who created the record (manager)
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // Employee name (string, not ref)
    employeeName: {
      type: String,
      required: true,
      index: true,
    },
    // Manager name (denormalized for fast filters)
    managerName: {
      type: String,
      required: true,
      index: true,
    },
    // Employee department (MP, RM, RGR)
    employeeDepartment: {
      type: String,
      enum: ['MP', 'RM', 'RGR', 'NEWCOMER_MP'],
      required: true,
      index: true,
    },
    newcomerProfileId: { type: String, index: true },
    // Event date
    eventDate: {
      type: Date,
      required: true,
      index: true,
    },
    // Classification (what is being analyzed)
    // Flexible: "Серия визитов", "Двойной визит", "Тройной визит", "Коучинг", "Аудио-анализ"
    classification: {
      type: String,
      required: true,
      index: true,
    },
    // Focus skills (tags)
    focusSkills: {
      type: [String],
      default: [],
    },
    // Short summary (visible in table)
    summary: {
      type: String,
      required: true,
      maxlength: 2000,
    },
    // Full analysis (hidden, shows on expand)
    fullAnalysis: {
      type: String,
      required: true,
    },
    // Linked conversation
    conversationId: {
      type: String,
      index: true,
    },
    // Agent used
    agentId: {
      type: String,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// Compound indexes for efficient queries
iprEntrySchema.index({ employeeDepartment: 1, eventDate: -1 });
iprEntrySchema.index({ author: 1, eventDate: -1 });
iprEntrySchema.index({ employeeName: 1, eventDate: -1 });

export default iprEntrySchema;
