import { Body, Controller, HttpCode, Post, Req, Res } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { loginSchema, registerSchema, type LoginInput, type RegisterInput } from '@heyreply/shared';
import { AuthService } from './auth.service';
import { clearAuthCookies, setAuthCookies } from './cookies';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { clientMeta } from '../common/http';
import { toUserDto } from '../users/users.mapper';

const forgotSchema = z.object({ email: z.string().trim().toLowerCase().email() });
const resetSchema = z.object({ token: z.string().min(10), password: registerSchema.shape.password });

@Throttle({ default: { ttl: 60_000, limit: 10 } })
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  async register(@Body(new ZodPipe(registerSchema)) body: RegisterInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.register(body, clientMeta(req));
    setAuthCookies(res, tokens);
    return { user: toUserDto(user) };
  }

  @Public()
  @HttpCode(200)
  @Post('login')
  async login(@Body(new ZodPipe(loginSchema)) body: LoginInput, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { user, tokens } = await this.auth.login(body, clientMeta(req));
    setAuthCookies(res, tokens);
    return { user: toUserDto(user) };
  }

  @Public()
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(200)
  @Post('refresh')
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    try {
      const { user, tokens } = await this.auth.refresh(req.cookies?.refresh_token, clientMeta(req));
      setAuthCookies(res, tokens);
      return { user: toUserDto(user) };
    } catch (e) {
      clearAuthCookies(res);
      throw e;
    }
  }

  // Logout only clears cookies/revokes; it must work even when a client has hit the auth rate limit
  @Public()
  @SkipThrottle()
  @HttpCode(200)
  @Post('logout')
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.refresh_token);
    clearAuthCookies(res);
    return { ok: true };
  }

  @HttpCode(200)
  @Post('logout-all')
  async logoutAll(@CurrentUser() user: AuthUser, @Res({ passthrough: true }) res: Response) {
    await this.auth.revokeAll(user.id);
    clearAuthCookies(res);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('forgot-password')
  async forgot(@Body(new ZodPipe(forgotSchema)) body: z.infer<typeof forgotSchema>) {
    await this.auth.forgotPassword(body.email);
    return { ok: true };
  }

  @Public()
  @HttpCode(200)
  @Post('reset-password')
  async reset(@Body(new ZodPipe(resetSchema)) body: z.infer<typeof resetSchema>) {
    await this.auth.resetPassword(body.token, body.password);
    return { ok: true };
  }
}
