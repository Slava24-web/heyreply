import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { LEGAL_VERSION } from '@heyreply/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { RetentionService } from '../src/retention/retention.service';
import { ImportService } from '../src/integrations/import.service';

const stamp = Date.now();
const email = `e2e-retention-${stamp}@heyreply.test`;
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(Date.now() - n * DAY);

describe('data retention and export (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let retention: RetentionService;
  let importer: ImportService;
  let jar: string[];
  let userId: string;
  let base: { userId: string; companyId: string; positionId: string };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['api/health'] });
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    retention = app.get(RetentionService);
    importer = app.get(ImportService);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Ret', email, password: 'testpass123', acceptTerms: true, acceptPersonalData: true })
      .expect(201);
    jar = ((res.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);
    userId = res.body.user.id;
    await request(app.getHttpServer()).post('/api/v1/applications').set('Cookie', jar).send({ companyName: 'Acme', positionName: 'Dev' }).expect(201);
    const seed = await prisma.application.findFirstOrThrow({ where: { userId } });
    base = { userId, companyId: seed.companyId, positionId: seed.positionId };
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('purges applications deleted more than 30 days ago and nothing else', async () => {
    const old = await prisma.application.create({ data: { ...base, externalSource: 'hh', externalId: 'old-1', deletedAt: daysAgo(31) } });
    const oldManual = await prisma.application.create({ data: { ...base, deletedAt: daysAgo(40) } });
    const recent = await prisma.application.create({ data: { ...base, externalSource: 'hh', externalId: 'recent-1', deletedAt: daysAgo(5) } });
    const live = await prisma.application.findFirstOrThrow({ where: { userId, deletedAt: null } });
    await prisma.statusHistory.create({ data: { applicationId: old.id, toStatus: 'APPLIED' } });

    await retention.run();

    expect(await prisma.application.findUnique({ where: { id: old.id } })).toBeNull();
    expect(await prisma.application.findUnique({ where: { id: oldManual.id } })).toBeNull();
    expect(await prisma.statusHistory.count({ where: { applicationId: old.id } })).toBe(0);
    expect(await prisma.application.findUnique({ where: { id: recent.id } })).not.toBeNull();
    expect(await prisma.application.findUnique({ where: { id: live.id } })).not.toBeNull();
    // Only the vacancy id of the imported one survives, so the board can't bring it back
    const tombstones = await prisma.deletedImport.findMany({ where: { userId } });
    expect(tombstones.map((t) => `${t.externalSource}:${t.externalId}`)).toEqual(['hh:old-1']);
  });

  it('does not resurrect a purged import', async () => {
    const before = await prisma.application.count({ where: { userId } });
    const r = await importer.importBatch(userId, [{ platform: 'hh', externalId: 'old-1', companyName: 'Other', positionName: 'Thing', origin: 'apply' }]);
    expect(r.items).toEqual(['unchanged']);
    expect(await prisma.application.count({ where: { userId } })).toBe(before);
    const fresh = await importer.importBatch(userId, [{ platform: 'hh', externalId: 'new-1', companyName: 'Other', positionName: 'Thing', origin: 'apply' }]);
    expect(fresh.items).toEqual(['created']);
  });

  it('drops dead sessions and spent credentials', async () => {
    const expired = await prisma.session.create({ data: { userId, refreshTokenHash: 'x', expiresAt: daysAgo(1), ip: '10.0.0.1' } });
    const revoked = await prisma.session.create({ data: { userId, refreshTokenHash: 'y', expiresAt: new Date(Date.now() + DAY), revokedAt: daysAgo(8) } });
    const justRevoked = await prisma.session.create({ data: { userId, refreshTokenHash: 'z', expiresAt: new Date(Date.now() + DAY), revokedAt: daysAgo(1) } });
    await prisma.apiToken.create({ data: { userId, name: 'old', tokenHash: `h-${stamp}`, prefix: 'otk_x', revokedAt: daysAgo(31) } });
    await prisma.user.update({ where: { id: userId }, data: { resetTokenHash: 'r', resetTokenExpires: daysAgo(1) } });

    await retention.run();

    const ids = (await prisma.session.findMany({ where: { userId }, select: { id: true } })).map((s) => s.id);
    expect(ids).not.toContain(expired.id);
    expect(ids).not.toContain(revoked.id);
    expect(ids).toContain(justRevoked.id);
    expect(await prisma.apiToken.count({ where: { userId } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).resetTokenHash).toBeNull();
  });

  it('asks accounts without current consent to accept the documents', async () => {
    const http = () => request(app.getHttpServer());
    await prisma.user.update({ where: { id: userId }, data: { termsAcceptedAt: null, termsVersion: null, termsAcceptedIp: null } });
    expect((await http().get('/api/v1/me').set('Cookie', jar).expect(200)).body.legalAccepted).toBe(false);
    await http().post('/api/v1/me/consent').set('Cookie', jar).send({ acceptTerms: true }).expect(400);
    const ok = await http().post('/api/v1/me/consent').set('Cookie', jar).send({ acceptTerms: true, acceptPersonalData: true }).expect(200);
    expect(ok.body.legalAccepted).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    expect(row.termsVersion).toBe(LEGAL_VERSION);
    expect(row.termsAcceptedAt).toBeInstanceOf(Date);
  });

  it('exports every category of data, including archived and recently deleted applications', async () => {
    const archived = await prisma.application.create({ data: { ...base, archivedAt: daysAgo(2) } });
    const r = await request(app.getHttpServer()).get('/api/v1/me/export').set('Cookie', jar).expect(200);
    expect(Object.keys(r.body)).toEqual(
      expect.arrayContaining(['profile', 'consent', 'applications', 'dictionaries', 'sessions', 'integrationTokens']),
    );
    const byId = new Map<string, { deletedAt: string | null; archivedAt: string | null }>(r.body.applications.map((a: { id: string }) => [a.id, a]));
    expect(byId.get(archived.id)?.archivedAt).not.toBeNull();
    expect([...byId.values()].some((a) => a.deletedAt)).toBe(true);
    expect(r.body.consent.documentsVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r.body.dictionaries.companies.map((c: { name: string }) => c.name)).toEqual(['Acme', 'Other']);
    expect(JSON.stringify(r.body)).not.toMatch(/refreshTokenHash|tokenHash|passwordHash/);
  });
});
