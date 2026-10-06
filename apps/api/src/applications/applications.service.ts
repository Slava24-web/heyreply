import { HttpStatus, Injectable } from '@nestjs/common';
import {
  detectSourceByUrl,
  normalizeName,
  type BulkActionInput,
  type ChangeStatusInput,
  type CreateApplicationInput,
  type ListApplicationsQuery,
  type Paginated,
  type ApplicationDto,
  type UpdateApplicationInput,
} from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DictionariesService } from '../dictionaries/dictionaries.service';
import { AppError } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';
import { applicationInclude, toApplicationDto } from './applications.mapper';
import { applyTransition } from './status.logic';

type Tx = Prisma.TransactionClient;

@Injectable()
export class ApplicationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dict: DictionariesService,
  ) {}

  private async owned(tx: Tx | PrismaService, userId: string, id: string) {
    const app = await tx.application.findFirst({ where: { id, userId, deletedAt: null } });
    if (!app) throw new AppError(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    return app;
  }

  async get(userId: string, id: string): Promise<ApplicationDto> {
    const app = await this.prisma.application.findFirst({
      where: { id, userId, deletedAt: null },
      include: { ...applicationInclude, statusHistory: { orderBy: { changedAt: 'asc' } } },
    });
    if (!app) throw new AppError(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    return toApplicationDto(app);
  }

  async create(userId: string, input: CreateApplicationInput): Promise<ApplicationDto> {
    const id = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: userId } });
      const sourceName = input.sourceName || (input.vacancyUrl ? detectSourceByUrl(input.vacancyUrl, user.locale) : null);
      const appliedAt = input.appliedAt ?? new Date();
      const status = input.status ?? 'APPLIED';
      const state = applyTransition(null, status, appliedAt);
      const hasSalary = input.salaryFrom != null || input.salaryTo != null;

      const app = await tx.application.create({
        data: {
          userId,
          companyId: await this.dict.resolve(tx, userId, 'companies', input.companyName),
          positionId: await this.dict.resolve(tx, userId, 'positions', input.positionName),
          sourceId: sourceName ? await this.dict.resolve(tx, userId, 'sources', sourceName) : null,
          locationId: input.locationName ? await this.dict.resolve(tx, userId, 'locations', input.locationName) : null,
          workFormat: input.workFormat ?? null,
          vacancyUrl: input.vacancyUrl || null,
          salaryFrom: input.salaryFrom ?? null,
          salaryTo: input.salaryTo ?? null,
          currency: hasSalary ? (input.currency ?? user.defaultCurrency) : (input.currency ?? null),
          salaryType: hasSalary ? (input.salaryType ?? user.defaultSalaryType) : (input.salaryType ?? null),
          appliedAt,
          coverLetter: input.coverLetter ?? false,
          note: input.note || null,
          ...state,
          statusHistory: { create: { fromStatus: null, toStatus: status, changedAt: appliedAt } },
        },
      });
      await this.setTags(tx, userId, app.id, input.tags);
      return app.id;
    });
    return this.get(userId, id);
  }

  async update(userId: string, id: string, input: UpdateApplicationInput): Promise<ApplicationDto> {
    await this.prisma.$transaction(async (tx) => {
      await this.owned(tx, userId, id);
      const data: Prisma.ApplicationUncheckedUpdateInput = {};
      if (input.companyName) data.companyId = await this.dict.resolve(tx, userId, 'companies', input.companyName);
      if (input.positionName) data.positionId = await this.dict.resolve(tx, userId, 'positions', input.positionName);
      if (input.sourceName !== undefined)
        data.sourceId = input.sourceName ? await this.dict.resolve(tx, userId, 'sources', input.sourceName) : null;
      if (input.locationName !== undefined)
        data.locationId = input.locationName ? await this.dict.resolve(tx, userId, 'locations', input.locationName) : null;
      for (const k of [
        'workFormat', 'vacancyUrl', 'salaryFrom', 'salaryTo', 'currency', 'salaryType', 'appliedAt',
        'coverLetter', 'note', 'offerAmount', 'nextStepAt', 'rejectionReason',
      ] as const) {
        if (input[k] !== undefined) (data as Record<string, unknown>)[k] = input[k];
      }
      await tx.application.update({ where: { id }, data });
      if (input.status) await this.transition(tx, userId, id, { status: input.status });
      if (input.tags) await this.setTags(tx, userId, id, input.tags);
    });
    return this.get(userId, id);
  }

  async changeStatus(userId: string, id: string, input: ChangeStatusInput): Promise<ApplicationDto> {
    await this.prisma.$transaction((tx) => this.transition(tx, userId, id, input));
    return this.get(userId, id);
  }

  private async transition(tx: Tx, userId: string, id: string, input: ChangeStatusInput) {
    const app = await this.owned(tx, userId, id);
    const at = input.changedAt ?? new Date();
    const extra: Prisma.ApplicationUncheckedUpdateInput = {};
    if (input.rejectionReason !== undefined) extra.rejectionReason = input.rejectionReason;
    if (input.nextStepAt !== undefined) extra.nextStepAt = input.nextStepAt;
    if (input.offerAmount !== undefined) extra.offerAmount = input.offerAmount;

    if (app.status === input.status) {
      if (Object.keys(extra).length) await tx.application.update({ where: { id }, data: extra });
      return;
    }
    const state = applyTransition(app, input.status, at);
    await tx.application.update({ where: { id }, data: { ...state, ...extra } });
    await tx.statusHistory.create({
      data: { applicationId: id, fromStatus: app.status, toStatus: input.status, changedAt: at, comment: input.comment || null },
    });
  }

  private async setTags(tx: Tx, userId: string, appId: string, tags?: string[]) {
    if (!tags) return;
    await tx.applicationTag.deleteMany({ where: { applicationId: appId } });
    const unique = [...new Map(tags.map((t) => [normalizeName(t), t])).values()];
    for (const t of unique) {
      const tagId = await this.dict.resolve(tx, userId, 'tags', t);
      await tx.applicationTag.create({ data: { applicationId: appId, tagId } });
    }
  }

  async remove(userId: string, id: string) {
    await this.owned(this.prisma, userId, id);
    await this.prisma.application.update({ where: { id }, data: { deletedAt: new Date() } });
    return { ok: true };
  }

  async restore(userId: string, id: string) {
    const app = await this.prisma.application.findFirst({ where: { id, userId } });
    if (!app) throw new AppError(HttpStatus.NOT_FOUND, 'APPLICATION_NOT_FOUND');
    await this.prisma.application.update({ where: { id }, data: { deletedAt: null, archivedAt: null } });
    return this.get(userId, id);
  }

  async bulk(userId: string, input: BulkActionInput) {
    const ids = (await this.prisma.application.findMany({ where: { userId, id: { in: input.ids }, deletedAt: null }, select: { id: true } })).map(
      (a) => a.id,
    );
    if (input.action === 'delete') {
      await this.prisma.application.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
    } else if (input.action === 'archive') {
      await this.prisma.application.updateMany({ where: { id: { in: ids } }, data: { archivedAt: new Date() } });
    } else if (input.action === 'status' && input.status) {
      await this.prisma.$transaction(async (tx) => {
        for (const id of ids) await this.transition(tx, userId, id, { status: input.status! });
      });
    } else if (input.action === 'tag' && input.tagName) {
      await this.prisma.$transaction(async (tx) => {
        const tagId = await this.dict.resolve(tx, userId, 'tags', input.tagName!);
        await tx.applicationTag.createMany({ data: ids.map((applicationId) => ({ applicationId, tagId })), skipDuplicates: true });
      });
    } else {
      throw new AppError(HttpStatus.BAD_REQUEST, 'BULK_INVALID');
    }
    return { ok: true, affected: ids.length };
  }

  buildWhere(userId: string, q: Partial<ListApplicationsQuery>): Prisma.ApplicationWhereInput {
    const and: Prisma.ApplicationWhereInput[] = [];
    if (q.q) {
      const nq = normalizeName(q.q);
      and.push({
        OR: [
          { company: { normalizedName: { contains: nq } } },
          { position: { normalizedName: { contains: nq } } },
          { note: { contains: q.q, mode: 'insensitive' } },
        ],
      });
    }
    if (q.salaryMin != null) and.push({ OR: [{ salaryTo: { gte: q.salaryMin } }, { salaryTo: null, salaryFrom: { gte: q.salaryMin } }] });
    if (q.salaryMax != null) and.push({ salaryFrom: { lte: q.salaryMax } });
    return {
      userId,
      deletedAt: null,
      archivedAt: null,
      ...(q.status?.length ? { status: { in: q.status } } : {}),
      ...(q.sourceId?.length ? { sourceId: { in: q.sourceId } } : {}),
      ...(q.positionId?.length ? { positionId: { in: q.positionId } } : {}),
      ...(q.locationId?.length ? { locationId: { in: q.locationId } } : {}),
      ...(q.companyId?.length ? { companyId: { in: q.companyId } } : {}),
      ...(q.format?.length ? { workFormat: { in: q.format } } : {}),
      ...(q.tag?.length ? { tags: { some: { tagId: { in: q.tag } } } } : {}),
      ...(q.from || q.to ? { appliedAt: { ...(q.from ? { gte: q.from } : {}), ...(q.to ? { lte: q.to } : {}) } } : {}),
      ...(q.waitingOnly ? { status: { in: ['APPLIED', 'VIEWED'] } } : {}),
      ...(and.length ? { AND: and } : {}),
    };
  }

  async list(userId: string, q: ListApplicationsQuery): Promise<Paginated<ApplicationDto>> {
    const where = this.buildWhere(userId, q);
    const desc = q.sort.startsWith('-');
    const dir = desc ? 'desc' : 'asc';
    const key = q.sort.replace('-', '');
    const orderBy: Prisma.ApplicationOrderByWithRelationInput[] =
      key === 'company'
        ? [{ company: { name: dir } }]
        : key === 'position'
          ? [{ position: { name: dir } }]
          : key === 'salary'
            ? [{ salaryFrom: { sort: dir, nulls: 'last' } }]
            : [{ [key]: dir }];
    orderBy.push({ createdAt: 'desc' });

    const [total, rows] = await Promise.all([
      this.prisma.application.count({ where }),
      this.prisma.application.findMany({ where, include: applicationInclude, orderBy, skip: q.cursor, take: q.limit }),
    ]);
    const next = q.cursor + rows.length;
    return { items: rows.map(toApplicationDto), total, nextCursor: next < total ? next : null };
  }

  async duplicates(userId: string, companyName: string, positionName: string) {
    const since = new Date(Date.now() - 30 * 86_400_000);
    const rows = await this.prisma.application.findMany({
      where: {
        userId,
        deletedAt: null,
        appliedAt: { gte: since },
        company: { normalizedName: normalizeName(companyName) },
        position: { normalizedName: normalizeName(positionName) },
      },
      include: applicationInclude,
      orderBy: { appliedAt: 'desc' },
      take: 3,
    });
    return rows.map(toApplicationDto);
  }

  async last(userId: string) {
    const row = await this.prisma.application.findFirst({
      where: { userId, deletedAt: null },
      include: applicationInclude,
      orderBy: { createdAt: 'desc' },
    });
    return row ? toApplicationDto(row) : null;
  }

  async exportAll(userId: string, q: Partial<ListApplicationsQuery> = {}) {
    const rows = await this.prisma.application.findMany({
      where: this.buildWhere(userId, q),
      include: { ...applicationInclude, statusHistory: { orderBy: { changedAt: 'asc' } } },
      orderBy: { appliedAt: 'desc' },
    });
    return rows.map(toApplicationDto);
  }

  /** Everything the user has, for the data export: archived and not-yet-purged deleted applications included. */
  async exportEverything(userId: string) {
    const rows = await this.prisma.application.findMany({
      where: { userId },
      include: { ...applicationInclude, statusHistory: { orderBy: { changedAt: 'asc' } } },
      orderBy: { appliedAt: 'desc' },
    });
    return rows.map((r) => ({ ...toApplicationDto(r), archivedAt: r.archivedAt?.toISOString() ?? null, deletedAt: r.deletedAt?.toISOString() ?? null }));
  }

  toCsv(items: ApplicationDto[]) {
    const head = [
      'appliedAt', 'company', 'position', 'status', 'source', 'location', 'workFormat',
      'salaryFrom', 'salaryTo', 'currency', 'salaryType', 'offerAmount', 'coverLetter', 'vacancyUrl', 'tags', 'note',
    ];
    const esc = (v: unknown) => {
      let s = v == null ? '' : String(v);
      // CSV/formula injection: spreadsheet apps execute cells starting with = + - @ (and tab/CR variants)
      if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const lines = items.map((a) =>
      [
        a.appliedAt.slice(0, 10), a.company.name, a.position.name, a.status, a.source?.name, a.location?.name, a.workFormat,
        a.salaryFrom, a.salaryTo, a.currency, a.salaryType, a.offerAmount, a.coverLetter, a.vacancyUrl,
        a.tags.map((t) => t.name).join('|'), a.note,
      ].map(esc).join(','),
    );
    return '﻿' + [head.join(','), ...lines].join('\n');
  }
}
