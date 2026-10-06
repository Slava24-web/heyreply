import type { AppStatus, SalaryType, WorkFormat, Locale, Theme } from './enums';

export interface DictItem {
  id: string;
  name: string;
  usageCount: number;
  lastUsedAt: string | null;
  groupName?: string | null;
}

export interface UserDto {
  id: string;
  email: string;
  name: string;
  locale: Locale;
  theme: Theme;
  defaultCurrency: string;
  defaultSalaryType: SalaryType;
  ghostingDays: number;
  createdAt: string;
}

export interface StatusHistoryDto {
  id: string;
  fromStatus: AppStatus | null;
  toStatus: AppStatus;
  changedAt: string;
  comment: string | null;
}

export interface ApplicationDto {
  id: string;
  company: { id: string; name: string };
  position: { id: string; name: string };
  source: { id: string; name: string } | null;
  location: { id: string; name: string } | null;
  workFormat: WorkFormat | null;
  vacancyUrl: string | null;
  salaryFrom: number | null;
  salaryTo: number | null;
  currency: string | null;
  salaryType: SalaryType | null;
  offerAmount: number | null;
  appliedAt: string;
  status: AppStatus;
  maxStage: number;
  firstResponseAt: string | null;
  coverLetter: boolean;
  rejectionReason: string | null;
  nextStepAt: string | null;
  note: string | null;
  tags: { id: string; name: string }[];
  externalSource: string | null;
  createdAt: string;
  updatedAt: string;
  daysWaiting: number | null;
  history?: StatusHistoryDto[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  nextCursor: number | null;
}

export interface SummaryDto {
  total: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  rejectionRate: number;
  ghostingRate: number;
  active: number;
  medianResponseDays: number | null;
  waitingOverThreshold: number;
  previous: Omit<SummaryDto, 'previous'> | null;
}

export interface FunnelStageDto {
  stage: number;
  count: number;
  fromPrev: number;
  fromFirst: number;
}

export interface SegmentRowDto {
  key: string;
  label: string;
  total: number;
  responded: number;
  interviews: number;
  offers: number;
  responseRate: number;
  interviewRate: number;
  offerRate: number;
  lowSample: boolean;
}

export interface TimelinePointDto {
  period: string;
  applications: number;
  responses: number;
}

export interface SalaryBucketDto {
  from: number;
  to: number;
  total: number;
  interviews: number;
  offers: number;
  interviewRate: number;
  lowSample: boolean;
}

export interface SalaryAnalyticsDto {
  currency: string;
  bucket: number;
  buckets: SalaryBucketDto[];
  quartiles: { q1: number; median: number; q3: number; min: number; max: number } | null;
  offers: { company: string; position: string; salaryFrom: number | null; salaryTo: number | null; offerAmount: number }[];
  currencies: string[];
}

export interface InsightDto {
  kind: 'source' | 'salary' | 'coverLetter' | 'format' | 'ghosting';
  params: Record<string, string | number>;
}

export interface ApiTokenDto {
  id: string;
  name: string;
  prefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}
