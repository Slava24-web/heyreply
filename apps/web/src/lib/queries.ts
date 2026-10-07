'use client';
import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type {
  ApplicationDto,
  ChangeStatusInput,
  CreateApplicationInput,
  DictItem,
  DictionaryType,
  FunnelStageDto,
  InsightDto,
  Paginated,
  SalaryAnalyticsDto,
  SegmentRowDto,
  SummaryDto,
  TimelinePointDto,
  UpdateApplicationInput,
  UpdateProfileInput,
  UserDto,
  AppStatus,
} from '@heyreply/shared';
import { api } from './api';

export type ListParams = Record<string, string | number | boolean | string[] | undefined>;
export type Period = { from?: string; to?: string };

export const qk = {
  me: ['me'] as const,
  apps: ['applications'] as const,
  app: (id: string) => ['application', id] as const,
  dict: (t: DictionaryType) => ['dict', t] as const,
  analytics: ['analytics'] as const,
};

export function useMe() {
  return useQuery({ queryKey: qk.me, queryFn: () => api<UserDto>('/me'), staleTime: 60_000 });
}

export function useUpdateMe() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateProfileInput) => api<UserDto>('/me', { method: 'PATCH', body }),
    onSuccess: (u) => {
      qc.setQueryData(qk.me, u);
      qc.invalidateQueries({ queryKey: qk.analytics });
    },
  });
}

export function useApplications(params: ListParams, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({
    queryKey: [...qk.apps, params],
    queryFn: () => api<Paginated<ApplicationDto>>('/applications', { query: params }),
    placeholderData: keepPreviousData,
    enabled,
  });
}

export function useApplication(id: string | null) {
  return useQuery({
    queryKey: qk.app(id ?? ''),
    queryFn: () => api<ApplicationDto>(`/applications/${id}`),
    enabled: !!id,
  });
}

export function useDictionary(type: DictionaryType) {
  return useQuery({
    queryKey: qk.dict(type),
    queryFn: () => api<DictItem[]>(`/dictionaries/${type}`, { query: { limit: 500 } }),
    staleTime: 30_000,
  });
}

function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: qk.apps });
    qc.invalidateQueries({ queryKey: qk.analytics });
    qc.invalidateQueries({ queryKey: ['dict'] });
    qc.invalidateQueries({ queryKey: ['application'] });
  };
}

export function useCreateApplication() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (body: CreateApplicationInput) => api<ApplicationDto>('/applications', { method: 'POST', body }),
    onSuccess: inv,
  });
}

export function useUpdateApplication(id: string) {
  const inv = useInvalidateAll();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: UpdateApplicationInput) => api<ApplicationDto>(`/applications/${id}`, { method: 'PATCH', body }),
    onSuccess: (a) => {
      qc.setQueryData(qk.app(id), a);
      inv();
    },
  });
}

/** Optimistic status change: list rows update before the server confirms. */
export function useChangeStatus() {
  const qc = useQueryClient();
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...body }: ChangeStatusInput & { id: string }) =>
      api<ApplicationDto>(`/applications/${id}/status`, { method: 'POST', body }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.apps });
      const snapshots = qc.getQueriesData<Paginated<ApplicationDto> | InfiniteData<Paginated<ApplicationDto>>>({ queryKey: qk.apps });
      const patch = (p: Paginated<ApplicationDto>) => ({ ...p, items: p.items.map((a) => (a.id === id ? { ...a, status: status as AppStatus } : a)) });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData(key, 'pages' in data ? { ...data, pages: data.pages.map(patch) } : patch(data));
      }
      return { snapshots };
    },
    onError: (_e, _v, ctx) => ctx?.snapshots.forEach(([key, data]) => qc.setQueryData(key, data)),
    onSettled: inv,
  });
}

export function useDeleteApplication() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api(`/applications/${id}`, { method: 'DELETE' }), onSuccess: inv });
}

export function useRestoreApplication() {
  const inv = useInvalidateAll();
  return useMutation({ mutationFn: (id: string) => api(`/applications/${id}/restore`, { method: 'POST' }), onSuccess: inv });
}

export function useBulk() {
  const inv = useInvalidateAll();
  return useMutation({
    mutationFn: (body: { ids: string[]; action: 'status' | 'delete' | 'archive' | 'tag'; status?: AppStatus; tagName?: string }) =>
      api<{ affected: number }>('/applications/bulk', { method: 'POST', body }),
    onSuccess: inv,
  });
}

const an = <T,>(path: string, period: Period & Record<string, unknown>) =>
  ({ queryKey: [...qk.analytics, path, period], queryFn: () => api<T>(`/analytics/${path}`, { query: period as never }), placeholderData: keepPreviousData });

export const useSummary = (p: Period) => useQuery(an<SummaryDto>('summary', p));
export const useFunnel = (p: Period) => useQuery(an<{ stages: FunnelStageDto[]; statuses: { status: AppStatus; count: number }[] }>('funnel', p));
export const useTimeline = (p: Period) => useQuery(an<TimelinePointDto[]>('timeline', p));
export const useHeatmap = () => useQuery(an<{ date: string; count: number }[]>('heatmap', {}));
export const useInsights = (p: Period) => useQuery(an<InsightDto[]>('insights', p));
export const useSegment = (kind: 'by-source' | 'by-position', p: Period) => useQuery(an<SegmentRowDto[]>(kind, p));
export const useByLocation = (p: Period) => useQuery(an<{ locations: SegmentRowDto[]; formats: SegmentRowDto[] }>('by-location', p));
export const useSalary = (p: Period & { currency?: string }) => useQuery(an<SalaryAnalyticsDto>('salary', p));
export const useAttention = () =>
  useQuery(an<{ upcoming: ApplicationDto[]; waiting: ApplicationDto[]; ghostingDays: number }>('attention', {}));

export function useInfiniteApplications(params: ListParams, pageSize = 50, { enabled = true }: { enabled?: boolean } = {}) {
  return useInfiniteQuery({
    enabled,
    queryKey: [...qk.apps, 'infinite', params, pageSize],
    queryFn: ({ pageParam }) => api<Paginated<ApplicationDto>>('/applications', { query: { ...params, cursor: pageParam, limit: pageSize } }),
    initialPageParam: 0,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    placeholderData: keepPreviousData,
  });
}
