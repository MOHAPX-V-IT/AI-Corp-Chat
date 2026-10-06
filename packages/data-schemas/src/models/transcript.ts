import transcriptSchema from '~/schema/transcript';
import type { ITranscript } from '~/types';

/**
 * Creates or returns the Transcript model using the provided mongoose instance and schema
 */
export function createTranscriptModel(mongoose: typeof import('mongoose')) {
  return mongoose.models.Transcript || mongoose.model<ITranscript>('Transcript', transcriptSchema);
}
