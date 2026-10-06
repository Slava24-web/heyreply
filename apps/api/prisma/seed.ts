/**
 * Demo data: one user with ~150 applications over the last 6 months.
 * Login: demo@heyreply.dev / demo12345 (local development only).
 */
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { normalizeName, SYSTEM_SOURCES, systemSourceName, STATUS_STAGE, type AppStatus } from '@heyreply/shared';
import { PrismaClient } from '../src/generated/prisma/client';
import { applyTransition } from '../src/applications/status.logic';

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });

const DEMO_EMAIL = 'demo@heyreply.dev';
const DEMO_PASSWORD = 'demo12345';

let seed = 42;
const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const pick = <T>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const DAY = 86_400_000;

const companies = [
  'Яндекс', 'Ozon', 'Тинькофф', 'Avito', 'Wildberries', 'Сбер', 'VK', 'Kaspersky', 'Skyeng', 'Lamoda',
  'Купер', 'HeadHunter', 'Контур', 'Positive Technologies', 'Ozon Fintech', 'Самокат', 'Альфа-Банк', 'Joom',
  'Miro', 'JetBrains', 'Wrike', 'Revolut', 'Playrix', 'inDrive', 'Т-Банк', 'МТС', 'Билайн', '2ГИС', 'Додо',
];
const positions = [
  { name: 'Frontend Developer', group: 'Frontend' },
  { name: 'Frontend-разработчик', group: 'Frontend' },
  { name: 'Senior Frontend Engineer', group: 'Frontend' },
  { name: 'React Developer', group: 'Frontend' },
  { name: 'Fullstack Developer', group: 'Fullstack' },
  { name: 'Node.js Developer', group: 'Backend' },
  { name: 'Team Lead Frontend', group: 'Lead' },
];
const locations = ['Москва', 'Санкт-Петербург', 'Казань', 'Новосибирск', 'Белград', 'Алматы', 'Ереван'];
const sources = ['HeadHunter', 'LinkedIn', 'Хабр Карьера', 'Telegram', 'Сайт компании', 'Рекомендация', 'Getmatch'];
// Different sources have different "quality" to make insights visible
const sourceBoost: Record<string, number> = {
  HeadHunter: 0.8, LinkedIn: 1.2, 'Хабр Карьера': 1.1, Telegram: 1.0, 'Сайт компании': 0.9, Рекомендация: 2.2, Getmatch: 1.3,
};

