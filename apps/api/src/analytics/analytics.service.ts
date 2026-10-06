import { Injectable } from '@nestjs/common';
import { WAITING_STATUSES, type AnalyticsQuery, type SummaryDto } from '@heyreply/shared';
import { PrismaService } from '../prisma/prisma.service';
import { applicationInclude, toApplicationDto } from '../applications/applications.mapper';
import * as m from './metrics';

const DAY = 86_400_000;

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  private async rows(userId: string, from?: Date, to?: Date): Promise<m.MetricRow[]> {
    return this.prisma.application.findMany({
      where: {
        userId,
        deletedAt: null,
        ...(from || to ? { appliedAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      select: {
        appliedAt: true,
        status: true,
        maxStage: true,
        firstResponseAt: true,
        coverLetter: true,
        workFormat: true,
        salaryFrom: true,
        salaryTo: true,
        currency: true,
        offerAmount: true,
        source: { select: { id: true, name: true } },
        position: { select: { id: true, name: true, groupName: true } },
        location: { select: { id: true, name: true } },
        company: { select: { name: true } },
      },
    });
  }

  private async ghostingDays(userId: string) {
    return (await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { ghostingDays: true } })).ghostingDays;
  }

  async summary(userId: string, q: AnalyticsQuery): Promise<SummaryDto> {
    const gd = await this.ghostingDays(userId);
    const current = m.summary(await this.rows(userId, q.from, q.to), gd);
    let previous: SummaryDto['previous'] = null;
    if (q.from) {
      const to = q.to ?? new Date();
      const len = to.getTime() - q.from.getTime();
      const prevRows = await this.rows(userId, new Date(q.from.getTime() - len), new Date(q.from.getTime() - 1));
      previous = prevRows.length ? m.summary(prevRows, gd) : null;
    }
    return { ...current, previous };
  }

  async funnel(userId: string, q: AnalyticsQuery) {
    const rows = await this.rows(userId, q.from, q.to);
    return { stages: m.funnel(rows), statuses: m.statusDistribution(rows) };
  }

  async timeline(userId: string, q: AnalyticsQuery) {
    return m.timeline(await this.rows(userId, q.from, q.to), q.from, q.to);
  }

  async heatmap(userId: string) {
    const now = new Date();
    return m.heatmap(await this.rows(userId, new Date(now.getTime() - 364 * DAY)), now);
  }

  async bySource(userId: string, q: AnalyticsQuery) {
    return m.segment(await this.rows(userId, q.from, q.to), (r) => (r.source ? { key: r.source.id, label: r.source.name } : null));
  }

  async byPosition(userId: string, q: AnalyticsQuery) {
    return m.segment(await this.rows(userId, q.from, q.to), (r) =>
      r.position.groupName ? { key: 'g:' + r.position.groupName, label: r.position.groupName } : { key: r.position.id, label: r.position.name },
    );
  }

  async byLocation(userId: string, q: AnalyticsQuery) {
    const rows = await this.rows(userId, q.from, q.to);
    return {
      locations: m.segment(rows, (r) => (r.location ? { key: r.location.id, label: r.location.name } : null)),
      formats: m.segment(rows, (r) => (r.workFormat ? { key: r.workFormat, label: r.workFormat } : null)),
    };
  }

  async salary(userId: string, q: AnalyticsQuery) {
    return m.salary(await this.rows(userId, q.from, q.to), q.currency, q.bucket);
  }

  async insights(userId: string, q: AnalyticsQuery) {
    return m.insights(await this.rows(userId, q.from, q.to), await this.ghostingDays(userId));
  }

  async attention(userId: string) {
    const gd = await this.ghostingDays(userId);
    const now = new Date();
    const [upcoming, waiting] = await Promise.all([
      this.prisma.application.findMany({
        where: { userId, deletedAt: null, nextStepAt: { gte: new Date(now.getTime() - DAY) } },
        include: applicationInclude,
        orderBy: { nextStepAt: 'asc' },
        take: 5,
      }),
      this.prisma.application.findMany({
        where: { userId, deletedAt: null, archivedAt: null, status: { in: WAITING_STATUSES }, appliedAt: { lt: new Date(now.getTime() - gd * DAY) } },
        include: applicationInclude,
        orderBy: { appliedAt: 'asc' },
        take: 50,
      }),
    ]);
    return { upcoming: upcoming.map(toApplicationDto), waiting: waiting.map(toApplicationDto), ghostingDays: gd };
  }
}
