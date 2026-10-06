import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Res } from '@nestjs/common';
import type { Response } from 'express';
import { changePasswordSchema, updateProfileSchema, type UpdateProfileInput } from '@heyreply/shared';
import { z } from 'zod';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { toUserDto } from './users.mapper';
import { clearAuthCookies } from '../auth/cookies';
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

  @Get('export')
  async export(@CurrentUser() user: AuthUser, @Res() res: Response) {
    const profile = toUserDto(await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } }));
    const applications = await this.applications.exportAll(user.id);
    res.setHeader('Content-Disposition', 'attachment; filename="heyreply-export.json"');
    res.json({ exportedAt: new Date().toISOString(), profile, applications });
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
