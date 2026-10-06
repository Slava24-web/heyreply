import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { LoginInput, RegisterInput } from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppError } from '../common/errors';
import { DictionariesService } from '../dictionaries/dictionaries.service';
import { config } from '../config';
import { LoginAttempts } from './login-attempts';

/** A rotated refresh token replayed within this window is a concurrent-tab race, not theft. */
const ROTATION_GRACE_MS = 15_000;
const RESET_TTL_MS = 60 * 60_000;

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  accessMaxAgeMs: number;
  refreshMaxAgeMs: number;
}
type Meta = { userAgent: string | null; ip: string | null };

const sha256 = (v: string) => createHash('sha256').update(v).digest('hex');
const safeEqualHex = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  /** Verified against when the e-mail is unknown, so response time doesn't reveal which accounts exist. */
  private dummyHash: Promise<string> = argon2.hash(randomBytes(16).toString('hex'));

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly dictionaries: DictionariesService,
    private readonly attempts: LoginAttempts,
  ) {}

  async register(input: RegisterInput, meta: Meta) {
    const exists = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (exists) throw new AppError(HttpStatus.CONFLICT, 'EMAIL_TAKEN');
    const user = await this.prisma.user.create({
      data: { email: input.email, name: input.name, locale: input.locale ?? 'ru', passwordHash: await argon2.hash(input.password) },
    });
    await this.dictionaries.seedSystemSources(user.id, user.locale);
    return { user, tokens: await this.issue(user.id, user.email, meta) };
  }

  async login(input: LoginInput, meta: Meta) {
    if (this.attempts.isLocked(input.email, meta.ip)) throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'LOGIN_LOCKED');
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    const ok = await argon2.verify(user?.passwordHash ?? (await this.dummyHash), input.password);
    if (!user || !ok) {
      this.attempts.fail(input.email, meta.ip);
      throw new AppError(HttpStatus.UNAUTHORIZED, 'INVALID_CREDENTIALS');
    }
    this.attempts.success(input.email, meta.ip);
    if (argon2.needsRehash(user.passwordHash)) {
      await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await argon2.hash(input.password) } });
    }
    return { user, tokens: await this.issue(user.id, user.email, meta) };
  }

  /** Rotates the refresh token. Replaying a rotated token outside the grace window revokes every session of the user. */
  async refresh(raw: string | undefined, meta: Meta) {
    if (!raw) throw new AppError(HttpStatus.UNAUTHORIZED, 'NO_REFRESH');
    const [sessionId, secret] = raw.split('.');
    if (!sessionId || !secret || !/^[0-9a-f-]{36}$/.test(sessionId)) throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_REFRESH');

    const session = await this.prisma.session.findUnique({ where: { id: sessionId }, include: { user: true } });
    if (!session || !safeEqualHex(session.refreshTokenHash, sha256(secret))) throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_REFRESH');

    if (session.revokedAt) {
      if (session.rotatedAt && Date.now() - session.rotatedAt.getTime() < ROTATION_GRACE_MS) {
        // Another tab rotated this token a moment ago and the browser already holds the new cookie.
        throw new AppError(HttpStatus.CONFLICT, 'REFRESH_RACE');
      }
      await this.revokeAll(session.userId);
      this.logger.warn(`Refresh token reuse detected for user ${session.userId}; all sessions revoked`);
      throw new AppError(HttpStatus.UNAUTHORIZED, 'REFRESH_REUSED');
    }
    if (session.expiresAt < new Date()) throw new AppError(HttpStatus.UNAUTHORIZED, 'REFRESH_EXPIRED');

    const now = new Date();
    await this.prisma.session.update({ where: { id: session.id }, data: { revokedAt: now, rotatedAt: now } });
    return { user: session.user, tokens: await this.issue(session.userId, session.user.email, meta) };
  }

  /** Used by the access-token guard: a token is only valid while its session is alive. */
  async isSessionActive(sessionId: string, userId: string) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { userId: true, revokedAt: true, rotatedAt: true, expiresAt: true } });
    if (!s || s.userId !== userId || s.expiresAt < new Date()) return false;
    // A rotated session's access token stays valid until it expires; a logged-out one does not.
    return !s.revokedAt || !!s.rotatedAt;
  }

  async logout(raw: string | undefined) {
    const [sessionId, secret] = raw?.split('.') ?? [];
    if (!sessionId || !secret) return;
    const s = await this.prisma.session.findUnique({ where: { id: sessionId } });
    if (s && safeEqualHex(s.refreshTokenHash, sha256(secret))) {
      await this.prisma.session.update({ where: { id: sessionId }, data: { revokedAt: new Date(), rotatedAt: null } });
    }
  }

  async revokeAll(userId: string, exceptSessionId?: string) {
    // rotatedAt: null marks them as logged out, so their access tokens die immediately too
    await this.prisma.session.updateMany({
      where: { userId, ...(exceptSessionId ? { NOT: { id: exceptSessionId } } : {}) },
      data: { revokedAt: new Date(), rotatedAt: null },
    });
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;
    const token = randomBytes(32).toString('base64url');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { resetTokenHash: sha256(token), resetTokenExpires: new Date(Date.now() + RESET_TTL_MS) },
    });
    // No mail transport yet. The link is a credential, so it is only printed outside production.
    if (!config().isProd) this.logger.log(`[dev] Password reset link: ${config().WEB_ORIGIN}/reset-password?token=${token}`);
  }

  async resetPassword(token: string, password: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetTokenHash: sha256(token), resetTokenExpires: { gt: new Date() } },
    });
    if (!user) throw new AppError(HttpStatus.BAD_REQUEST, 'RESET_TOKEN_INVALID');
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await argon2.hash(password), resetTokenHash: null, resetTokenExpires: null },
    });
    await this.revokeAll(user.id);
  }

  async verifyPassword(userId: string, password: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, password))) throw new AppError(HttpStatus.BAD_REQUEST, 'WRONG_PASSWORD');
  }

  /** Changing the password signs out every other device. */
  async changePassword(userId: string, current: string, next: string, currentSessionId?: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await argon2.verify(user.passwordHash, current))) throw new AppError(HttpStatus.BAD_REQUEST, 'WRONG_PASSWORD');
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await argon2.hash(next), resetTokenHash: null, resetTokenExpires: null },
    });
    await this.revokeAll(userId, currentSessionId);
  }

  private async issue(userId: string, email: string, meta: Meta): Promise<IssuedTokens> {
    const cfg = config();
    const refreshTtlMs = cfg.REFRESH_TTL_DAYS * 86_400_000;
    // Housekeeping: drop this user's dead sessions so IP/user-agent history isn't kept forever
    await this.prisma.session.deleteMany({
      where: { userId, OR: [{ expiresAt: { lt: new Date() } }, { revokedAt: { lt: new Date(Date.now() - 7 * 86_400_000) } }] },
    });
    const secret = randomBytes(48).toString('base64url');
    const session = await this.prisma.session.create({
      data: { userId, refreshTokenHash: sha256(secret), userAgent: meta.userAgent, ip: meta.ip, expiresAt: new Date(Date.now() + refreshTtlMs) },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, sid: session.id },
      { secret: cfg.JWT_ACCESS_SECRET, expiresIn: cfg.ACCESS_TTL_SECONDS, algorithm: 'HS256' },
    );
    return { accessToken, refreshToken: `${session.id}.${secret}`, accessMaxAgeMs: cfg.ACCESS_TTL_SECONDS * 1000, refreshMaxAgeMs: refreshTtlMs };
  }
}
