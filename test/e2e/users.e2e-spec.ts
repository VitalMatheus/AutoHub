import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Organization Users (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct horse battery staple';
  const suffix = Date.now();
  let organizationId: string;
  let otherOrganizationId: string;
  let adminId: string;
  let adminToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const organization = await prisma.organization.create({ data: { name: `Users ${suffix}` } });
    const other = await prisma.organization.create({ data: { name: `Other ${suffix}` } });
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const admin = await prisma.user.create({ data: {
      organizationId, name: 'Organization Admin', email: `admin-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    adminId = admin.id;
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: admin.email, password }).expect(201);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await app.close();
  });

  it('lists only Users from the authenticated Organization', async () => {
    await prisma.user.create({ data: {
      organizationId: otherOrganizationId, name: 'Other Admin', email: `other-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const response = await request(app.getHttpServer()).get('/api/v1/organizations/users')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(response.body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: adminId, organizationId, role: 'ADMIN' }),
    ]));
    expect(response.body).not.toEqual(expect.arrayContaining([
      expect.objectContaining({ organizationId: otherOrganizationId }),
    ]));
  });

  it('invites only an ADMIN to the current Organization and returns a one-time activation token', async () => {
    const email = `invited-${suffix}@example.com`;
    const response = await request(app.getHttpServer()).post('/api/v1/organizations/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Invited Admin', email, role: 'SUPER_ADMIN', organizationId: otherOrganizationId })
      .expect(400);
    expect(response.body).toMatchObject({ status: 400, code: 'HTTP_400' });

    const invited = await request(app.getHttpServer()).post('/api/v1/organizations/users')
      .set('Authorization', `Bearer ${adminToken}`).send({ name: 'Invited Admin', email }).expect(201);
    expect(invited.body.user).toEqual(expect.objectContaining({ name: 'Invited Admin', email, role: 'ADMIN', organizationId }));
    expect(invited.body.user).not.toHaveProperty('passwordHash');
    expect(invited.body.activationToken).toEqual(expect.any(String));

    const activation = await request(app.getHttpServer()).post('/api/v1/auth/activate')
      .send({ token: invited.body.activationToken, password }).expect(201);
    expect(activation.body).toEqual({ success: true });
    await request(app.getHttpServer()).post('/api/v1/auth/activate')
      .send({ token: invited.body.activationToken, password }).expect(401);
  });

  it('returns 404 and does not mutate a User from another Organization', async () => {
    const other = await prisma.user.create({ data: {
      organizationId: otherOrganizationId, name: 'Hidden Admin', email: `hidden-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    await request(app.getHttpServer()).post(`/api/v1/organizations/users/${other.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`).expect(404)
      .expect(({ body }) => expect(body).toMatchObject({ status: 404, code: 'HTTP_404' }));
    await request(app.getHttpServer()).post(`/api/v1/organizations/users/${other.id}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`).expect(404);
    expect((await prisma.user.findUnique({ where: { id: other.id } }))!.status).toBe('ACTIVE');
  });

  it('deactivation and session revocation apply to the next protected request', async () => {
    const email = `lifecycle-${suffix}@example.com`;
    const user = await prisma.user.create({ data: {
      organizationId, name: 'Lifecycle Admin', email, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/organizations/users/${user.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`).expect(201);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${login.body.accessToken}`).expect(401);

    await request(app.getHttpServer()).post(`/api/v1/organizations/users/${user.id}/activate`)
      .set('Authorization', `Bearer ${adminToken}`).expect(201);
    const reactivated = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/organizations/users/${user.id}/revoke-sessions`)
      .set('Authorization', `Bearer ${adminToken}`).expect(201);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${reactivated.body.accessToken}`).expect(401);
  });
});
