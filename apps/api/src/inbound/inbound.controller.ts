import { Body, Controller, Delete, Get, Headers, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { AppError } from '../common/errors';
import { ZodPipe } from '../common/zod.pipe';
import { config } from '../config';
import { InboundService } from './inbound.service';
import { verifyInbound } from './signature';

const MAX_RAW_BYTES = 1_500_000;
const webhookSchema = z.object({
  to: z.string().trim().max(320),
  from: z.string().trim().max(320).optional(),
  raw: z.string().min(1).max(Math.ceil((MAX_RAW_BYTES * 4) / 3) + 4),
});

@Controller('me/inbound')
export class InboundSettingsController {
  constructor(private readonly inbound: InboundService) {}

  @Get()
  overview(@CurrentUser() u: AuthUser) {
    return this.inbound.overview(u.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  rotate(@CurrentUser() u: AuthUser) {
    return this.inbound.rotate(u.id);
  }

  @Delete()
  async disable(@CurrentUser() u: AuthUser) {
    await this.inbound.disable(u.id);
    return { ok: true };
  }
}

/** Webhook for the Cloudflare Email Worker. Authenticated by an HMAC signature, not by a user session. */
@Public()
@Controller('inbound')
export class InboundWebhookController {
  constructor(private readonly inbound: InboundService) {}

  @Throttle({ default: { ttl: 60_000, limit: 300 } })
  @HttpCode(200)
  @Post('email')
  async email(
    @Headers('x-heyreply-timestamp') ts: string | undefined,
    @Headers('x-heyreply-signature') sig: string | undefined,
    @Body(new ZodPipe(webhookSchema)) body: z.infer<typeof webhookSchema>,
  ) {
    const secret = config().INBOUND_SECRET;
    if (!secret || !config().INBOUND_EMAIL_DOMAIN) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'INBOUND_DISABLED');
    if (!verifyInbound(secret, ts, sig, body.to, body.raw)) throw new AppError(HttpStatus.UNAUTHORIZED, 'BAD_SIGNATURE');
    const raw = Buffer.from(body.raw, 'base64');
    if (raw.length > MAX_RAW_BYTES) throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'TOO_LARGE');
    return this.inbound.process(body.to, raw);
  }
}
