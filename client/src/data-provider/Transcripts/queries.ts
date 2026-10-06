import { useQuery } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { UseQueryOptions, QueryObserverResult } from '@tanstack/react-query';
import type {
  Transcript,
  TranscriptListResponse,
  TranscriptListParams,
} from 'librechat-data-provider';

export const useListTranscriptsQuery = (
  params: TranscriptListParams = {},
  config?: UseQueryOptions<TranscriptListResponse>,
): QueryObserverResult<TranscriptListResponse> => {
  return useQuery<TranscriptListResponse>(
    [QueryKeys.transcripts, params],
    () => dataService.listTranscripts(params),
    {
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      ...config,
    },
  );
};

export const useGetTranscriptByIdQuery = (
  transcript_id: string,
  config?: UseQueryOptions<Transcript>,
): QueryObserverResult<Transcript> => {
  return useQuery<Transcript>(
    [QueryKeys.transcript, transcript_id],
    () => dataService.getTranscriptById(transcript_id),
    {
      enabled: !!transcript_id,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};
