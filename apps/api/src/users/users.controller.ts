import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { LEGAL_VERSION, changePasswordSchema, consentSchema, updateProfileSchema, type UpdateProfileInput } from '@heyreply/shared';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { toUserDto } from './users.mapper';
import { clearAuthCookies } from '../auth/cookies';
import { clientMeta } from '../common/http';
import { ApplicationsService } from '../applications/applications.service';

@Controller('me')
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
    private readonly applications: ApplicationsService,
  ) {}

  @Get()
  async me(@CurrentUser() user: AuthUser) {
    return toUserDto(await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
  }

  @Patch()
  async update(@CurrentUser() user: AuthUser, @Body(new ZodPipe(updateProfileSchema)) body: UpdateProfileInput) {
    return toUserDto(await this.prisma.user.update({ where: { id: user.id }, data: body }));
  }

  /** Existing accounts accept the legal documents here (new ones do it at registration). */
  @HttpCode(200)
  @Post('consent')
  async consent(@CurrentUser() user: AuthUser, @Body(new ZodPipe(consentSchema)) _body: z.infer<typeof consentSchema>, @Req() req: Request) {
    const updated = await this.prisma.user.update({
      where: { id: user.id },
      data: { termsAcceptedAt: new Date(), termsVersion: LEGAL_VERSION, termsAcceptedIp: clientMeta(req).ip },
    });
    return toUserDto(updated);
  }

  @HttpCode(200)
  @Patch('password')
  async password(@CurrentUser() user: AuthUser, @Body(new ZodPipe(changePasswordSchema)) body: z.infer<typeof changePasswordSchema>) {
    await this.auth.changePassword(user.id, body.currentPassword, body.newPassword, user.sessionId);
    return { ok: true };
  }

  @Get('sessions')
  async sessions(@CurrentUser() user: AuthUser) {
    const current = user.sessionId;
    const rows = await this.prisma.session.findMany({
      where: { userId: user.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      userAgent: s.userAgent,
      ip: s.ip,
      createdAt: s.createdAt,
      current: s.id === current,
    }));
  }

  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.prisma.session.updateMany({ where: { id, userId: user.id }, data: { revokedAt: new Date() } });
    return { ok: true };
  }

  /** GDPR art. 15/20 and 152-FZ art. 14: every category of personal data we hold about the user, not only the applications. */
  @Get('export')
  async export(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const userId = user.id;
    const row = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const [applications, sessions, apiTokens, inboundAddresses, inboundEmails, companies, positions, locations, sources, tags] = await Promise.all([
      this.applications.exportEverything(userId),
      this.prisma.session.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.apiToken.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.inboundAddress.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.inboundEmail.findMany({ where: { userId }, orderBy: { receivedAt: 'desc' } }),
      this.prisma.company.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.position.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.location.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.source.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
      this.prisma.tag.findMany({ where: { userId }, orderBy: { name: 'asc' } }),
    ]);
    const iso = (d: Date | null) => d?.toISOString() ?? null;
    res.setHeader('Content-Disposition', 'attachment; filename="heyreply-export.json"');
    res.json({
      exportedAt: new Date().toISOString(),
      profile: toUserDto(row),
      consent: { acceptedAt: iso(row.termsAcceptedAt), documentsVersion: row.termsVersion, ip: row.termsAcceptedIp },
      applications,
      dictionaries: {
        companies: companies.map((c) => ({ name: c.name, website: c.website })),
        positions: positions.map((p) => ({ name: p.name, group: p.groupName })),
        locations: locations.map((l) => ({ name: l.name, country: l.country })),
        sources: sources.map((s) => ({ name: s.name, domain: s.domain })),
        tags: tags.map((t) => ({ name: t.name })),
      },
      // Hashes of credentials are left out on purpose: they are secrets, not information about you
      sessions: sessions.map((s) => ({ userAgent: s.userAgent, ip: s.ip, createdAt: iso(s.createdAt), lastUsedAt: iso(s.lastUsedAt), expiresAt: iso(s.expiresAt), revokedAt: iso(s.revokedAt) })),
      integrationTokens: apiTokens.map((t) => ({ name: t.name, prefix: t.prefix, createdAt: iso(t.createdAt), lastUsedAt: iso(t.lastUsedAt), revokedAt: iso(t.revokedAt) })),
      emailImport: {
        addresses: inboundAddresses.map((a) => ({ createdAt: iso(a.createdAt), revokedAt: iso(a.revokedAt) })),
        journal: inboundEmails.map((e) => ({ from: e.fromAddress, subject: e.subject, platform: e.platform, kind: e.kind, outcome: e.outcome, receivedAt: iso(e.receivedAt) })),
      },
    });
  }

  /** Irreversible, so it requires the current password even with a valid session. */
  @Delete()
  async remove(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(z.object({ password: z.string().min(1).max(128) }))) body: { password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.auth.verifyPassword(user.id, body.password);
    await this.prisma.user.delete({ where: { id: user.id } });
    clearAuthCookies(res);
    return { ok: true };
  }
}
