import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Services (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let otherOrganizationId: string;
  let adminToken: string;
  const suffix = Date.now();
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const organization = await prisma.organization.create({ data: { name: `Services ${suffix}` } });
    const other = await prisma.organization.create({ data: { name: `Other services ${suffix}` } });
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const admin = await prisma.user.create({ data: {
      organizationId, name: 'Service Admin', email: `service-admin-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.service.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await app.close();
  });

  it('creates a tenant-scoped Service and returns its Decimal price as a string', async () => {
    const before = await prisma.service.count({ where: { organizationId } });
    await request(app.getHttpServer()).post('/api/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Injected tenant', price: '149.90', organizationId: otherOrganizationId })
      .expect(400);
    expect(await prisma.service.count({ where: { organizationId } })).toBe(before);

    const response = await request(app.getHttpServer()).post('/api/v1/services')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Oil change', description: 'Labor', price: '149.90' })
      .expect(201);
    expect(response.body).toMatchObject({ organizationId, name: 'Oil change', price: '149.90', active: true });
  });

  it('excludes deactivated Services from the default list but supports active filtering', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/services').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Brake inspection', price: '99.00' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/services/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`).expect(201);

    const defaultList = await request(app.getHttpServer()).get('/api/v1/services?search=Brake')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(defaultList.body.meta.total).toBe(0);
    const inactiveList = await request(app.getHttpServer()).get('/api/v1/services?active=false&sort=price&direction=desc&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(inactiveList.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id, active: false, price: '99.00' })]));
  });

  it('returns 404 for another Organization on read and mutation', async () => {
    const other = await prisma.service.create({ data: { organizationId: otherOrganizationId, name: 'Hidden service', price: '10.00' } });
    await request(app.getHttpServer()).get(`/api/v1/services/${other.id}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/services/${other.id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Changed' }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/services/${other.id}/deactivate`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    expect((await prisma.service.findUnique({ where: { id: other.id } }))?.name).toBe('Hidden service');
  });
});
