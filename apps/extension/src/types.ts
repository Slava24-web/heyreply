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

/** An application the user adds from the popup; `platform`/`externalId` are set when the page is a known board's vacancy. */
export interface ManualItem extends VacancyData {
  platform?: ImportPlatform | null;
  externalId?: string | null;
  vacancyUrl?: string | null;
  status?: AppStatus | null;
  appliedAt?: string | null;
}
export type ManualResult = { outcome: 'created' | 'updated' | 'unchanged' | 'linked' | 'queued' } | { error: string };

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
  /**
   * The site fires apply-like requests while the form is merely opened (and the form can then be closed unsent), so a
   * captured request is recorded only once the vacancy itself shows the applied marker.
   */
  confirmApply?: boolean;
  /** Where to look for the applied marker (defaults to the whole page). */
  appliedScope?: string[];
  /** "My applications" page with statuses. */
  isListPage?(url: URL): boolean;
  /** Link pattern of a vacancy inside the list (group 1 = id). */
  listLink?: RegExp;
  /**
   * Same-origin path of the "my applications" page when the board renders it on the server. The content script reads
   * it in the background a few times a day while the user is on the board, which catches applications made in the
   * board's mobile app or missed in real time, without the user having to open that page.
   */
  listUrl?: string;
}