async function main() {
  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const user = await prisma.user.create({
    data: { email: DEMO_EMAIL, name: 'Демо Пользователь', passwordHash: await argon2.hash(DEMO_PASSWORD) },
  });
  const uid = user.id;

  const dict = async (model: 'company' | 'position' | 'location' | 'source', name: string, extra: Record<string, unknown> = {}) => {
    const normalizedName = normalizeName(name);
    const d = (prisma as any)[model];
    const row = await d.upsert({
      where: { userId_normalizedName: { userId: uid, normalizedName } },
      create: { userId: uid, name, normalizedName, usageCount: 1, lastUsedAt: new Date(), ...extra },
      update: { usageCount: { increment: 1 }, lastUsedAt: new Date() },
    });
    return row.id as string;
  };
  for (const s of SYSTEM_SOURCES) {
    await prisma.source.create({
      data: { userId: uid, name: systemSourceName(s, 'ru'), normalizedName: normalizeName(systemSourceName(s, 'ru')), domain: s.domains[0] ?? null, isSystem: true },
    });
  }
  const tagNames = ['мечта', 'стартап', 'реферал', 'финтех'];
  const tagIds: string[] = [];
  for (const t of tagNames) {
    tagIds.push((await prisma.tag.create({ data: { userId: uid, name: t, normalizedName: normalizeName(t) } })).id);
  }

  const now = Date.now();
  for (let i = 0; i < 150; i++) {
    const appliedAt = new Date(now - Math.floor(Math.pow(rnd(), 0.8) * 180) * DAY - Math.floor(rnd() * 10) * 3_600_000);
    const src = pick(sources);
    const pos = pick(positions);
    const format = pick(['REMOTE', 'REMOTE', 'HYBRID', 'OFFICE'] as const);
    const base = pick([180, 200, 220, 250, 260, 280, 300, 320, 350, 380, 400, 450]) * 1000;
    const hasSalary = rnd() < 0.75;
    const coverLetter = rnd() < 0.45;
    const salaryPenalty = base > 350_000 ? 0.5 : base < 260_000 ? 1.2 : 1;

    const p = 0.32 * sourceBoost[src] * salaryPenalty * (coverLetter ? 1.25 : 1) * (format === 'OFFICE' ? 1.2 : 1);
    const age = (now - appliedAt.getTime()) / DAY;

    // Simulate a path through the funnel
    const path: AppStatus[] = ['APPLIED'];
    if (rnd() < 0.5) path.push('VIEWED');
    if (rnd() < p) {
      path.push('SCREENING');
      if (rnd() < 0.35) path.push('TEST_TASK');
      if (rnd() < 0.6) {
        path.push('INTERVIEW');
        if (rnd() < 0.5) path.push('FINAL_INTERVIEW');
        if (rnd() < 0.35) path.push('OFFER');
        else if (rnd() < 0.8) path.push('REJECTED');
      } else if (rnd() < 0.7) path.push('REJECTED');
    } else if (rnd() < 0.35) path.push('REJECTED');
    else if (age > 30 && rnd() < 0.4) path.push('NO_RESPONSE');

    let state = applyTransition(null, 'APPLIED', appliedAt);
    const history: { fromStatus: AppStatus | null; toStatus: AppStatus; changedAt: Date }[] = [
      { fromStatus: null, toStatus: 'APPLIED', changedAt: appliedAt },
    ];
    let t = appliedAt.getTime();
    for (let s = 1; s < path.length; s++) {
      t = Math.min(now - 3_600_000, t + (1 + Math.floor(rnd() * 6)) * DAY);
      state = applyTransition(state, path[s], new Date(t));
      history.push({ fromStatus: path[s - 1], toStatus: path[s], changedAt: new Date(t) });
    }
    const status = state.status;
    const isInterview = status === 'INTERVIEW' || status === 'FINAL_INTERVIEW';

    const company = pick(companies);
    await prisma.application.create({
      data: {
        userId: uid,
        companyId: await dict('company', company),
        positionId: await dict('position', pos.name, { groupName: pos.group }),
        sourceId: await dict('source', src),
        locationId: format === 'REMOTE' && rnd() < 0.4 ? null : await dict('location', pick(locations)),
        workFormat: format,
        salaryFrom: hasSalary ? base : null,
        salaryTo: hasSalary && rnd() < 0.7 ? base + pick([30, 50, 70, 100]) * 1000 : null,
        currency: hasSalary ? 'RUB' : null,
        salaryType: hasSalary ? 'GROSS' : null,
        offerAmount: STATUS_STAGE[status] === 5 ? base + pick([0, 20, 40]) * 1000 : null,
        appliedAt,
        coverLetter,
        vacancyUrl: src === 'HeadHunter' ? `https://hh.ru/vacancy/${9_000_000 + i}` : null,
        nextStepAt: isInterview ? new Date(now + (1 + Math.floor(rnd() * 7)) * DAY) : null,
        rejectionReason: status === 'REJECTED' ? pick(['EXPERIENCE', 'SALARY', 'CLOSED', 'NO_REASON']) : null,
        ...state,
        statusHistory: { create: history },
        tags: rnd() < 0.2 ? { create: [{ tagId: pick(tagIds) }] } : undefined,
      },
    });
  }
  console.log(`Seeded ${DEMO_EMAIL} with 150 applications`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
