import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Customers (e2e)', () => {
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
    const organization = await prisma.organization.create({ data: { name: `Customers ${suffix}` } });
    const other = await prisma.organization.create({ data: { name: `Other customers ${suffix}` } });
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const admin = await prisma.user.create({ data: {
      organizationId, name: 'Customer Admin', email: `customer-admin-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.customer.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await app.close();
  });

  it('creates with the authenticated tenant and normalizes the document', async () => {
    const before = await prisma.customer.count({ where: { organizationId } });
    await request(app.getHttpServer()).post('/api/v1/customers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Injected tenant', document: '123.456.789-00', phone: '(85) 99999-0000', organizationId: otherOrganizationId }).expect(400);
    expect(await prisma.customer.count({ where: { organizationId } })).toBe(before);

    const response = await request(app.getHttpServer()).post('/api/v1/customers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Maria Silva', document: '123.456.789-00', phone: '(85) 99999-0000' }).expect(201);
    expect(response.body).toMatchObject({ organizationId, document: '12345678900', name: 'Maria Silva' });
  });

  it('rejects duplicate documents only inside the current Organization', async () => {
    await request(app.getHttpServer()).post('/api/v1/customers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate', document: '12345678900', phone: '9999' }).expect(409);
    await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Other customer', document: '12345678900', phone: '8888' } });
  });

  it('paginates with stable metadata and hides another Organization', async () => {
    const other = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Hidden customer', phone: '7777' } });
    const list = await request(app.getHttpServer()).get('/api/v1/customers?page=1&pageSize=1&sort=name&direction=asc')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(list.body.meta).toEqual(expect.objectContaining({ page: 1, pageSize: 1, total: 1, totalPages: 1 }));
    await request(app.getHttpServer()).get(`/api/v1/customers/${other.id}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/customers/${other.id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Changed' }).expect(404);
    await request(app.getHttpServer()).delete(`/api/v1/customers/${other.id}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
  });

  it('physically deletes an unused Customer', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/customers').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Unused', phone: '6666' }).expect(201);
    await request(app.getHttpServer()).delete(`/api/v1/customers/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(await prisma.customer.findFirst({ where: { id: created.body.id, organizationId } })).toBeNull();
  });
});
