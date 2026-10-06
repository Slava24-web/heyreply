import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { LEGAL_VERSION, registerSchema } from '@heyreply/shared';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { originGuard } from '../src/common/origin.middleware';

const stamp = Date.now();
const emailA = `e2e-a-${stamp}@heyreply.test`;
const emailB = `e2e-b-${stamp}@heyreply.test`;
const password = 'testpass123';

function cookies(res: request.Response): string[] {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  return (raw ?? []).map((c) => c.split(';')[0]);
}
const pick = (jar: string[], name: string) => jar.find((c) => c.startsWith(name + '='));

describe('heyreply API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jarA: string[];
  let jarB: string[];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['api/health'] });
    app.use(cookieParser());
    app.use(originGuard('http://localhost:3000'));
    await app.init();
    prisma = app.get(PrismaService);

    const a = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ name: 'A', email: emailA, password, locale: 'ru', acceptTerms: true, acceptPersonalData: true }).expect(201);
    jarA = cookies(a);
    const b = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ name: 'B', email: emailB, password, acceptTerms: true, acceptPersonalData: true }).expect(201);
    jarB = cookies(b);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: [emailA, emailB] } } });
    await app.close();
  });

  it('requires consent to register', () => {
    // Register is throttled to 10/min, so rejections are checked against the schema the endpoint validates with
    const base = { name: 'C', email: 'c@heyreply.test', password };
    expect(registerSchema.safeParse(base).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: true }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: true, acceptPersonalData: false }).success).toBe(false);
    expect(registerSchema.safeParse({ ...base, acceptTerms: true, acceptPersonalData: true }).success).toBe(true);
  });

  it('seeds preset sources in the registration language', async () => {
    const http = request(app.getHttpServer());
    const email = `e2e-en-${stamp}@heyreply.test`;
    try {
      const r = await http.post('/api/v1/auth/register').send({ name: 'En', email, password, locale: 'en', acceptTerms: true, acceptPersonalData: true }).expect(201);
      expect(r.body.user.locale).toBe('en');
      const stored = await prisma.user.findUniqueOrThrow({ where: { email } });
      expect(stored.termsAcceptedAt).toBeInstanceOf(Date);
      expect(stored.termsVersion).toBe(LEGAL_VERSION);
      const jar = cookies(r);
      const names = (await http.get('/api/v1/dictionaries/sources').set('Cookie', jar).expect(200)).body.map((s: { name: string }) => s.name);
      expect(names).toEqual(expect.arrayContaining(['Company website', 'Referral', 'Habr Career']));
      expect(names).not.toContain('Рекомендация');
      // English accounts start with USD (Russian ones keep RUB)
      expect(stored.defaultCurrency).toBe('USD');
      const app1 = await http.post('/api/v1/applications').set('Cookie', jar).send({ companyName: 'Acme', positionName: 'Dev', vacancyUrl: 'https://career.habr.com/vacancies/1' }).expect(201);
      expect(app1.body.source.name).toBe('Habr Career');
      const ruNames = (await http.get('/api/v1/dictionaries/sources').set('Cookie', jarA).expect(200)).body.map((s: { name: string }) => s.name);
      expect(ruNames).toEqual(expect.arrayContaining(['Сайт компании', 'Рекомендация']));
    } finally {
      await prisma.user.deleteMany({ where: { email } });
    }
  });

  it('rejects unauthenticated requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/applications').expect(401);
  });

  it('rejects invalid passwords on register', async () => {
    const r = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ name: 'X', email: `x-${stamp}@heyreply.test`, password: 'short' });
    expect(r.status).toBe(400);
    expect(r.body.code).toBe('VALIDATION_ERROR');
  });

  it('creates an application, reuses dictionary entries case-insensitively and computes metrics', async () => {
    const http = request(app.getHttpServer());
    const first = await http
      .post('/api/v1/applications')
      .set('Cookie', jarA)
      .send({ companyName: 'Ёлка Тех', positionName: 'Frontend Developer', vacancyUrl: 'https://hh.ru/vacancy/1' })
      .expect(201);
    expect(first.body.source.name).toBe('HeadHunter');
    expect(first.body.status).toBe('APPLIED');

    const second = await http.post('/api/v1/applications').set('Cookie', jarA).send({ companyName: '  елка   тех ', positionName: 'frontend developer' }).expect(201);
    expect(second.body.company.id).toBe(first.body.company.id);
    expect(second.body.position.id).toBe(first.body.position.id);

    await http.post(`/api/v1/applications/${first.body.id}/status`).set('Cookie', jarA).send({ status: 'INTERVIEW' }).expect(201);
    await http.post(`/api/v1/applications/${first.body.id}/status`).set('Cookie', jarA).send({ status: 'REJECTED', comment: 'no' }).expect(201);

    const detail = await http.get(`/api/v1/applications/${first.body.id}`).set('Cookie', jarA).expect(200);
    expect(detail.body.maxStage).toBe(4);
    expect(detail.body.history.map((h: { toStatus: string }) => h.toStatus)).toEqual(['APPLIED', 'INTERVIEW', 'REJECTED']);

    const s = await http.get('/api/v1/analytics/summary').set('Cookie', jarA).expect(200);
    expect(s.body).toMatchObject({ total: 2, responseRate: 50, interviewRate: 50, offerRate: 0, rejectionRate: 50 });

    const dict = await http.get('/api/v1/dictionaries/companies').set('Cookie', jarA).expect(200);
    expect(dict.body).toHaveLength(1);
    expect(dict.body[0].usageCount).toBe(2);
  });

  it('isolates users from each other', async () => {
    const http = request(app.getHttpServer());
    const listA = await http.get('/api/v1/applications').set('Cookie', jarA).expect(200);
    const id = listA.body.items[0].id;
    await http.get(`/api/v1/applications/${id}`).set('Cookie', jarB).expect(404);
    await http.patch(`/api/v1/applications/${id}`).set('Cookie', jarB).send({ note: 'hack' }).expect(404);
    await http.delete(`/api/v1/applications/${id}`).set('Cookie', jarB).expect(404);
    const listB = await http.get('/api/v1/applications').set('Cookie', jarB).expect(200);
    expect(listB.body.total).toBe(0);
    const dictB = await http.get('/api/v1/dictionaries/companies').set('Cookie', jarB).expect(200);
    expect(dictB.body).toHaveLength(0);
  });

  it('rotates refresh tokens and revokes all sessions on reuse', async () => {
    const http = request(app.getHttpServer());
    const login = await http.post('/api/v1/auth/login').send({ email: emailB, password }).expect(200);
    const jar = cookies(login);
    const oldRefresh = pick(jar, 'refresh_token')!;

    const r1 = await http.post('/api/v1/auth/refresh').set('Cookie', [oldRefresh]).expect(200);
    const newRefresh = pick(cookies(r1), 'refresh_token')!;
    expect(newRefresh).not.toBe(oldRefresh);

    // Move the rotation outside the multi-tab grace window: a replay now looks like a stolen token
    const oldSessionId = decodeURIComponent(oldRefresh.split('=')[1]).split('.')[0];
    await prisma.session.update({ where: { id: oldSessionId }, data: { rotatedAt: new Date(Date.now() - 60_000) } });

    // Replaying the rotated token is treated as theft
    const replay = await http.post('/api/v1/auth/refresh').set('Cookie', [oldRefresh]).expect(401);
    expect(replay.body.code).toBe('REFRESH_REUSED');
    // ...and the legitimately rotated token is revoked too
    await http.post('/api/v1/auth/refresh').set('Cookie', [newRefresh]).expect(401);
  });

  it('locks login after repeated failures', async () => {
    const http = request(app.getHttpServer());
    for (let i = 0; i < 5; i++) await http.post('/api/v1/auth/login').send({ email: emailA, password: 'wrong-pass-1' }).expect(401);
    const locked = await http.post('/api/v1/auth/login').send({ email: emailA, password }).expect(429);
    expect(locked.body.code).toBe('LOGIN_LOCKED');
  });

  describe('security', () => {
    async function freshUser(tag: string) {
      const email = `e2e-${tag}-${stamp}@heyreply.test`;
      const r = await request(app.getHttpServer()).post('/api/v1/auth/register').send({ name: tag, email, password, acceptTerms: true, acceptPersonalData: true }).expect(201);
      return { email, jar: cookies(r) };
    }
    afterAll(() => prisma.user.deleteMany({ where: { email: { contains: `-${stamp}@heyreply.test` } } }));

    it('rejects javascript:/data: vacancy URLs (stored XSS)', async () => {
      for (const vacancyUrl of ['javascript:alert(document.cookie)', 'JAVASCRIPT:alert(1)', 'data:text/html,<script>alert(1)</script>']) {
        const r = await request(app.getHttpServer()).post('/api/v1/applications').set('Cookie', jarA).send({ companyName: 'X', positionName: 'Y', vacancyUrl });
        expect(r.status).toBe(400);
      }
    });

    it('neutralizes spreadsheet formulas in CSV export', async () => {
      const http = request(app.getHttpServer());
      await http.post('/api/v1/applications').set('Cookie', jarA).send({ companyName: '=HYPERLINK("http://evil","x")', positionName: '@SUM(1)' }).expect(201);
      const csv = await http.get('/api/v1/applications/export?fileFormat=csv').set('Cookie', jarA).expect(200);
      expect(csv.text).toContain(`"'=HYPERLINK(""http://evil"",""x"")"`);
      expect(csv.text).toContain("'@SUM(1)");
      expect(csv.text).not.toMatch(/(^|,)=HYPERLINK/m);
    });

    it('blocks cross-site state changes (CSRF)', async () => {
      const http = request(app.getHttpServer());
      const evil = await http.post('/api/v1/applications').set('Cookie', jarA).set('Origin', 'https://evil.example').send({ companyName: 'a', positionName: 'b' });
      expect(evil.status).toBe(403);
      const fetchSite = await http.post('/api/v1/applications').set('Cookie', jarA).set('Sec-Fetch-Site', 'cross-site').send({ companyName: 'a', positionName: 'b' });
      expect(fetchSite.status).toBe(403);
      await http.post('/api/v1/applications').set('Cookie', jarA).set('Origin', 'http://localhost:3000').send({ companyName: 'Ok', positionName: 'Ok' }).expect(201);
    });

    it('kills the access token immediately on logout', async () => {
      const http = request(app.getHttpServer());
      const { jar } = await freshUser('logout');
      await http.get('/api/v1/me').set('Cookie', jar).expect(200);
      await http.post('/api/v1/auth/logout').set('Cookie', jar).expect(200);
      const after = await http.get('/api/v1/me').set('Cookie', [pick(jar, 'access_token')!]).expect(401);
      expect(after.body.code).toBe('SESSION_REVOKED');
    });

    it('password change signs out other devices but keeps the current one', async () => {
      const http = request(app.getHttpServer());
      const { email, jar: deviceA } = await freshUser('pwchange');
      const deviceB = cookies(await http.post('/api/v1/auth/login').send({ email, password }).expect(200));
      await http.patch('/api/v1/me/password').set('Cookie', deviceA).send({ currentPassword: password, newPassword: 'newpass456' }).expect(200);
      await http.get('/api/v1/me').set('Cookie', deviceA).expect(200);
      await http.get('/api/v1/me').set('Cookie', deviceB).expect(401);
      await http.post('/api/v1/auth/refresh').set('Cookie', [pick(deviceB, 'refresh_token')!]).expect(401);
    });

    it('treats a refresh replayed within seconds as a multi-tab race, not theft', async () => {
      const http = request(app.getHttpServer());
      const { jar } = await freshUser('race');
      const old = pick(jar, 'refresh_token')!;
      const r1 = await http.post('/api/v1/auth/refresh').set('Cookie', [old]).expect(200);
      const race = await http.post('/api/v1/auth/refresh').set('Cookie', [old]).expect(409);
      expect(race.body.code).toBe('REFRESH_RACE');
      // The winner's new token keeps working — nobody got logged out
      await http.post('/api/v1/auth/refresh').set('Cookie', [pick(cookies(r1), 'refresh_token')!]).expect(200);
    });

    it('rejects forged or tampered tokens', async () => {
      const http = request(app.getHttpServer());
      const access = pick(jarA, 'access_token')!.split('=')[1];
      const [h, p] = access.split('.');
      const payload = JSON.parse(Buffer.from(p, 'base64url').toString());
      const forgedPayload = Buffer.from(JSON.stringify({ ...payload, sub: '00000000-0000-0000-0000-000000000000' })).toString('base64url');
      await http.get('/api/v1/me').set('Cookie', [`access_token=${h}.${forgedPayload}.${access.split('.')[2]}`]).expect(401);
      const none = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      await http.get('/api/v1/me').set('Cookie', [`access_token=${none}.${p}.`]).expect(401);
      await http.post('/api/v1/auth/refresh').set('Cookie', ['refresh_token=not-a-uuid.secret']).expect(401);
    });

    it('requires the password to delete the account and erases all personal data', async () => {
      const http = request(app.getHttpServer());
      const { email, jar } = await freshUser('erase');
      await http.post('/api/v1/applications').set('Cookie', jar).send({ companyName: 'Secret Co', positionName: 'Dev', note: 'private' }).expect(201);
      await http.delete('/api/v1/me').set('Cookie', jar).send({ password: 'wrong' }).expect(400);
      await http.delete('/api/v1/me').set('Cookie', jar).send({ password }).expect(200);
      const user = await prisma.user.findUnique({ where: { email } });
      expect(user).toBeNull();
      expect(await prisma.company.count({ where: { name: 'Secret Co' } })).toBe(0);
      expect(await prisma.application.count({ where: { note: 'private' } })).toBe(0);
    });

    it('does not reveal stack traces or internals in errors', async () => {
      const r = await request(app.getHttpServer()).get('/api/v1/applications/not-a-uuid').set('Cookie', jarA);
      expect(r.status).toBe(400);
      expect(JSON.stringify(r.body)).not.toMatch(/at \w+ \(|prisma|node_modules/i);
    });

    it('answers an oversized body with 413, not a 500', async () => {
      const r = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x'.repeat(150_000) });
      expect(r.status).toBe(413);
      expect(r.body).toMatchObject({ code: 'PAYLOAD_TOO_LARGE' });
      expect(JSON.stringify(r.body)).not.toMatch(/at \w+ \(|node_modules/i);
    });
  });

  describe('browser extension import', () => {
    let token: string;
    let jarB: string[];
    const emailB = `e2e-import-${stamp}@heyreply.test`;
    const http = () => request(app.getHttpServer());
    const imp = (items: object[], t = token) =>
      http().post('/api/v1/import/applications').set('Authorization', `Bearer ${t}`).set('Origin', 'chrome-extension://abcdef').send({ items });

    afterAll(() => prisma.user.deleteMany({ where: { email: emailB } }));

    beforeAll(async () => {
      jarB = cookies(await http().post('/api/v1/auth/register').send({ name: 'Importer', email: emailB, password, locale: 'ru', acceptTerms: true, acceptPersonalData: true }).expect(201));
      const r = await http().post('/api/v1/me/tokens').set('Cookie', jarB).send({ name: 'Chrome' }).expect(201);
      token = r.body.token;
      expect(token).toMatch(/^otk_/);
      const list = await http().get('/api/v1/me/tokens').set('Cookie', jarB).expect(200);
      expect(list.body[0]).not.toHaveProperty('token');
      expect(list.body[0].prefix).toBe(token.slice(0, 10));
    });

    it('rejects missing, forged and cookie-only auth', async () => {
      await http().get('/api/v1/import/ping').expect(401);
      await http().get('/api/v1/import/ping').set('Authorization', 'Bearer otk_forged').expect(401);
      await http().post('/api/v1/import/applications').set('Cookie', jarB).send({ items: [] }).expect(401);
      const ping = await http().get('/api/v1/import/ping').set('Authorization', `Bearer ${token}`).expect(200);
      expect(ping.body.user.email).toBe(emailB);
    });

    it('creates once, then only moves the status forward', async () => {
      const item = { platform: 'hh', externalId: '777001', companyName: 'Спортдата', positionName: 'Frontend-разработчик', vacancyUrl: 'https://hh.ru/vacancy/777001' };
      expect((await imp([item]).expect(200)).body).toMatchObject({ created: 1 });
      expect((await imp([item]).expect(200)).body).toMatchObject({ unchanged: 1 });
      expect((await imp([{ ...item, origin: 'sync', status: 'INTERVIEW' }]).expect(200)).body).toMatchObject({ updated: 1 });
      expect((await imp([{ ...item, origin: 'sync', status: 'VIEWED' }]).expect(200)).body).toMatchObject({ unchanged: 1 });

      const list = await http().get('/api/v1/applications?q=Спортдата').set('Cookie', jarB).expect(200);
      expect(list.body.total).toBe(1);
      const a = list.body.items[0];
      expect(a).toMatchObject({ status: 'INTERVIEW', externalSource: 'hh', source: { name: 'HeadHunter' } });
      const detail = await http().get(`/api/v1/applications/${a.id}`).set('Cookie', jarB).expect(200);
      expect(detail.body.history.map((h: { toStatus: string; comment: string }) => [h.toStatus, h.comment])).toEqual([
        ['APPLIED', 'Импорт: HeadHunter'],
        ['INTERVIEW', 'Импорт: HeadHunter'],
      ]);
    });

    it('links to an application the user added by hand instead of duplicating it', async () => {
      await http().post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Wrike', positionName: 'React Developer' }).expect(201);
      const r = await imp([{ platform: 'linkedin', externalId: '4400001', companyName: 'wrike', positionName: 'react developer', status: 'VIEWED', origin: 'sync' }]).expect(200);
      expect(r.body.created).toBe(0);
      const list = await http().get('/api/v1/applications?q=Wrike').set('Cookie', jarB).expect(200);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0]).toMatchObject({ externalSource: 'linkedin', status: 'VIEWED' });
    });

    it('does not resurrect an application the user deleted', async () => {
      const item = { platform: 'habr', externalId: '1000168750', companyName: 'Deleted Co', positionName: 'Dev' };
      await imp([item]).expect(200);
      const id = (await http().get('/api/v1/applications?q=Deleted').set('Cookie', jarB)).body.items[0].id;
      await http().delete(`/api/v1/applications/${id}`).set('Cookie', jarB).expect(200);
      expect((await imp([{ ...item, status: 'INTERVIEW', origin: 'sync' }]).expect(200)).body).toMatchObject({ unchanged: 1, created: 0 });
      expect((await http().get('/api/v1/applications?q=Deleted').set('Cookie', jarB)).body.total).toBe(0);
    });

    it('validates input and isolates users', async () => {
      const bad = await imp([{ platform: 'hh', externalId: '1', companyName: 'X', positionName: 'Y', vacancyUrl: 'javascript:alert(1)' }]);
      expect(bad.status).toBe(400);
      expect((await imp([{ platform: 'myspace', externalId: '1', companyName: 'X', positionName: 'Y' }])).status).toBe(400);
      const otherEmail = `e2e-other-${stamp}@heyreply.test`;
      const other = cookies(await http().post('/api/v1/auth/register').send({ name: 'Other', email: otherEmail, password, acceptTerms: true, acceptPersonalData: true }).expect(201));
      const seen = await http().get('/api/v1/applications?q=Спортдата').set('Cookie', other).expect(200);
      expect(seen.body.total).toBe(0);
      await prisma.user.deleteMany({ where: { email: otherEmail } });
    });

    it('stops working immediately after the token is revoked', async () => {
      const id = (await http().get('/api/v1/me/tokens').set('Cookie', jarB)).body[0].id;
      await http().delete(`/api/v1/me/tokens/${id}`).set('Cookie', jarB).expect(200);
      await http().get('/api/v1/import/ping').set('Authorization', `Bearer ${token}`).expect(401);
    });
  });

  // Last on purpose: these exhaust per-route budgets for the shared test IP
  describe('rate limits on unauthenticated endpoints', () => {
    const hammer = async (send: () => request.Test, n: number) => {
      const codes: number[] = [];
      for (let i = 0; i < n; i++) codes.push((await send()).status);
      return codes;
    };

    it('throttles /import/ping with garbage tokens (each call is a DB lookup)', async () => {
      const codes = await hammer(() => request(app.getHttpServer()).get('/api/v1/import/ping').set('Authorization', 'Bearer otk_garbage'), 125);
      expect(new Set(codes)).toEqual(new Set([401, 429]));
      expect(codes.indexOf(429)).toBeLessThanOrEqual(120);
      expect(codes.slice(codes.indexOf(429)).every((c) => c === 429)).toBe(true);
    });

    it('throttles /auth/logout with random refresh cookies', async () => {
      const codes = await hammer(() => request(app.getHttpServer()).post('/api/v1/auth/logout').set('Cookie', `refresh_token=${crypto.randomUUID()}.x`), 65);
      expect(new Set(codes)).toEqual(new Set([200, 429]));
      expect(codes.indexOf(429)).toBeLessThanOrEqual(60);
      expect(codes.slice(codes.indexOf(429)).every((c) => c === 429)).toBe(true);
    });
  });
});
