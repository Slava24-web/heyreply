import type { AppStatus, ImportPlatform, WorkFormat } from '@heyreply/shared';

export interface Observed {
  platform: ImportPlatform;
  externalId: string;
  companyName: string;
  positionName: string;
  vacancyUrl?: string | null;
  locationName?: string | null;
  workFormat?: WorkFormat | null;
  salaryFrom?: number | null;
  salaryTo?: number | null;
  currency?: string | null;
  appliedAt?: string | null;
  status?: AppStatus | null;
  origin: 'apply' | 'sync';
}

export interface VacancyData {
  positionName: string;
  companyName: string;
  locationName?: string | null;
  workFormat?: WorkFormat | null;
  salaryFrom?: number | null;
  salaryTo?: number | null;
  currency?: string | null;
}

export interface Adapter {
  platform: ImportPlatform;
  hosts: RegExp;
  /** Vacancy id when the URL is a single-vacancy page. */
  vacancyId(url: URL): string | null;
  vacancyUrl(id: string): string;
  /** Selectors tried before generic fallbacks (JSON-LD, og:title, h1). */
  titleSelectors: string[];
  companySelectors: string[];
  /** Board-specific `document.title` format, e.g. Greenhouse "Job Application for X at Y". */
  docTitle?(title: string): { position?: string; company?: string } | null;
  /** Last resort for ATS pages that only carry the company in the URL (jobs.lever.co/<company>/…). */
  companyFromUrl?(url: URL): string | null;
  /** Text that only appears on a vacancy page after the user has applied. */
  appliedMarker: RegExp;
  /** Where to look for the applied marker (defaults to the whole page). */
  appliedScope?: string[];
  /** "My applications" page with statuses. */
  isListPage?(url: URL): boolean;
  /** Link pattern of a vacancy inside the list (group 1 = id). */
  listLink?: RegExp;
}
