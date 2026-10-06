import mongoose, { Schema } from 'mongoose';
import type { ITranscript } from '~/types';

const TranscriptStatus = ['uploading', 'processing', 'completed', 'failed'];

const transcriptSchema: Schema<ITranscript> = new Schema(
  {
    transcript_id: {
      type: String,
      index: true,
      unique: true,
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      required: true,
    },
    title: {
      type: String,
      default: '',
    },
    summary: {
      type: String,
      default: '',
    },
    language: {
      type: String,
      default: 'ru',
    },
    duration: {
      type: Number,
      default: 0,
    },
    speakersCount: {
      type: Number,
      default: 1,
    },
    status: {
      type: String,
      enum: TranscriptStatus,
      default: 'uploading',
      index: true,
    },
    errorMessage: {
      type: String,
    },
    segments: {
      type: [
        {
          speaker: Number,
          start: Number,
          end: Number,
          text: String,
        },
      ],
      default: [],
    },
    plainText: {
      type: String,
      default: '',
    },
    confidence: {
      type: Number,
    },
    audioFileId: {
      type: String,
    },
    keyterms: {
      type: [String],
      default: [],
    },
    speakerNames: {
      type: [String],
      default: [],
    },
    originalFilename: {
      type: String,
    },
  },
  {
    timestamps: true,
  },
);

transcriptSchema.index({ createdAt: -1 });
transcriptSchema.index({ user: 1, status: 1 });

export default transcriptSchema;
