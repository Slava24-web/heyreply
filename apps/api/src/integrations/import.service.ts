import { Injectable } from '@nestjs/common';
import {
  cleanCompanyName,
  normalizeName,
  platformSourceName,
  STATUS_STAGE,
  type AppStatus,
  type ImportItem,
  type ImportResultDto,
} from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DictionariesService } from '../dictionaries/dictionaries.service';
import { applyTransition } from '../applications/status.logic';
import type { Prisma } from '../generated/prisma/client';

const FINAL: AppStatus[] = ['OFFER', 'ACCEPTED', 'REJECTED', 'DECLINED'];
/** A manually created application this recent with the same company + position is the same one. */
const LINK_WINDOW_MS = 60 * 86_400_000;

/**
 * Whether a status seen on the job board should replace ours. Boards only move forward
 * (viewed → invitation → rejection/offer); we never move an application backwards or
 * overwrite a final status the user set by hand.
 */
export function shouldApplyStatus(current: AppStatus, maxStage: number, incoming: AppStatus): boolean {
  if (incoming === current) return false;
  if (FINAL.includes(current)) return false;
  if (incoming === 'APPLIED') return false;
  if (incoming === 'REJECTED' || incoming === 'OFFER' || incoming === 'NO_RESPONSE') return true;
  return STATUS_STAGE[incoming] > maxStage || (incoming === 'VIEWED' && current === 'APPLIED');
}

@Injectable()
export class ImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dict: DictionariesService,
  ) {}

  async importBatch(userId: string, rawItems: ImportItem[]): Promise<ImportResultDto> {
    const items = rawItems.map((i) => ({ ...i, companyName: cleanCompanyName(i.companyName) }));
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true, defaultCurrency: true, defaultSalaryType: true } });
    const result: ImportResultDto = { items: [], created: 0, updated: 0, unchanged: 0, linked: 0, errors: [] };
    for (const [index, item] of items.entries()) {
      try {
        const outcome = await this.prisma.$transaction((tx) => this.importOne(tx, userId, user, item));
        result[outcome]++;
        result.items.push(outcome);
      } catch (e) {
        result.items.push('error');
        result.errors.push({ index, message: e instanceof Error ? e.message.slice(0, 200) : 'error' });
      }
    }
    return result;
  }

  private async importOne(
    tx: Prisma.TransactionClient,
    userId: string,
    user: { locale: string; defaultCurrency: string; defaultSalaryType: 'GROSS' | 'NET' },
    item: ImportItem,
  ): Promise<'created' | 'updated' | 'unchanged' | 'linked'> {
    const sourceLabel = platformSourceName(item.platform, user.locale);
    const note = user.locale === 'en' ? `Imported from ${sourceLabel}` : `Импорт: ${sourceLabel}`;
    const now = new Date();

    let existing = await tx.application.findUnique({
      where: { userId_externalSource_externalId: { userId, externalSource: item.platform, externalId: item.externalId } },
    });
    let linked = false;

    if (!existing) {
      // Same company + position seen recently: an application added by hand, or one the e-mail import
      // recorded under a derived "mail-…" id (ATS e-mails don't carry the job id)
      const synthetic = item.externalId.startsWith('mail-');
      existing = await tx.application.findFirst({
        where: {
          userId,
          deletedAt: null,
          appliedAt: { gte: new Date(now.getTime() - LINK_WINDOW_MS) },
          company: { normalizedName: normalizeName(item.companyName) },
          position: { normalizedName: normalizeName(item.positionName) },
          OR: [
            { externalId: null },
            { externalSource: item.platform, externalId: { startsWith: 'mail-' } },
            ...(synthetic ? [{ externalSource: item.platform }] : []),
          ],
        },
        orderBy: { appliedAt: 'desc' },
      });
      if (existing) {
        linked = true;
        // Keep a real job id over a derived one
        const upgradeId = !existing.externalId || (existing.externalId.startsWith('mail-') && !synthetic);
        await tx.application.update({
          where: { id: existing.id },
          data: {
            ...(upgradeId ? { externalSource: item.platform, externalId: item.externalId } : {}),
            importedAt: now,
            vacancyUrl: existing.vacancyUrl ?? item.vacancyUrl ?? null,
            sourceId: existing.sourceId ?? (await this.dict.resolve(tx, userId, 'sources', sourceLabel)),
          },
        });
      }
    }

    if (existing) {
      if (existing.deletedAt) return 'unchanged'; // the user deleted it on purpose — don't resurrect
      const incoming = item.status ?? null;
      if (incoming && shouldApplyStatus(existing.status, existing.maxStage, incoming)) {
        const state = applyTransition(existing, incoming, now);
        await tx.application.update({ where: { id: existing.id }, data: { ...state, importedAt: now } });
        await tx.statusHistory.create({
          data: { applicationId: existing.id, fromStatus: existing.status, toStatus: incoming, changedAt: now, comment: note },
        });
        return 'updated';
      }
      return linked ? 'linked' : 'unchanged';
    }

    // New application
    const appliedAt = item.appliedAt ?? now;
    const status: AppStatus = item.status && item.status !== 'APPLIED' ? item.status : 'APPLIED';
    const hasSalary = item.salaryFrom != null || item.salaryTo != null;
    const history: Prisma.StatusHistoryCreateWithoutApplicationInput[] = [{ fromStatus: null, toStatus: 'APPLIED', changedAt: appliedAt, comment: note }];
    let state = applyTransition(null, 'APPLIED', appliedAt);
    if (status !== 'APPLIED') {
      state = applyTransition(state, status, now);
      history.push({ fromStatus: 'APPLIED', toStatus: status, changedAt: now, comment: note });
    }
    await tx.application.create({
      data: {
        userId,
        companyId: await this.dict.resolve(tx, userId, 'companies', item.companyName),
        positionId: await this.dict.resolve(tx, userId, 'positions', item.positionName),
        sourceId: await this.dict.resolve(tx, userId, 'sources', sourceLabel),
        locationId: item.locationName ? await this.dict.resolve(tx, userId, 'locations', item.locationName) : null,
        workFormat: item.workFormat ?? null,
        vacancyUrl: item.vacancyUrl ?? null,
        salaryFrom: item.salaryFrom ?? null,
        salaryTo: item.salaryTo ?? null,
        currency: hasSalary ? (item.currency ?? user.defaultCurrency) : null,
        salaryType: hasSalary ? user.defaultSalaryType : null,
        appliedAt,
        externalSource: item.platform,
        externalId: item.externalId,
        importedAt: now,
        ...state,
        statusHistory: { create: history },
      },
    });
    return 'created';
  }
}
