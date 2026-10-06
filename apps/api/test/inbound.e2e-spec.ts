import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import { json } from 'express';
import { generateKeyPairSync } from 'node:crypto';
import request from 'supertest';
import { dkimSign } from 'mailauth/lib/dkim/sign';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { DkimVerifier } from '../src/inbound/dkim';
import { signInbound } from '../src/inbound/signature';
import { buildMail, GMAIL_CONFIRMATION, GREENHOUSE_CONFIRM, HH_INVITATION, NEWSLETTER } from './fixtures/mail';

// Configure e-mail import for this suite (config() is read lazily on the first request)
const DOMAIN = 'in.heyreply.test';
const SECRET = 'test-inbound-secret-0123456789abcdef0123456789';
process.env.INBOUND_EMAIL_DOMAIN = DOMAIN;
process.env.INBOUND_SECRET = SECRET;
process.env.INBOUND_REQUIRE_DKIM = 'true';

/** Our own "DNS": selector._domainkey.<domain> → public keys generated for the test. */
const keys = new Map<string, { privateKey: string; txt: string }>();
function keyFor(domain: string) {
  if (!keys.has(domain)) {
    const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
    const p = publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
    keys.set(domain, { privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }).toString(), txt: `v=DKIM1; k=rsa; p=${p}` });
  }
  return keys.get(domain)!;
}
const resolver = async (name: string, type: string) => {
  const m = name.match(/^test\._domainkey\.(.+)$/);
  if (type === 'TXT' && m && keys.has(m[1])) return [[keys.get(m[1])!.txt]];
  const err = new Error('ENOTFOUND') as Error & { code: string };
  err.code = 'ENOTFOUND';
  throw err;
};
async function signed(raw: string, domain: string) {
  const { signatures } = await dkimSign(raw, { signatureData: [{ signingDomain: domain, selector: 'test', privateKey: keyFor(domain).privateKey }] } as unknown as Parameters<typeof dkimSign>[1]);
  return signatures + raw;
}

