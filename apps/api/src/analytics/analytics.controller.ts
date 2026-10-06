import { Controller, Get, Query } from '@nestjs/common';
import { analyticsQuerySchema, type AnalyticsQuery } from '@heyreply/shared';
import { AnalyticsService } from './analytics.service';
import { CurrentUser, type AuthUser } from '../common/decorators';
import { ZodPipe } from '../common/zod.pipe';

const pipe = new ZodPipe(analyticsQuerySchema);

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('summary')
  summary(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.summary(u.id, q);
  }

  @Get('funnel')
  funnel(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.funnel(u.id, q);
  }

  @Get('timeline')
  timeline(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.timeline(u.id, q);
  }

  @Get('heatmap')
  heatmap(@CurrentUser() u: AuthUser) {
    return this.analytics.heatmap(u.id);
  }

  @Get('by-source')
  bySource(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.bySource(u.id, q);
  }

  @Get('by-position')
  byPosition(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.byPosition(u.id, q);
  }

  @Get('by-location')
  byLocation(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.byLocation(u.id, q);
  }

  @Get('salary')
  salary(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.salary(u.id, q);
  }

  @Get('insights')
  insights(@CurrentUser() u: AuthUser, @Query(pipe) q: AnalyticsQuery) {
    return this.analytics.insights(u.id, q);
  }

  @Get('attention')
  attention(@CurrentUser() u: AuthUser) {
    return this.analytics.attention(u.id);
  }
}
