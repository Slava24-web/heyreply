import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { TokensService } from './tokens.service';

/** Authenticates integration requests by a personal API token (`Authorization: Bearer otk_…`). Cookies are ignored. */
@Injectable()
export class ApiTokenGuard implements CanActivate {
  constructor(private readonly tokens: TokensService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user?: unknown }>();
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
    const hit = token ? await this.tokens.resolve(token) : null;
    if (!hit) throw new UnauthorizedException({ code: 'BAD_API_TOKEN', message: 'Invalid or revoked API token' });
    req.user = { id: hit.userId, email: '', sessionId: '', tokenId: hit.tokenId };
    return true;
  }
}
