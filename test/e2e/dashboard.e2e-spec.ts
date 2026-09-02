import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Commercial Dashboard (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superToken: string;
  let adminToken: string;
  let superUserId: string;
  let adminUserId: string;
  let organizationId: string;
  const suffix = Date.now();
  const password = 'correct horse battery staple';
  const superEmail = `dashboard-super-${suffix}@example.com`;
  const adminEmail = `dashboard-admin-${suffix}@example.com`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const superUser = await prisma.user.create({ data: { name: 'Dashboard Super Admin', email: superEmail, passwordHash: hash, role: 'SUPER_ADMIN', status: 'ACTIVE' } });
    superUserId = superUser.id;
    const organization = await prisma.organization.create({ data: { name: `Dashboard Organization ${suffix}` } });
    organizationId = organization.id;
    const admin = await prisma.user.create({ data: { name: 'Dashboard Admin', email: adminEmail, passwordHash: hash, role: 'ADMIN', status: 'ACTIVE', organizationId } });
    adminUserId = admin.id;
    superToken = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password }).expect(201)).body.accessToken;
    adminToken = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: adminEmail, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => {
    await prisma.user.delete({ where: { id: adminUserId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.delete({ where: { id: superUserId } });
    await app.close();
  });

  it('returns a consistent commercial snapshot to Super Admin only', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/dashboard').query({ asOf: '2026-01-20T12:00:00.000Z' }).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(response.body).toEqual(expect.objectContaining({ referenceAt: '2026-01-20T12:00:00.000Z', timezone: 'America/Recife', organizations: expect.any(Object), subscriptions: expect.any(Object), financial: expect.any(Object) }));
    expect(response.body.financial.mrr).toMatch(/^\d+\.\d{2}$/);
    expect(response.body.series).toHaveLength(12);
    expect(response.body.series[11]).toEqual(expect.objectContaining({ month: '2026-01', mrr: expect.stringMatching(/^\d+\.\d{2}$/), organizations: expect.any(Number), receivedRevenue: expect.stringMatching(/^\d+\.\d{2}$/) }));
  });

  it('accepts a bounded custom monthly interval', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/dashboard').query({ asOf: '2026-01-20T12:00:00.000Z', from: '2025-11', to: '2026-01' }).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(response.body.series.map((point: { month: string }) => point.month)).toEqual(['2025-11', '2025-12', '2026-01']);
  });

  it('rejects unauthenticated and Organization Admin requests', async () => {
    await request(app.getHttpServer()).get('/api/v1/dashboard').expect(401);
    await request(app.getHttpServer()).get('/api/v1/dashboard').set('Authorization', `Bearer ${adminToken}`).expect(403);
  });
});
