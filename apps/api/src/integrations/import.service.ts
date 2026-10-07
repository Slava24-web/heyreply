import { Injectable } from '@nestjs/common';
import {
  cleanCompanyName,
  detectSourceByUrl,
  normalizeName,
  platformSourceName,
  STATUS_STAGE,
  type AppStatus,
  type ImportItem,
  type ImportResultDto,
  type ImportOutcome,
  type ManualImport,
} from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DictionariesService } from '../dictionaries/dictionaries.service';
import { assertApplicationQuota } from '../applications/quota';
import { applyTransition } from '../applications/status.logic';
import type { Prisma } from '../generated/prisma/client';

const FINAL: AppStatus[] = ['OFFER', 'ACCEPTED', 'REJECTED', 'DECLINED'];
/** A manually created application this recent with the same company + position is the same one. */
const LINK_WINDOW_MS = 60 * 86_400_000;
/** `externalSource` of applications added by hand from the extension on a site it has no adapter for. */
export const WEB_SOURCE = 'web';

type UserPrefs = { locale: string; defaultCurrency: string; defaultSalaryType: 'GROSS' | 'NET' };
/** An import item whose source is either a known board or the open web (manual add). */
type Item = Omit<ImportItem, 'platform' | 'origin'> & { platform: string };
type Source = { label: string | null; note: string };

/**
 * Stable id of a vacancy page without a board adapter: host + path, without query, hash and trailing slash
 * (tracking parameters differ between visits of the same page). Long URLs keep their tail, which is the specific part.
 */
export function webVacancyId(url: string): string {
  const u = new URL(url);
  const id = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`.toLowerCase();
  return id.length > 120 ? id.slice(-120) : id;
}

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
    const user = await this.prefs(userId);
    const result: ImportResultDto = { items: [], created: 0, updated: 0, unchanged: 0, linked: 0, errors: [] };
    for (const [index, item] of items.entries()) {
      try {
        const label = platformSourceName(item.platform, user.locale);
        const source = { label, note: user.locale === 'en' ? `Imported from ${label}` : `Импорт: ${label}` };
        const outcome = await this.prisma.$transaction((tx) => this.importOne(tx, userId, user, item, source));
        result[outcome]++;
        result.items.push(outcome);
      } catch (e) {
        result.items.push('error');
        result.errors.push({ index, message: e instanceof Error ? e.message.slice(0, 200) : 'error' });
      }
    }
    return result;
  }

  /**
   * Manual add from the extension popup on a page it can't parse on its own. With a vacancy link the page itself is the
   * id (adding it again changes nothing); without one it is a plain manual application, like one added in the web app.
   */
  async importManual(userId: string, raw: ManualImport): Promise<{ outcome: ImportOutcome }> {
    const user = await this.prefs(userId);
    const url = raw.vacancyUrl || null;
    const company = user.locale === 'en' ? 'Company website' : 'Сайт компании';
    const source = { label: url ? (detectSourceByUrl(url, user.locale) ?? company) : null, note: user.locale === 'en' ? 'Added from the browser extension' : 'Добавлено из расширения' };
    const item: Item = { ...raw, companyName: cleanCompanyName(raw.companyName), platform: WEB_SOURCE, externalId: url ? webVacancyId(url) : '', vacancyUrl: url };
    const outcome = await this.prisma.$transaction((tx) => this.importOne(tx, userId, user, item, source));
    return { outcome };
  }

  private prefs(userId: string): Promise<UserPrefs> {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { locale: true, defaultCurrency: true, defaultSalaryType: true } });
  }

  private async importOne(tx: Prisma.TransactionClient, userId: string, user: UserPrefs, item: Item, source: Source): Promise<'created' | 'updated' | 'unchanged' | 'linked'> {
    const { label: sourceLabel, note } = source;
    const now = new Date();
    // A manual add without a link has no identity on the web: it is stored like an application typed in the web app
    const externalId = item.externalId || null;

    let existing = externalId
      ? await tx.application.findUnique({ where: { userId_externalSource_externalId: { userId, externalSource: item.platform, externalId } } })
      : null;
    let linked = false;

    if (!existing) {
      // Same company + position seen recently: an application added by hand, or a legacy one recorded by the
      // removed e-mail import under a derived "mail-…" id
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
          ],
        },
        orderBy: { appliedAt: 'desc' },
      });
      if (existing) {
        linked = true;
        // Replace a missing or legacy derived id with the real one
        const upgradeId = externalId && (!existing.externalId || existing.externalId.startsWith('mail-'));
        await tx.application.update({
          where: { id: existing.id },
          data: {
            ...(upgradeId ? { externalSource: item.platform, externalId } : {}),
            importedAt: now,
            vacancyUrl: existing.vacancyUrl ?? item.vacancyUrl ?? null,
            sourceId: existing.sourceId ?? (sourceLabel ? await this.dict.resolve(tx, userId, 'sources', sourceLabel) : null),
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

    // Purged after the user deleted it: the retention job keeps only the vacancy id for this check
    const purged = externalId
      ? await tx.deletedImport.findUnique({ where: { userId_externalSource_externalId: { userId, externalSource: item.platform, externalId } } })
      : null;
    if (purged) return 'unchanged';

    // New application
    await assertApplicationQuota(tx, userId);
    // The date comes from a parsed page: never let it land in the future
    const appliedAt = item.appliedAt && item.appliedAt < now ? item.appliedAt : now;
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
        sourceId: sourceLabel ? await this.dict.resolve(tx, userId, 'sources', sourceLabel) : null,
        locationId: item.locationName ? await this.dict.resolve(tx, userId, 'locations', item.locationName) : null,
        workFormat: item.workFormat ?? null,
        vacancyUrl: item.vacancyUrl ?? null,
        salaryFrom: item.salaryFrom ?? null,
        salaryTo: item.salaryTo ?? null,
        currency: hasSalary ? (item.currency ?? user.defaultCurrency) : null,
        salaryType: hasSalary ? user.defaultSalaryType : null,
        appliedAt,
        externalSource: externalId ? item.platform : null,
        externalId,
        importedAt: now,
        ...state,
        statusHistory: { create: history },
      },
    });
    return 'created';
  }
}
