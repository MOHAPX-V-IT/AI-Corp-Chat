export interface TranscriptSegment {
  speaker: number;
  start: number;
  end: number;
  text: string;
}

export type TranscriptStatus = 'uploading' | 'processing' | 'completed' | 'failed';

export interface Transcript {
  _id?: string;
  transcript_id: string;
  user: string;
  title: string;
  summary: string;
  language: string;
  duration: number;
  speakersCount: number;
  status: TranscriptStatus;
  errorMessage?: string;
  segments: TranscriptSegment[];
  plainText: string;
  confidence?: number;
  audioFileId?: string;
  keyterms: string[];
  speakerNames: string[];
  originalFilename?: string;
  createdAt: string;
  updatedAt: string;
}

export type TranscriptListItem = Omit<Transcript, 'plainText' | 'segments'>;

export interface TranscriptListResponse {
  transcripts: TranscriptListItem[];
  total: number;
  page: number;
  pages: number;
}

export interface TranscriptListParams {
  page?: number;
  limit?: number;
  status?: TranscriptStatus;
  search?: string;
}

export interface TranscriptUpdateParams {
  title?: string;
  summary?: string;
  plainText?: string;
  segments?: TranscriptSegment[];
  keyterms?: string[];
  speakerNames?: string[];
}
