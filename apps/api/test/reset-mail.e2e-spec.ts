import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { MailService } from '../src/mail/mail.service';
import { passwordResetMail } from '../src/mail/templates';

const email = `e2e-reset-${Date.now()}@heyreply.test`;

describe('password reset e-mail (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const sent: { to: string; locale: string; link: string }[] = [];

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(MailService)
      .useValue({ sendPasswordReset: async (to: string, locale: string, link: string) => void sent.push({ to, locale, link }) })
      .compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['api/health'] });
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'R', email, password: 'testpass123', locale: 'ru', acceptTerms: true, acceptPersonalData: true })
      .expect(201);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  const forgot = (e: string) => request(app.getHttpServer()).post('/api/v1/auth/forgot-password').send({ email: e });
  const flush = () => new Promise((r) => setImmediate(r));

  it('mails a working link, stays silent for unknown addresses and throttles repeats', async () => {
    const unknown = await forgot('nobody@heyreply.test').expect(200);
    const known = await forgot(email).expect(200);
    expect(unknown.body).toEqual(known.body);
    await flush();
    expect(sent).toHaveLength(1);
    expect(sent[0].to).toBe(email);

    await forgot(email).expect(200); // within the cooldown: no second e-mail
    await flush();
    expect(sent).toHaveLength(1);

    const url = new URL(sent[0].link);
    expect(url.pathname).toBe('/ru/reset-password');
    const token = url.searchParams.get('token')!;
    await request(app.getHttpServer()).post('/api/v1/auth/reset-password').send({ token, password: 'brandnew123' }).expect(200);
    await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'brandnew123' }).expect(200);
  });

  it('renders the message in the user language and escapes the link', () => {
    const en = passwordResetMail('en', 'https://x.test/en/reset-password?token=a&b="c');
    expect(en.subject).toMatch(/Reset/);
    expect(en.html).toContain('token=a&amp;b=&quot;c');
    expect(passwordResetMail('ru', 'https://x.test').subject).toMatch(/Сброс/);
  });
});
