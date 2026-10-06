import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import type { ApiTokenDto } from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../common/errors';

const PREFIX = 'otk_';
const MAX_TOKENS = 10;
const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');

@Injectable()
export class TokensService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<ApiTokenDto[]> {
    const rows = await this.prisma.apiToken.findMany({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    return rows.map((t) => ({ id: t.id, name: t.name, prefix: t.prefix, lastUsedAt: t.lastUsedAt?.toISOString() ?? null, createdAt: t.createdAt.toISOString() }));
  }

  /** Returns the plain token exactly once; only its hash is stored. */
  async create(userId: string, name: string) {
    const active = await this.prisma.apiToken.count({ where: { userId, revokedAt: null } });
    if (active >= MAX_TOKENS) throw new AppError(HttpStatus.BAD_REQUEST, 'TOO_MANY_TOKENS');
    const token = PREFIX + randomBytes(32).toString('base64url');
    const row = await this.prisma.apiToken.create({ data: { userId, name, tokenHash: sha256(token), prefix: token.slice(0, PREFIX.length + 6) } });
    return { token, id: row.id, name: row.name, prefix: row.prefix, createdAt: row.createdAt.toISOString(), lastUsedAt: null };
  }

  async revoke(userId: string, id: string) {
    await this.prisma.apiToken.updateMany({ where: { id, userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async resolve(token: string): Promise<{ userId: string; tokenId: string } | null> {
    if (!token.startsWith(PREFIX) || token.length > 100) return null;
    const row = await this.prisma.apiToken.findUnique({ where: { tokenHash: sha256(token) }, select: { id: true, userId: true, revokedAt: true, lastUsedAt: true } });
    if (!row || row.revokedAt) return null;
    // Throttle the write: one update per minute is plenty for "last used"
    if (!row.lastUsedAt || Date.now() - row.lastUsedAt.getTime() > 60_000) {
      await this.prisma.apiToken.update({ where: { id: row.id }, data: { lastUsedAt: new Date() } });
    }
    return { userId: row.userId, tokenId: row.id };
  }
}
