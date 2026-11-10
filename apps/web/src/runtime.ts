import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export function useRuntimeConfig() {
  return useQuery({
    queryKey: ['runtime-config'],
    queryFn: () => api<{ preview: boolean; mailEnabled: boolean }>('/config'),
    staleTime: 60_000,
  });
}
