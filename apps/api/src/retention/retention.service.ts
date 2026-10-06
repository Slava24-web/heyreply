import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { config } from '../config';

const DAY = 86_400_000;
/** Retention periods promised in the privacy policy (section 9) */
export const RETENTION = {
  deletedApplicationsDays: 30,
  deadSessionsDays: 7,
  inboundJournalDays: 90,
  revokedCredentialsDays: 30,
} as const;

const BATCH = 500;
const EVERY_MS = 6 * 3_600_000;

/** Permanently removes what the privacy policy says we don't keep. Idempotent, so running it on several instances is harmless. */
@Injectable()
export class RetentionService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RetentionService.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    if (config().NODE_ENV === 'test') return;
    const safeRun = () => this.run().catch((e) => this.logger.error(`Retention run failed: ${e instanceof Error ? e.message : e}`));
    this.timers.push(setTimeout(safeRun, 60_000).unref(), setInterval(safeRun, EVERY_MS).unref());
  }

  onModuleDestroy() {
    this.timers.forEach(clearTimeout);
  }

  async run(now = new Date()) {
    const ago = (days: number) => new Date(now.getTime() - days * DAY);
    const applications = await this.purgeDeletedApplications(ago(RETENTION.deletedApplicationsDays));
    const sessions = (
      await this.prisma.session.deleteMany({ where: { OR: [{ expiresAt: { lt: now } }, { revokedAt: { lt: ago(RETENTION.deadSessionsDays) } }] } })
    ).count;
    const inboundEmails = (await this.prisma.inboundEmail.deleteMany({ where: { receivedAt: { lt: ago(RETENTION.inboundJournalDays) } } })).count;
    const apiTokens = (await this.prisma.apiToken.deleteMany({ where: { revokedAt: { lt: ago(RETENTION.revokedCredentialsDays) } } })).count;
    const inboundAddresses = (await this.prisma.inboundAddress.deleteMany({ where: { revokedAt: { lt: ago(RETENTION.revokedCredentialsDays) } } })).count;
    const resetTokens = (
      await this.prisma.user.updateMany({ where: { resetTokenHash: { not: null }, resetTokenExpires: { lt: now } }, data: { resetTokenHash: null, resetTokenExpires: null } })
    ).count;
    const result = { applications, sessions, inboundEmails, apiTokens, inboundAddresses, resetTokens };
    if (Object.values(result).some(Boolean)) this.logger.log(`Retention: ${JSON.stringify(result)}`);
    return result;
  }

  private async purgeDeletedApplications(cutoff: Date) {
    let total = 0;
    for (;;) {
      const batch = await this.prisma.application.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true, userId: true, externalSource: true, externalId: true },
        take: BATCH,
      });
      if (!batch.length) return total;
      await this.prisma.$transaction([
        this.prisma.deletedImport.createMany({
          data: batch.flatMap((a) => (a.externalSource && a.externalId ? [{ userId: a.userId, externalSource: a.externalSource, externalId: a.externalId }] : [])),
          skipDuplicates: true,
        }),
        // Status history and tag links go with it (onDelete: Cascade)
        this.prisma.application.deleteMany({ where: { id: { in: batch.map((a) => a.id) } } }),
      ]);
      total += batch.length;
    }
  }
}
