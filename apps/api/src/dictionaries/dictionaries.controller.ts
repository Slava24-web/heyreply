import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Query } from '@nestjs/common';
import { z } from 'zod';
import { DICTIONARY_TYPES, dictionaryCreateSchema, dictionaryMergeSchema, dictionaryUpdateSchema, type DictionaryType } from '@heyreply/shared';
import { DictionariesService } from './dictionaries.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';

const typePipe = new ZodPipe(z.enum(DICTIONARY_TYPES));
const listQuery = z.object({ q: z.string().max(160).optional(), limit: z.coerce.number().int().min(1).max(500).default(200) });

@Controller('dictionaries')
export class DictionariesController {
  constructor(private readonly dict: DictionariesService) {}

  @Get(':type')
  list(@CurrentUser() u: AuthUser, @Param('type', typePipe) type: DictionaryType, @Query(new ZodPipe(listQuery)) q: z.infer<typeof listQuery>) {
    return this.dict.list(u.id, type, q.q, q.limit);
  }

  @Post(':type')
  create(@CurrentUser() u: AuthUser, @Param('type', typePipe) type: DictionaryType, @Body(new ZodPipe(dictionaryCreateSchema)) body: { name: string }) {
    return this.dict.create(u.id, type, body.name);
  }

  @Post(':type/merge')
  merge(
    @CurrentUser() u: AuthUser,
    @Param('type', typePipe) type: DictionaryType,
    @Body(new ZodPipe(dictionaryMergeSchema)) body: z.infer<typeof dictionaryMergeSchema>,
  ) {
    return this.dict.merge(u.id, type, body.sourceIds, body.targetId);
  }

  @Patch(':type/:id')
  update(
    @CurrentUser() u: AuthUser,
    @Param('type', typePipe) type: DictionaryType,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(dictionaryUpdateSchema)) body: z.infer<typeof dictionaryUpdateSchema>,
  ) {
    return this.dict.update(u.id, type, id, body);
  }

  @Delete(':type/:id')
  remove(@CurrentUser() u: AuthUser, @Param('type', typePipe) type: DictionaryType, @Param('id', ParseUUIDPipe) id: string) {
    return this.dict.remove(u.id, type, id);
  }
}
