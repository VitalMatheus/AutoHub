import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Platform Plans (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let superToken: string;
  let tenantToken: string;
  let tenantUserId: string;
  let tenantOrganizationId: string;
  const suffix = Date.now();
  const password = 'correct horse battery staple';
  const superEmail = `plans-super-${suffix}@example.com`;
  const tenantEmail = `plans-tenant-${suffix}@example.com`;
  const createdPlanIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.plan.update({ where: { id: '00000000-0000-4000-8000-000000000037' }, data: { archivedAt: null } });

    await prisma.user.create({ data: {
      name: 'Plans Operator', email: superEmail, role: 'SUPER_ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const superLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password }).expect(201);
    superToken = superLogin.body.accessToken;

    const organization = await prisma.organization.create({ data: { name: `Plans tenant ${suffix}` } });
    tenantOrganizationId = organization.id;
    const tenant = await prisma.user.create({ data: {
      organizationId: organization.id, name: 'Plans Tenant', email: tenantEmail, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    tenantUserId = tenant.id;
    const tenantLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: tenantEmail, password }).expect(201);
    tenantToken = tenantLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.subscription.deleteMany({ where: { planVersion: { planId: { in: createdPlanIds } } } });
    await prisma.planVersion.deleteMany({ where: { planId: { in: createdPlanIds } } });
    await prisma.auditEvent.deleteMany({ where: { actorUser: { email: superEmail } } });
    await prisma.user.delete({ where: { id: tenantUserId } });
    await prisma.organization.delete({ where: { id: tenantOrganizationId } });
    await prisma.user.delete({ where: { email: superEmail } });
    await app.close();
  });

  it('exposes the seeded Basic Plan with its published commercial conditions', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/platform/plans').set('Authorization', `Bearer ${superToken}`).expect(200);
    const basic = response.body.data.find((plan: { name: string }) => plan.name === 'AutoHub Básico');
    expect(basic).toEqual(expect.objectContaining({ name: 'AutoHub Básico', archivedAt: null }));
    expect(basic.versions).toEqual(expect.arrayContaining([
      expect.objectContaining({ status: 'PUBLISHED', price: '79.00', currency: 'BRL', interval: 'MONTHLY', organizationLimit: 1, userLimit: 3, workOrderLimit: null }),
    ]));
  });

  it('allows a Super Admin to create, edit and publish an immutable Plan Version', async () => {
    const plan = await request(app.getHttpServer()).post('/api/v1/platform/plans').set('Authorization', `Bearer ${superToken}`).send({ name: `Pro ${suffix}` }).expect(201);
    createdPlanIds.push(plan.body.id);
    const draft = await request(app.getHttpServer()).post(`/api/v1/platform/plans/${plan.body.id}/versions`).set('Authorization', `Bearer ${superToken}`).send({ price: '129,90', organizationLimit: 2, userLimit: 10, workOrderLimit: null }).expect(201);
    expect(draft.body).toMatchObject({ version: 1, status: 'DRAFT', price: '129.90', currency: 'BRL', interval: 'MONTHLY', workOrderLimit: null });

    const updated = await request(app.getHttpServer()).patch(`/api/v1/platform/plans/${plan.body.id}/versions/${draft.body.id}`).set('Authorization', `Bearer ${superToken}`).send({ price: '139.90', organizationLimit: 2, userLimit: 10, workOrderLimit: null }).expect(200);
    expect(updated.body.price).toBe('139.90');
    const published = await request(app.getHttpServer()).post(`/api/v1/platform/plans/${plan.body.id}/versions/${draft.body.id}/publish`).set('Authorization', `Bearer ${superToken}`).expect(201);
    expect(published.body).toMatchObject({ status: 'PUBLISHED', price: '139.90' });
    await request(app.getHttpServer()).patch(`/api/v1/platform/plans/${plan.body.id}/versions/${draft.body.id}`).set('Authorization', `Bearer ${superToken}`).send({ price: '149.90', organizationLimit: 2, userLimit: 10 }).expect(409);
    await request(app.getHttpServer()).delete(`/api/v1/platform/plans/${plan.body.id}/versions/${draft.body.id}`).set('Authorization', `Bearer ${superToken}`).expect(409);
  });

  it('protects used versions and archives an eligible Plan', async () => {
    const plan = await request(app.getHttpServer()).post('/api/v1/platform/plans').set('Authorization', `Bearer ${superToken}`).send({ name: `Archive ${suffix}` }).expect(201);
    createdPlanIds.push(plan.body.id);
    const version = await request(app.getHttpServer()).post(`/api/v1/platform/plans/${plan.body.id}/versions`).set('Authorization', `Bearer ${superToken}`).send({ price: '49.00', organizationLimit: 1, userLimit: 1 }).expect(201);
    await prisma.subscription.create({ data: { planVersionId: version.body.id } });
    await request(app.getHttpServer()).delete(`/api/v1/platform/plans/${plan.body.id}/versions/${version.body.id}`).set('Authorization', `Bearer ${superToken}`).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/platform/plans/${plan.body.id}/archive`).set('Authorization', `Bearer ${superToken}`).expect(201);
    const eligible = await request(app.getHttpServer()).post('/api/v1/platform/plans').set('Authorization', `Bearer ${superToken}`).send({ name: `Eligible ${suffix}` }).expect(201);
    createdPlanIds.push(eligible.body.id);
    const publishedVersion = await request(app.getHttpServer()).post(`/api/v1/platform/plans/${eligible.body.id}/versions`).set('Authorization', `Bearer ${superToken}`).send({ price: '59.00', organizationLimit: 1, userLimit: 1 }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/platform/plans/${eligible.body.id}/versions/${publishedVersion.body.id}/publish`).set('Authorization', `Bearer ${superToken}`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/platform/plans/${eligible.body.id}/archive`).set('Authorization', `Bearer ${superToken}`).expect(201);
    const archived = await request(app.getHttpServer()).get(`/api/v1/platform/plans/${eligible.body.id}`).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(archived.body.archivedAt).toEqual(expect.any(String));
  });

  it('keeps platform Plan operations exclusive to Super Admins', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/plans').set('Authorization', `Bearer ${tenantToken}`).expect(403);
    await request(app.getHttpServer()).post('/api/v1/platform/plans').set('Authorization', `Bearer ${tenantToken}`).send({ name: `Forbidden ${suffix}` }).expect(403);
  });
});
