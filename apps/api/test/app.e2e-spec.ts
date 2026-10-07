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
      await http.patch('/api/v1/me/password').set('Cookie', deviceA).send({ currentPassword: 'newpass456', newPassword: 'newpass456' }).expect(400).expect((r) => expect(r.body.code).toBe('SAME_PASSWORD'));
      // A stolen session must not be able to guess the password: wrong answers lock the confirmation (the change above
      // was a correct answer, so the counter starts from zero)
      const now = 'newpass456';
      for (let i = 0; i < 4; i++) await http.patch('/api/v1/me/password').set('Cookie', deviceA).send({ currentPassword: `guess-${i}`, newPassword: 'another789' }).expect(400);
      await http.delete('/api/v1/me').set('Cookie', deviceA).send({ password: 'guess-4' }).expect(400);
      const locked = await http.patch('/api/v1/me/password').set('Cookie', deviceA).send({ currentPassword: now, newPassword: 'another789' }).expect(429);
      expect(locked.body.code).toBe('LOGIN_LOCKED');
      await http.delete('/api/v1/me').set('Cookie', deviceA).send({ password: now }).expect(429);
      // Signing in has its own counters and keeps working; nothing was changed or deleted
      await http.post('/api/v1/auth/login').send({ email, password: now }).expect(200);
      // Replaying the revoked device's refresh token is treated as theft and ends every session, so it goes last
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

    it('keeps the salary range valid on edit, whichever end changes', async () => {
      const http = request(app.getHttpServer());
      const id = (await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Range Co', positionName: 'Dev', salaryFrom: 100, salaryTo: 200 }).expect(201)).body.id;
      const patch = (b: object) => http.patch(`/api/v1/applications/${id}`).set('Cookie', jarB).send(b);
      expect((await patch({ salaryFrom: 300 }).expect(400)).body.code).toBe('SALARY_RANGE');
      expect((await patch({ salaryTo: 50 }).expect(400)).body.code).toBe('SALARY_RANGE');
      await patch({ salaryFrom: 400, salaryTo: 300 }).expect(400);
      await patch({ salaryFrom: 150, salaryTo: 300 }).expect(200);
      await patch({ salaryTo: null }).expect(200); // an open-ended range is fine
      await patch({ salaryFrom: 900 }).expect(200);
    });

    it('accepts only supported currencies', async () => {
      const http = request(app.getHttpServer());
      await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Cur Co', positionName: 'Dev', salaryFrom: 1, currency: 'ZZZ' }).expect(400);
      expect((await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Cur Co', positionName: 'Dev', salaryFrom: 1, currency: 'usd' }).expect(201)).body.currency).toBe('USD');
      await http.patch('/api/v1/me').set('Cookie', jarB).send({ defaultCurrency: 'XYZ' }).expect(400);
    });

    it('treats % and _ in a search as plain characters, and merges position groups regardless of case', async () => {
      const http = request(app.getHttpServer());
      await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Fifty%Off', positionName: 'Dev', note: 'a_b' }).expect(201);
      await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Plain Co', positionName: 'Dev' }).expect(201);
      const total = async (q: string) => (await http.get(`/api/v1/applications?q=${encodeURIComponent(q)}`).set('Cookie', jarB).expect(200)).body.total;
      expect(await total('%')).toBe(1);
      expect(await total('y%o')).toBe(1);
      expect(await total('_')).toBe(1);
      expect(await total('\\')).toBe(0);
      expect(await total('plain')).toBe(1);
      const a = await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Grp Co', positionName: 'Grp One' }).expect(201);
      const b = await http.post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Grp Co', positionName: 'Grp Two' }).expect(201);
      await http.patch(`/api/v1/dictionaries/positions/${a.body.position.id}`).set('Cookie', jarB).send({ groupName: 'Frontend' }).expect(200);
      const second = await http.patch(`/api/v1/dictionaries/positions/${b.body.position.id}`).set('Cookie', jarB).send({ groupName: 'frontend' }).expect(200);
      expect(second.body.groupName).toBe('Frontend');
    });

    it('explains why a dictionary value cannot be deleted while deleted applications still hold it', async () => {
      const app1 = (await http().post('/api/v1/applications').set('Cookie', jarB).send({ companyName: 'Trash Co', positionName: 'Dev' }).expect(201)).body;
      const del = (id: string) => http().delete(`/api/v1/dictionaries/companies/${id}`).set('Cookie', jarB);
      expect((await del(app1.company.id).expect(409)).body.code).toBe('DICT_IN_USE');
      await http().delete(`/api/v1/applications/${app1.id}`).set('Cookie', jarB).expect(200);
      expect((await del(app1.company.id).expect(409)).body.code).toBe('DICT_IN_TRASH');
    });

    it('restores applications deleted in bulk (undo), respecting what is already live', async () => {
      const mk = async (n: string) => (await http().post('/api/v1/applications').set('Cookie', jarB).send({ companyName: n, positionName: 'Undo' }).expect(201)).body.id as string;
      const [a, b] = [await mk('UndoCo A'), await mk('UndoCo B')];
      const bulk = (action: string, ids: string[]) => http().post('/api/v1/applications/bulk').set('Cookie', jarB).send({ ids, action });
      expect((await bulk('delete', [a, b]).expect(201)).body.affected).toBe(2);
      expect((await http().get('/api/v1/applications?q=UndoCo').set('Cookie', jarB)).body.total).toBe(0);
      expect((await bulk('restore', [a, b]).expect(201)).body.affected).toBe(2);
      expect((await http().get('/api/v1/applications?q=UndoCo').set('Cookie', jarB)).body.total).toBe(2);
      // Restoring what is not deleted is a no-op, and other users' ids are never touched
      expect((await bulk('restore', [a, b]).expect(201)).body.affected).toBe(0);
      expect((await bulk('restore', ['00000000-0000-4000-8000-000000000000']).expect(201)).body.affected).toBe(0);
    });

    it('does not resurrect an application the user deleted', async () => {
      const item = { platform: 'habr', externalId: '1000168750', companyName: 'Deleted Co', positionName: 'Dev' };
      await imp([item]).expect(200);
      const id = (await http().get('/api/v1/applications?q=Deleted').set('Cookie', jarB)).body.items[0].id;
      await http().delete(`/api/v1/applications/${id}`).set('Cookie', jarB).expect(200);
      expect((await imp([{ ...item, status: 'INTERVIEW', origin: 'sync' }]).expect(200)).body).toMatchObject({ unchanged: 1, created: 0 });
      expect((await http().get('/api/v1/applications?q=Deleted').set('Cookie', jarB)).body.total).toBe(0);
    });

    it('adds an application by hand from a page without a board adapter, once per vacancy link', async () => {
      const manual = (body: object) => http().post('/api/v1/import/manual').set('Authorization', `Bearer ${token}`).set('Origin', 'chrome-extension://abcdef').send(body);
      const body = { companyName: 'ООО «Ромашка»', positionName: 'QA Engineer', vacancyUrl: 'https://careers.romashka.example/jobs/42?utm_source=tg', status: 'INTERVIEW', appliedAt: '2026-09-01T12:00:00.000Z' };
      expect((await manual(body).expect(200)).body).toEqual({ outcome: 'created' });
      // Same page, other tracking parameters: the link is the identity
      expect((await manual({ ...body, vacancyUrl: 'https://careers.romashka.example/jobs/42/' }).expect(200)).body).toEqual({ outcome: 'unchanged' });

      const list = await http().get('/api/v1/applications?q=Ромашка').set('Cookie', jarB).expect(200);
      expect(list.body.total).toBe(1);
      expect(list.body.items[0]).toMatchObject({ status: 'INTERVIEW', externalSource: 'web', company: { name: 'Ромашка' }, source: { name: 'Сайт компании' } });
      expect(list.body.items[0].appliedAt.slice(0, 10)).toBe('2026-09-01');

      // Without a link it is a plain manual application; a second identical add links to it instead of duplicating
      const noLink = { companyName: 'Без ссылки', positionName: 'Dev' };
      expect((await manual(noLink).expect(200)).body).toEqual({ outcome: 'created' });
      expect((await manual(noLink).expect(200)).body).toEqual({ outcome: 'linked' });
      const plain = await http().get('/api/v1/applications?q=Без ссылки').set('Cookie', jarB).expect(200);
      expect(plain.body.total).toBe(1);
      expect(plain.body.items[0].externalSource).toBeNull();

      expect((await manual({ companyName: 'X', positionName: 'Y', vacancyUrl: 'javascript:alert(1)' })).status).toBe(400);
      await http().post('/api/v1/import/manual').set('Cookie', jarB).send(noLink).expect(401);
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
