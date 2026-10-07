import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { z } from 'zod';
import {
  bulkActionSchema,
  changeStatusSchema,
  createApplicationSchema,
  listApplicationsQuerySchema,
  updateApplicationSchema,
  type BulkActionInput,
  type ChangeStatusInput,
  type CreateApplicationInput,
  type ListApplicationsQuery,
  type UpdateApplicationInput,
} from '@heyreply/shared';
import { ApplicationsService } from './applications.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';

const dupQuery = z.object({ companyName: z.string().min(1), positionName: z.string().min(1) });
const exportQuery = listApplicationsQuerySchema.extend({ fileFormat: z.enum(['csv', 'json']).default('csv') });

@Controller('applications')
export class ApplicationsController {
  constructor(private readonly apps: ApplicationsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query(new ZodPipe(listApplicationsQuerySchema)) q: ListApplicationsQuery) {
    return this.apps.list(u.id, q);
  }

  @Get('duplicates')
  duplicates(@CurrentUser() u: AuthUser, @Query(new ZodPipe(dupQuery)) q: z.infer<typeof dupQuery>) {
    return this.apps.duplicates(u.id, q.companyName, q.positionName);
  }

  @Get('last')
  last(@CurrentUser() u: AuthUser) {
    return this.apps.last(u.id);
  }

  @Get('export')
  async export(@CurrentUser() u: AuthUser, @Query(new ZodPipe(exportQuery)) q: z.infer<typeof exportQuery>, @Res() res: Response) {
    const items = await this.apps.exportAll(u.id, q);
    const stamp = new Date().toISOString().slice(0, 10);
    if (q.fileFormat === 'json') {
      res.setHeader('Content-Disposition', `attachment; filename="heyreply-${stamp}.json"`);
      res.json(items);
      return;
    }
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="heyreply-${stamp}.csv"`);
    res.send(this.apps.toCsv(items, await this.apps.csvLocale(u.id)));
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body(new ZodPipe(createApplicationSchema)) body: CreateApplicationInput) {
    return this.apps.create(u.id, body);
  }

  @Post('bulk')
  bulk(@CurrentUser() u: AuthUser, @Body(new ZodPipe(bulkActionSchema)) body: BulkActionInput) {
    return this.apps.bulk(u.id, body);
  }

  @Get(':id')
  get(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.get(u.id, id);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(updateApplicationSchema)) body: UpdateApplicationInput) {
    return this.apps.update(u.id, id, body);
  }

  @Post(':id/status')
  status(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(changeStatusSchema)) body: ChangeStatusInput) {
    return this.apps.changeStatus(u.id, id, body);
  }

  @Post(':id/restore')
  restore(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.restore(u.id, id);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.apps.remove(u.id, id);
  }
}
