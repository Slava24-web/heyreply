import { WAITING_STATUSES, type ApplicationDto } from '@heyreply/shared';
import type { Prisma } from '../generated/prisma/client';

export const applicationInclude = {
  company: { select: { id: true, name: true } },
  position: { select: { id: true, name: true } },
  source: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  tags: { include: { tag: { select: { id: true, name: true } } } },
} satisfies Prisma.ApplicationInclude;

export type ApplicationRow = Prisma.ApplicationGetPayload<{ include: typeof applicationInclude }> & {
  statusHistory?: { id: string; fromStatus: any; toStatus: any; changedAt: Date; comment: string | null }[];
};

const DAY = 86_400_000;

export function toApplicationDto(a: ApplicationRow): ApplicationDto {
  return {
    id: a.id,
    company: a.company,
    position: a.position,
    source: a.source,
    location: a.location,
    workFormat: a.workFormat,
    vacancyUrl: a.vacancyUrl,
    salaryFrom: a.salaryFrom,
    salaryTo: a.salaryTo,
    currency: a.currency,
    salaryType: a.salaryType,
    offerAmount: a.offerAmount,
    appliedAt: a.appliedAt.toISOString(),
    status: a.status,
    maxStage: a.maxStage,
    firstResponseAt: a.firstResponseAt?.toISOString() ?? null,
    coverLetter: a.coverLetter,
    rejectionReason: a.rejectionReason,
    nextStepAt: a.nextStepAt?.toISOString() ?? null,
    note: a.note,
    tags: a.tags.map((t) => t.tag),
    externalSource: a.externalSource,
    createdAt: a.createdAt.toISOString(),
    updatedAt: a.updatedAt.toISOString(),
    daysWaiting: WAITING_STATUSES.includes(a.status) ? Math.floor((Date.now() - a.appliedAt.getTime()) / DAY) : null,
    history: a.statusHistory?.map((h) => ({
      id: h.id,
      fromStatus: h.fromStatus,
      toStatus: h.toStatus,
      changedAt: h.changedAt.toISOString(),
      comment: h.comment,
    })),
  };
}
