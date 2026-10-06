import { HttpStatus, Injectable } from '@nestjs/common';
import { normalizeName, SYSTEM_SOURCES, systemSourceName, type DictItem, type DictionaryType } from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../common/errors';
import type { Prisma } from '../generated/prisma/client';

type Tx = Prisma.TransactionClient | PrismaService;
type FkField = 'companyId' | 'positionId' | 'sourceId' | 'locationId';

const MODEL: Record<DictionaryType, 'company' | 'position' | 'source' | 'location' | 'tag'> = {
  companies: 'company',
  positions: 'position',
  sources: 'source',
  locations: 'location',
  tags: 'tag',
};
const FK: Partial<Record<DictionaryType, FkField>> = {
  companies: 'companyId',
  positions: 'positionId',
  sources: 'sourceId',
  locations: 'locationId',
};

interface Row {
  id: string;
  name: string;
  normalizedName: string;
  usageCount: number;
  lastUsedAt: Date | null;
  groupName?: string | null;
}

@Injectable()
export class DictionariesService {
  constructor(private readonly prisma: PrismaService) {}

  // Prisma delegates share the same shape for these five models; a loose type keeps the service generic.
  private delegate(tx: Tx, type: DictionaryType): any {
    return (tx as any)[MODEL[type]];
  }

  /** Preset sources in the user's interface language (renamable later like any other entry). */
  async seedSystemSources(userId: string, locale: string) {
    await this.prisma.source.createMany({
      data: SYSTEM_SOURCES.map((s) => ({
        userId,
        name: systemSourceName(s, locale),
        normalizedName: normalizeName(systemSourceName(s, locale)),
        domain: s.domains[0] ?? null,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
  }

  /** Find-or-create by normalized name and bump usage stats. Returns the id. */
  async resolve(tx: Tx, userId: string, type: DictionaryType, name: string, bump = true): Promise<string> {
    const clean = name.trim().replace(/\s+/g, ' ');
    const normalizedName = normalizeName(clean);
    const row = await this.delegate(tx, type).upsert({
      where: { userId_normalizedName: { userId, normalizedName } },
      create: { userId, name: clean, normalizedName, usageCount: bump ? 1 : 0, lastUsedAt: bump ? new Date() : null },
      update: bump ? { usageCount: { increment: 1 }, lastUsedAt: new Date() } : {},
      select: { id: true },
    });
    return row.id;
  }

  async list(userId: string, type: DictionaryType, q?: string, limit = 200): Promise<DictItem[]> {
    const nq = q ? normalizeName(q) : '';
    const rows: Row[] = await this.delegate(this.prisma, type).findMany({
      where: { userId, ...(nq ? { normalizedName: { contains: nq } } : {}) },
      orderBy: [{ usageCount: 'desc' }, { lastUsedAt: { sort: 'desc', nulls: 'last' } }, { name: 'asc' }],
      take: nq ? 100 : limit,
    });
    const rank = (r: Row) => {
      if (!nq) return 0;
      if (r.normalizedName.startsWith(nq)) return 0;
      if (r.normalizedName.split(/[\s\-/()]+/).some((w) => w.startsWith(nq))) return 1;
      return 2;
    };
    return rows
      .map((r, i) => ({ r, i }))
      .sort((a, b) => rank(a.r) - rank(b.r) || a.i - b.i)
      .slice(0, limit)
      .map(({ r }) => ({
        id: r.id,
        name: r.name,
        usageCount: r.usageCount,
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        groupName: r.groupName ?? null,
      }));
  }

  async create(userId: string, type: DictionaryType, name: string) {
    const id = await this.resolve(this.prisma, userId, type, name, false);
    return this.delegate(this.prisma, type).findUnique({ where: { id } });
  }

  async update(userId: string, type: DictionaryType, id: string, data: { name?: string; groupName?: string | null }) {
    const d = this.delegate(this.prisma, type);
    const row = await d.findFirst({ where: { id, userId } });
    if (!row) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    const patch: Record<string, unknown> = {};
    if (data.name) {
      const normalizedName = normalizeName(data.name);
      const clash = await d.findFirst({ where: { userId, normalizedName, NOT: { id } } });
      if (clash) throw new AppError(HttpStatus.CONFLICT, 'DICT_DUPLICATE');
      patch.name = data.name.trim().replace(/\s+/g, ' ');
      patch.normalizedName = normalizedName;
    }
    if (type === 'positions' && data.groupName !== undefined) patch.groupName = data.groupName?.trim() || null;
    return d.update({ where: { id }, data: patch });
  }

  async remove(userId: string, type: DictionaryType, id: string) {
    const d = this.delegate(this.prisma, type);
    const row = await d.findFirst({ where: { id, userId } });
    if (!row) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND');
    if (type === 'companies' || type === 'positions') {
      const used = await this.prisma.application.count({ where: { userId, [FK[type]!]: id } });
      if (used > 0) throw new AppError(HttpStatus.CONFLICT, 'DICT_IN_USE');
    }
    await d.delete({ where: { id } });
    return { ok: true };
  }

  async merge(userId: string, type: DictionaryType, sourceIds: string[], targetId: string) {
    const ids = sourceIds.filter((i) => i !== targetId);
    return this.prisma.$transaction(async (tx) => {
      const d = this.delegate(tx, type);
      const owned = await d.count({ where: { userId, id: { in: [...ids, targetId] } } });
      if (owned !== ids.length + 1) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND');

      if (type === 'tags') {
        const links = await tx.applicationTag.findMany({ where: { tagId: { in: ids } } });
        for (const l of links) {
          await tx.applicationTag.upsert({
            where: { applicationId_tagId: { applicationId: l.applicationId, tagId: targetId } },
            create: { applicationId: l.applicationId, tagId: targetId },
            update: {},
          });
        }
        await tx.applicationTag.deleteMany({ where: { tagId: { in: ids } } });
      } else {
        const fk = FK[type]!;
        await tx.application.updateMany({ where: { userId, [fk]: { in: ids } }, data: { [fk]: targetId } });
      }
      const usage =
        type === 'tags'
          ? await tx.applicationTag.count({ where: { tagId: targetId } })
          : await tx.application.count({ where: { userId, [FK[type]!]: targetId } });
      await d.deleteMany({ where: { id: { in: ids } } });
      return d.update({ where: { id: targetId }, data: { usageCount: usage, lastUsedAt: new Date() } });
    });
  }
}
