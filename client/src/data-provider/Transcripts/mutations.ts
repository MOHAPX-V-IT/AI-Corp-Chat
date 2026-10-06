import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService, QueryKeys } from 'librechat-data-provider';
import type { Transcript, TranscriptUpdateParams } from 'librechat-data-provider';
import type { UseMutationResult } from '@tanstack/react-query';

export const useCreateTranscriptMutation = (): UseMutationResult<
  Transcript,
  Error,
  FormData
> => {
  const queryClient = useQueryClient();
  return useMutation((formData: FormData) => dataService.createTranscript(formData), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.transcripts]);
    },
  });
};

export const useUpdateTranscriptMutation = (): UseMutationResult<
  Transcript,
  Error,
  { id: string; data: TranscriptUpdateParams }
> => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, data }) => dataService.updateTranscript(id, data),
    {
      onSuccess: (updated) => {
        queryClient.invalidateQueries([QueryKeys.transcripts]);
        queryClient.setQueryData([QueryKeys.transcript, updated.transcript_id], updated);
      },
    },
  );
};

export const useDeleteTranscriptMutation = (): UseMutationResult<
  { success: boolean },
  Error,
  string
> => {
  const queryClient = useQueryClient();
  return useMutation((id: string) => dataService.deleteTranscript(id), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.transcripts]);
    },
  });
};
