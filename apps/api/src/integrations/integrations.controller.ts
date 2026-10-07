import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { createTokenSchema, importBatchSchema, manualImportSchema, type ImportBatch, type ManualImport } from '@heyreply/shared';
import { z } from 'zod';
import { CurrentUser, Public, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';
import { PrismaService } from '../prisma/prisma.service';
import { ImportService } from './import.service';
import { ApiTokenGuard } from './token.guard';
import { TokensService } from './tokens.service';

/** Token management for the signed-in user (cookie session). */
@Controller('me/tokens')
export class TokensController {
  constructor(private readonly tokens: TokensService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.tokens.list(u.id);
  }

  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @Post()
  create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(createTokenSchema)) body: z.infer<typeof createTokenSchema>) {
    return this.tokens.create(u.id, body.name);
  }

  @Delete(':id')
  async revoke(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    await this.tokens.revoke(u.id, id);
    return { ok: true };
  }
}

/** Endpoints called by the browser extension with a personal API token. */
@Public()
@UseGuards(ApiTokenGuard)
@Controller('import')
export class ImportController {
  constructor(
    private readonly importer: ImportService,
    private readonly prisma: PrismaService,
  ) {}

  /** Lets the extension verify its token and show whose account it is connected to. Public + token lookup in the DB, so it is throttled too. */
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @Get('ping')
  async ping(@CurrentUser() u: AuthUser) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { name: true, email: true, locale: true } });
    return { ok: true, user };
  }

  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @HttpCode(200)
  @Post('applications')
  importApplications(@CurrentUser() u: AuthUser, @Body(new ZodPipe(importBatchSchema)) body: ImportBatch) {
    return this.importer.importBatch(u.id, body.items);
  }

  /** One application added by hand from the extension popup on a page without a board adapter. */
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @HttpCode(200)
  @Post('manual')
  importManual(@CurrentUser() u: AuthUser, @Body(new ZodPipe(manualImportSchema)) body: ManualImport) {
    return this.importer.importManual(u.id, body);
  }
}
