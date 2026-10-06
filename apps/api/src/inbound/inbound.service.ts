import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PLATFORM_PATTERNS, platformByMailDomain } from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../common/errors';
import { config } from '../config';
import { ImportService } from '../integrations/import.service';
import { DkimVerifier } from './dkim';
import { detectConfirmation, extractApplication, isProviderSender, readMail } from './mail-parser';

const JOURNAL_LIMIT = 200;
const JOURNAL_DAYS = 90;
const sha256 = (v: string | Buffer) => createHash('sha256').update(v).digest('hex');

export type InboundKind = 'application' | 'confirmation' | 'unrecognized' | 'unverified' | 'ignored' | 'duplicate';

@Injectable()
export class InboundService {
  private readonly logger = new Logger(InboundService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly importer: ImportService,
    private readonly dkim: DkimVerifier,
  ) {}

  get domain() {
    return config().INBOUND_EMAIL_DOMAIN ?? null;
  }

  async overview(userId: string) {
    const address = await this.prisma.inboundAddress.findFirst({ where: { userId, revokedAt: null }, orderBy: { createdAt: 'desc' } });
    const recent = await this.prisma.inboundEmail.findMany({ where: { userId }, orderBy: { receivedAt: 'desc' }, take: 20 });
    const pending = recent.find((e) => e.kind === 'confirmation');
    return {
      enabled: !!this.domain,
      address: address && this.domain ? `${address.localPart}@${this.domain}` : null,
      createdAt: address?.createdAt ?? null,
      // Offer the confirmation only until real board mail starts arriving after it
      confirmation:
        pending && !recent.some((e) => e.kind === 'application' && e.receivedAt > pending.receivedAt)
          ? { url: pending.confirmUrl, code: pending.confirmCode, receivedAt: pending.receivedAt, from: pending.fromAddress }
          : null,
      recent: recent.map((e) => ({ id: e.id, from: e.fromAddress, subject: e.subject, platform: e.platform, kind: e.kind, outcome: e.outcome, receivedAt: e.receivedAt })),
      senders: Object.values(PLATFORM_PATTERNS).flatMap((p) => p.mailDomains),
    };
  }

  /** Creates (or replaces) the forwarding address. 128 bits of randomness: the address itself is the secret. */
  async rotate(userId: string) {
    if (!this.domain) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'INBOUND_DISABLED');
    await this.prisma.inboundAddress.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    // hex keeps all 128 bits and is safe for case-insensitive mail systems
    const localPart = 'in-' + randomBytes(16).toString('hex');
    await this.prisma.inboundAddress.create({ data: { userId, localPart } });
    return this.overview(userId);
  }

  async disable(userId: string) {
    await this.prisma.inboundAddress.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  /** Called for every e-mail delivered by the Cloudflare Email Worker. */
  async process(to: string, raw: Buffer): Promise<{ kind: InboundKind; outcome?: string }> {
    const [local, domain] = to.trim().toLowerCase().split('@');
    if (!this.domain || domain !== this.domain) throw new AppError(HttpStatus.NOT_FOUND, 'UNKNOWN_RECIPIENT');
    const address = await this.prisma.inboundAddress.findUnique({ where: { localPart: local.split('+')[0] } });
    if (!address || address.revokedAt) throw new AppError(HttpStatus.NOT_FOUND, 'UNKNOWN_RECIPIENT');
    const userId = address.userId;

    const mail = await readMail(raw);
    const messageIdHash = sha256(mail.messageId ?? raw);
    if (await this.prisma.inboundEmail.findUnique({ where: { userId_messageIdHash: { userId, messageIdHash } } })) return { kind: 'duplicate' };

    const log = async (kind: InboundKind, extra: { platform?: string; outcome?: string; confirmUrl?: string | null; confirmCode?: string | null } = {}) => {
      await this.prisma.inboundEmail.create({
        data: { userId, messageIdHash, fromAddress: mail.fromAddress.slice(0, 200), subject: mail.subject.slice(0, 200), kind, ...extra },
      });
      await this.prune(userId);
      return { kind, outcome: extra.outcome };
    };
    const requireDkim = config().INBOUND_REQUIRE_DKIM === 'true';

    if (isProviderSender(mail.fromDomain)) {
      const confirmation = detectConfirmation(mail);
      if (!confirmation) return log('ignored');
      // A forged "confirmation" could smuggle a phishing link into our UI — require the provider's signature
      if (requireDkim && !(await this.dkim.signedBy(raw, [mail.fromDomain.split('.').slice(-2).join('.')]))) return log('unverified');
      return log('confirmation', { confirmUrl: confirmation.url, confirmCode: confirmation.code });
    }

    const platform = platformByMailDomain(mail.fromDomain);
    if (!platform) return log('ignored');
    if (requireDkim && !(await this.dkim.signedBy(raw, PLATFORM_PATTERNS[platform].mailDomains))) {
      this.logger.warn(`Unverified ${platform} e-mail for user ${userId}`);
      return log('unverified', { platform });
    }

    const item = extractApplication(mail, platform);
    if (!item) return log('unrecognized', { platform });
    const result = await this.importer.importBatch(userId, [item]);
    return log('application', { platform, outcome: result.items[0] });
  }

  private async prune(userId: string) {
    await this.prisma.inboundEmail.deleteMany({ where: { userId, receivedAt: { lt: new Date(Date.now() - JOURNAL_DAYS * 86_400_000) } } });
    const old = await this.prisma.inboundEmail.findMany({ where: { userId }, orderBy: { receivedAt: 'desc' }, skip: JOURNAL_LIMIT, select: { id: true } });
    if (old.length) await this.prisma.inboundEmail.deleteMany({ where: { id: { in: old.map((o) => o.id) } } });
  }
}
