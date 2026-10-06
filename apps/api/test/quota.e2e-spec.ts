import 'dotenv/config';
process.env.MAX_APPLICATIONS_PER_USER = '3';
process.env.MAX_DICTIONARY_ITEMS_PER_USER = '30';

import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { ImportService } from '../src/integrations/import.service';

const email = `e2e-quota-${Date.now()}@heyreply.test`;

describe('per-user quotas (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let importer: ImportService;
  let jar: string[];
  let userId: string;

  const add = (n: number) =>
    request(app.getHttpServer()).post('/api/v1/applications').set('Cookie', jar).send({ companyName: `Co ${n}`, positionName: 'Dev' });

  beforeAll(async () => {
    const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = mod.createNestApplication();
    app.setGlobalPrefix('api/v1', { exclude: ['api/health'] });
    app.use(cookieParser());
    await app.init();
    prisma = app.get(PrismaService);
    importer = app.get(ImportService);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({ name: 'Q', email, password: 'testpass123', acceptTerms: true, acceptPersonalData: true })
      .expect(201);
    jar = ((res.headers['set-cookie'] as unknown as string[]) ?? []).map((c) => c.split(';')[0]);
    userId = res.body.user.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email } });
    await app.close();
  });

  it('rejects applications over the cap, from the API and from imports', async () => {
    const ids: string[] = [];
    for (let i = 1; i <= 3; i++) ids.push((await add(i).expect(201)).body.id);
    const over = await add(4).expect(422);
    expect(over.body.code ?? over.body.message?.code).toBe('APPLICATION_LIMIT');

    const r = await importer.importBatch(userId, [{ platform: 'hh', externalId: 'q-1', companyName: 'Imp', positionName: 'Dev', origin: 'apply' }]);
    expect(r.items).toEqual(['error']);
    expect(r.errors[0].message).toBe('APPLICATION_LIMIT');

    // deleting frees a slot; restoring over the cap is refused
    await request(app.getHttpServer()).delete(`/api/v1/applications/${ids[0]}`).set('Cookie', jar).expect(200);
    await add(5).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/applications/${ids[0]}/restore`).set('Cookie', jar).expect(422);
  });

  it('caps dictionary entries but still reuses existing ones', async () => {
    const dict = (name: string) => request(app.getHttpServer()).post('/api/v1/dictionaries/tags').set('Cookie', jar).send({ name });
    const existing = await prisma.tag.count({ where: { userId } });
    for (let i = existing; i < 30; i++) await dict(`tag-${i}`).expect(201);
    const over = await dict('one-too-many').expect(422);
    expect(over.body.code ?? over.body.message?.code).toBe('DICT_LIMIT');
    await dict('TAG-0').expect(201); // same normalized name: not a new entry
  });
});
