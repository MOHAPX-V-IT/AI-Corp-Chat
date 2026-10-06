import type * as t from './types';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';

export const useSaveToIprMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (params: t.IprParseParams) => dataService.saveToIpr(params),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.ipr]);
        queryClient.invalidateQueries([QueryKeys.iprEmployees]);
      },
    },
  );
};

export const useDeleteIprEntryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation((id: string) => dataService.deleteIprEntry(id), {
    onSuccess: () => {
      queryClient.invalidateQueries([QueryKeys.ipr]);
    },
  });
};

export const useUpdateIprEntryMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    ({ id, params }: { id: string; params: t.IprUpdateParams }) =>
      dataService.updateIprEntry(id, params),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.ipr]);
      },
    },
  );
};

export const useAnalyzeDynamicsMutation = () => {
  return useMutation((params: t.IprAnalyzeDynamicsParams) =>
    dataService.analyzeDynamics(params),
  );
};

export const useSaveDynamicsMutation = () => {
  const queryClient = useQueryClient();
  return useMutation(
    (params: t.IprSaveDynamicsParams) => dataService.saveDynamics(params),
    {
      onSuccess: () => {
        queryClient.invalidateQueries([QueryKeys.ipr]);
      },
    },
  );
};
