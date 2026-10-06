import { z } from 'zod';
import { APP_STATUSES, CURRENCIES, IMPORT_PLATFORMS, LOCALES, SALARY_TYPES, THEMES, WORK_FORMATS } from './enums';

const name = z.string().trim().min(1).max(160);

/** Only web links: `javascript:` / `data:` URLs would execute when the user clicks "Open vacancy". */
export const httpUrl = z
  .string()
  .trim()
  .max(2000)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'https:' || u.protocol === 'http:';
    } catch {
      return false;
    }
  }, 'url');

export function isSafeHttpUrl(v: string | null | undefined): v is string {
  return !!v && httpUrl.safeParse(v).success;
}
const optionalName = z.string().trim().max(160).optional().nullable();

/** Version of the legal documents (terms, privacy policy, consent). Bump it whenever their text changes materially. */
export const LEGAL_VERSION = '2026-10-06';

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  password: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Za-zА-Яа-я]/, 'password_letter')
    .regex(/\d/, 'password_digit'),
  locale: z.enum(LOCALES).optional(),
  /** Terms of service + privacy policy accepted */
  acceptTerms: z.literal(true),
  /** Separate consent to personal data processing (152-FZ, GDPR art. 6(1)(a)) */
  acceptPersonalData: z.literal(true),
});
export type RegisterInput = z.infer<typeof registerSchema>;

/** Consent given by an existing account after the legal documents were introduced or changed */
export const consentSchema = z.object({ acceptTerms: z.literal(true), acceptPersonalData: z.literal(true) });
export type ConsentInput = z.infer<typeof consentSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: registerSchema.shape.password,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  locale: z.enum(LOCALES).optional(),
  theme: z.enum(THEMES).optional(),
  defaultCurrency: z.string().trim().min(3).max(3).toUpperCase().optional(),
  defaultSalaryType: z.enum(SALARY_TYPES).optional(),
  ghostingDays: z.number().int().min(3).max(90).optional(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;

const salary = z.number().int().min(0).max(1_000_000_000).optional().nullable();

export const applicationBaseSchema = z.object({
  companyName: name,
  positionName: name,
  sourceName: optionalName,
  locationName: optionalName,
  workFormat: z.enum(WORK_FORMATS).optional().nullable(),
  vacancyUrl: httpUrl.optional().nullable().or(z.literal('').transform(() => null)),
  salaryFrom: salary,
  salaryTo: salary,
  currency: z.string().trim().min(3).max(3).toUpperCase().optional().nullable(),
  salaryType: z.enum(SALARY_TYPES).optional().nullable(),
  appliedAt: z.coerce.date().optional(),
  status: z.enum(APP_STATUSES).optional(),
  coverLetter: z.boolean().optional(),
  note: z.string().max(5000).optional().nullable(),
  tags: z.array(name).max(20).optional(),
});

export const createApplicationSchema = applicationBaseSchema.refine(
  (v) => v.salaryFrom == null || v.salaryTo == null || v.salaryFrom <= v.salaryTo,
  { message: 'salary_range', path: ['salaryTo'] },
);
export type CreateApplicationInput = z.infer<typeof createApplicationSchema>;

export const updateApplicationSchema = applicationBaseSchema
  .partial()
  .extend({
    offerAmount: salary,
    nextStepAt: z.coerce.date().optional().nullable(),
    rejectionReason: z.string().max(160).optional().nullable(),
  });
export type UpdateApplicationInput = z.infer<typeof updateApplicationSchema>;

export const changeStatusSchema = z.object({
  status: z.enum(APP_STATUSES),
  changedAt: z.coerce.date().optional(),
  comment: z.string().max(1000).optional().nullable(),
  rejectionReason: z.string().max(160).optional().nullable(),
  nextStepAt: z.coerce.date().optional().nullable(),
  offerAmount: salary,
});
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z.preprocess((v) => (v == null || v === '' ? undefined : Array.isArray(v) ? v : String(v).split(',')), z.array(item).optional());

export const listApplicationsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  status: csv(z.enum(APP_STATUSES)),
  sourceId: csv(z.string().uuid()),
  positionId: csv(z.string().uuid()),
  locationId: csv(z.string().uuid()),
  companyId: csv(z.string().uuid()),
  format: csv(z.enum(WORK_FORMATS)),
  tag: csv(z.string().uuid()),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  salaryMin: z.coerce.number().int().optional(),
  salaryMax: z.coerce.number().int().optional(),
  waitingOnly: z.preprocess((v) => v === 'true' || v === true, z.boolean()).optional(),
  sort: z
    .enum(['appliedAt', '-appliedAt', 'updatedAt', '-updatedAt', 'company', '-company', 'position', '-position', 'salary', '-salary', 'status', '-status'])
    .default('-appliedAt'),
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(50),
});
export type ListApplicationsQuery = z.infer<typeof listApplicationsQuerySchema>;

export const bulkActionSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
  action: z.enum(['status', 'delete', 'archive', 'tag']),
  status: z.enum(APP_STATUSES).optional(),
  tagName: name.optional(),
});
export type BulkActionInput = z.infer<typeof bulkActionSchema>;

export const dictionaryCreateSchema = z.object({ name });
export const dictionaryUpdateSchema = z.object({ name: name.optional(), groupName: optionalName });
export const dictionaryMergeSchema = z.object({
  sourceIds: z.array(z.string().uuid()).min(1),
  targetId: z.string().uuid(),
});

export const analyticsQuerySchema = z.object({
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  currency: z.string().min(3).max(3).optional(),
  bucket: z.coerce.number().int().positive().optional(),
});
export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

/** One application observed by the browser extension on a job board. */
export const importItemSchema = z.object({
  platform: z.enum(IMPORT_PLATFORMS),
  externalId: z.string().trim().min(1).max(120),
  companyName: name,
  positionName: name,
  vacancyUrl: httpUrl.optional().nullable(),
  locationName: optionalName,
  workFormat: z.enum(WORK_FORMATS).optional().nullable(),
  salaryFrom: salary,
  salaryTo: salary,
  currency: z.string().trim().min(3).max(3).toUpperCase().optional().nullable(),
  /** When the user applied (if the board shows it); defaults to now for fresh applications. */
  appliedAt: z.coerce.date().optional().nullable(),
  /** Normalized status as shown on the board's "my applications" page. */
  status: z.enum(APP_STATUSES).optional().nullable(),
  /** Where the observation came from: the moment of applying or a status sync of the list page. */
  origin: z.enum(['apply', 'sync']).default('apply'),
});
export type ImportItem = z.infer<typeof importItemSchema>;

export const importBatchSchema = z.object({ items: z.array(importItemSchema).min(1).max(200) });
export type ImportBatch = z.infer<typeof importBatchSchema>;

export type ImportOutcome = 'created' | 'updated' | 'unchanged' | 'linked' | 'error';

export interface ImportResultDto {
  /** Outcome per input item, in the same order */
  items: ImportOutcome[];
  created: number;
  updated: number;
  unchanged: number;
  linked: number;
  errors: { index: number; message: string }[];
}

export const createTokenSchema = z.object({ name: z.string().trim().min(1).max(60) });

export { CURRENCIES };
