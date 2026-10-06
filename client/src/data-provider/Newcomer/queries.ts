import type * as t from './types';
import { useQuery, type UseQueryOptions } from '@tanstack/react-query';
import { QueryKeys, dataService } from 'librechat-data-provider';

export const useListNewcomerProfilesQuery = (
  params: t.NewcomerListParams,
  config?: UseQueryOptions<t.NewcomerListResponse>,
) => {
  return useQuery<t.NewcomerListResponse>(
    [QueryKeys.newcomerProfiles, params],
    () => dataService.listNewcomerProfiles(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      ...config,
    },
  );
};

export const useNewcomerProfileByIdQuery = (
  id: string,
  config?: UseQueryOptions<t.NewcomerProfile>,
) => {
  return useQuery<t.NewcomerProfile>(
    [QueryKeys.newcomerProfile, id],
    () => dataService.getNewcomerProfileById(id),
    {
      enabled: !!id,
      refetchOnWindowFocus: false,
      ...config,
    },
  );
};

export const useActiveNewcomersQuery = (
  config?: UseQueryOptions<t.NewcomerActiveResponse>,
) => {
  return useQuery<t.NewcomerActiveResponse>(
    [QueryKeys.newcomerActive],
    () => dataService.getActiveNewcomers(),
    {
      refetchOnWindowFocus: false,
      ...config,
    },
  );
};
