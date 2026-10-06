import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { IS_PUBLIC } from '../common/decorators';
import { config } from '../config';
import { AuthService } from './auth.service';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly auth: AuthService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = req.headers.authorization;
    const token = req.cookies?.access_token ?? (header?.startsWith('Bearer ') ? header.slice(7) : undefined);
    if (!token) throw new UnauthorizedException({ code: 'UNAUTHORIZED', message: 'Missing access token' });

    let payload: { sub: string; email: string; sid: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: config().JWT_ACCESS_SECRET, algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedException({ code: 'TOKEN_EXPIRED', message: 'Invalid or expired access token' });
    }
    // Logout, "sign out everywhere", password change/reset and account deletion take effect immediately
    if (!payload.sid || !(await this.auth.isSessionActive(payload.sid, payload.sub))) {
      throw new UnauthorizedException({ code: 'SESSION_REVOKED', message: 'Session has ended' });
    }
    req.user = { id: payload.sub, email: payload.email, sessionId: payload.sid };
    return true;
  }
}
