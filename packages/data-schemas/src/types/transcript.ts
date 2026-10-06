import { Document, Types } from 'mongoose';

export interface ITranscriptSegment {
  speaker: number;
  start: number;
  end: number;
  text: string;
}

export type TranscriptStatus = 'uploading' | 'processing' | 'completed' | 'failed';

export interface ITranscript extends Document {
  transcript_id: string;
  user: Types.ObjectId;
  title: string;
  summary: string;
  language: string;
  duration: number;
  speakersCount: number;
  status: TranscriptStatus;
  errorMessage?: string;
  segments: ITranscriptSegment[];
  plainText: string;
  confidence?: number;
  audioFileId?: string;
  keyterms: string[];
  speakerNames: string[];
  originalFilename?: string;
  createdAt?: Date;
  updatedAt?: Date;
}