const stamp = Date.now();
const password = 'testpass123';
const cookies = (res: request.Response) => ((res.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);

describe('E-mail import (Cloudflare Email Worker webhook)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let jar: string[];
  let address: string;
  const email = `e2e-inbound-${stamp}@heyreply.test`;
  const http = () => request(app.getHttpServer());

  const deliver = (to: string, raw: string, opts: { secret?: string; ts?: number } = {}) => {
    const rawB64 = Buffer.from(raw).toString('base64');
    const ts = String(opts.ts ?? Math.floor(Date.now() / 1000));
    return http()
      .post('/api/v1/inbound/email')
      .set('X-Heyreply-Timestamp', ts)
      .set('X-Heyreply-Signature', signInbound(opts.secret ?? SECRET, ts, to, rawB64))
      .send({ to, from: 'user@gmail.com', raw: rawB64 });
  };

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(DkimVerifier)
      .useValue(new DkimVerifier(resolver))
      .compile();
    app = mod.createNestApplication({ bodyParser: false });
    app.setGlobalPrefix('api/v1', { exclude: ['api/health'] });
    app.use('/api/v1/inbound/email', json({ limit: '2.5mb' }));
    app.use(json({ limit: '100kb' }));
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    jar = cookies(await http().post('/api/v1/auth/register').send({ name: 'Inbound', email, password }).expect(201));
    const r = await http().post('/api/v1/me/inbound').set('Cookie', jar).expect(201);
    address = r.body.address;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('issues an unguessable personal address on the configured domain', () => {
    expect(address).toMatch(new RegExp(`^in-[0-9a-f]{32}@${DOMAIN.replace('.', '\\.')}$`));
  });

  it('rejects unsigned, wrongly signed and stale webhook calls', async () => {
    const raw = buildMail(HH_INVITATION);
    await http().post('/api/v1/inbound/email').send({ to: address, raw: Buffer.from(raw).toString('base64') }).expect(401);
    await deliver(address, raw, { secret: 'x'.repeat(40) }).expect(401);
    await deliver(address, raw, { ts: Math.floor(Date.now() / 1000) - 3600 }).expect(401);
  });

  it('refuses unknown recipients so the worker can bounce them', async () => {
    const r = await deliver(`in-nope@${DOMAIN}`, buildMail(HH_INVITATION));
    expect(r.status).toBe(404);
    expect((await deliver(`${address.split('@')[0]}@other.example`, buildMail(HH_INVITATION))).status).toBe(404);
  });

  it('imports a DKIM-signed hh.ru invitation, and only once', async () => {
    const raw = await signed(buildMail({ ...HH_INVITATION, messageId: `<inv-${stamp}@hh.ru>` }), 'hh.ru');
    const r = await deliver(address, raw).expect(200);
    expect(r.body).toEqual({ kind: 'application', outcome: 'created' });
    const list = await http().get('/api/v1/applications?q=Спортдата').set('Cookie', jar).expect(200);
    expect(list.body.items[0]).toMatchObject({ status: 'INTERVIEW', externalSource: 'hh', company: { name: 'Спортдата' }, position: { name: 'Frontend-разработчик' } });
    expect((await deliver(address, raw).expect(200)).body).toEqual({ kind: 'duplicate' });
  });

  it('does not trust forged board e-mails (no or foreign DKIM signature)', async () => {
    const forged = buildMail({ ...HH_INVITATION, subject: 'Приглашение на вакансию «Fake Job»', html: HH_INVITATION.html.replace('134575860', '999999001'), messageId: `<forged-${stamp}@x>` });
    expect((await deliver(address, forged).expect(200)).body).toMatchObject({ kind: 'unverified' });
    const signedByStranger = await signed(buildMail({ ...HH_INVITATION, html: HH_INVITATION.html.replace('134575860', '999999002'), messageId: `<forged2-${stamp}@x>` }), 'evil.example');
    expect((await deliver(address, signedByStranger).expect(200)).body).toMatchObject({ kind: 'unverified' });
    const list = await http().get('/api/v1/applications?q=Fake').set('Cookie', jar).expect(200);
    expect(list.body.total).toBe(0);
  });

  it('logs unrecognized board mail without importing anything', async () => {
    const raw = await signed(buildMail({ ...NEWSLETTER, messageId: `<news-${stamp}@hh.ru>` }), 'hh.ru');
    expect((await deliver(address, raw).expect(200)).body).toMatchObject({ kind: 'unrecognized' });
  });

  it('surfaces the Gmail forwarding confirmation code in settings', async () => {
    const raw = await signed(buildMail({ ...GMAIL_CONFIRMATION, messageId: `<fwd-${stamp}@google.com>` }), 'google.com');
    expect((await deliver(address, raw).expect(200)).body).toMatchObject({ kind: 'confirmation' });
    const o = await http().get('/api/v1/me/inbound').set('Cookie', jar).expect(200);
    expect(o.body.confirmation).toMatchObject({ code: '152430985', url: expect.stringMatching(/^https:\/\/mail-settings\.google\.com\//) });
    expect(o.body.recent.map((e: { kind: string }) => e.kind)).toEqual(expect.arrayContaining(['application', 'unverified', 'unrecognized', 'confirmation']));
    expect(JSON.stringify(o.body)).not.toMatch(/собеседование/); // bodies are never stored
  });

  it('links an ATS e-mail (no job link) with the same application seen by the extension', async () => {
    const raw = await signed(buildMail({ ...GREENHOUSE_CONFIRM, messageId: `<gh-${stamp}@greenhouse-mail.io>` }), 'greenhouse-mail.io');
    expect((await deliver(address, raw).expect(200)).body).toEqual({ kind: 'application', outcome: 'created' });
    let list = await http().get('/api/v1/applications?q=GitLab').set('Cookie', jar).expect(200);
    expect(list.body.items[0]).toMatchObject({ externalSource: 'greenhouse', status: 'APPLIED', source: { name: 'Greenhouse' } });

    // The extension later reports the same application with the real job id
    const token = (await http().post('/api/v1/me/tokens').set('Cookie', jar).send({ name: 't' }).expect(201)).body.token;
    const r = await http()
      .post('/api/v1/import/applications')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ platform: 'greenhouse', externalId: 'gitlab/jobs/8860302002', companyName: 'GitLab', positionName: 'Account Executive - France', status: 'VIEWED', origin: 'sync' }] })
      .expect(200);
    expect(r.body.items).toEqual(['updated']);
    list = await http().get('/api/v1/applications?q=GitLab').set('Cookie', jar).expect(200);
    expect(list.body.total).toBe(1);
    expect(list.body.items[0]).toMatchObject({ status: 'VIEWED', externalSource: 'greenhouse' });
    const row = await prisma.application.findUniqueOrThrow({ where: { id: list.body.items[0].id } });
    expect(row.externalId).toBe('gitlab/jobs/8860302002');
  });

  it('stops accepting mail for an address after it is rotated', async () => {
    const old = address;
    const r = await http().post('/api/v1/me/inbound').set('Cookie', jar).expect(201);
    expect(r.body.address).not.toBe(old);
    expect((await deliver(old, buildMail(HH_INVITATION))).status).toBe(404);
  });
});
