import type * as t from './types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';

export const useCreateNewcomerProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (params: t.NewcomerCreateParams) => dataService.createNewcomerProfile(params),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.newcomerProfiles]);
        queryClient.invalidateQueries([QueryKeys.newcomerActive]);
      },
    },
  );
};

export const useUpdateNewcomerProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, params }: { id: string; params: t.NewcomerUpdateParams }) =>
      dataService.updateNewcomerProfile(id, params),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.newcomerProfiles]);
        queryClient.invalidateQueries([QueryKeys.newcomerActive]);
      },
    },
  );
};

export const useDeleteNewcomerProfileMutation = () => {
  const queryClient = useQueryClient();
  return useMutation((id: string) => dataService.deleteNewcomerProfile(id), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.newcomerProfiles]);
      queryClient.invalidateQueries([QueryKeys.newcomerActive]);
    },
  });
};
