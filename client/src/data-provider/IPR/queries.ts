import type * as t from './types';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';

export const useListIprEntriesQuery = (
  params: t.IprListParams,
  config?: UseQueryOptions<t.IprListResponse>,
) => {
  return useQuery<t.IprListResponse>(
    [QueryKeys.ipr, params],
    () => dataService.listIprEntries(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useIprEmployeeNamesQuery = (
  params?: Record<string, string>,
  config?: UseQueryOptions<t.IprEmployeeNamesResponse>,
) => {
  return useQuery<t.IprEmployeeNamesResponse>(
    [QueryKeys.iprEmployees, params],
    () => dataService.getIprEmployeeNames(params),
    {
      refetchOnWindowFocus: false,
      ...config,
    },
  );
};

export const useGetIprEntryByIdQuery = (
  id: string,
  config?: UseQueryOptions<t.IprEntry>,
) => {
  return useQuery<t.IprEntry>(
    [QueryKeys.iprEntry, id],
    () => dataService.getIprEntryById(id),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
      ...config,
    },
  );
};
