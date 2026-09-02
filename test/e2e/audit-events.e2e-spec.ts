import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Platform audit events (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const password = 'correct horse battery staple';
  const suffix = Date.now();
  const superEmail = `audit-super-${suffix}@example.com`;
  const adminEmail = `audit-admin-${suffix}@example.com`;
  let superToken: string;
  let organizationId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(); configureApplication(app); await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({ data: { name: 'Audit Operator', email: superEmail, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password }).expect(201);
    superToken = login.body.accessToken;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { actorUser: { email: { in: [superEmail, adminEmail] } } } });
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.user.deleteMany({ where: { email: { in: [superEmail, adminEmail] } } });
    await app.close();
  });

  it('records a safe, read-only timeline and filters it by actor/action/target', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${superToken}`)
      .send({ name: `Audited ${suffix}`, admin: { name: 'Audited Admin', email: adminEmail } }).expect(201);
    organizationId = created.body.organization.id;

    const response = await request(app.getHttpServer()).get('/api/v1/platform/audit-events')
      .query({ actor: (await prisma.user.findUniqueOrThrow({ where: { email: superEmail }, select: { id: true } })).id, action: 'organization.created', targetType: 'ORGANIZATION', target: organizationId, pageSize: 1 })
      .set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(expect.objectContaining({ action: 'organization.created', target: { type: 'ORGANIZATION', id: organizationId } }));
    expect(response.body.data[0].actor).toEqual(expect.objectContaining({ type: 'USER', name: 'Audit Operator', email: superEmail }));
    expect(response.body.data[0]).not.toHaveProperty('activationToken');
    expect(JSON.stringify(response.body)).not.toContain(created.body.activationToken);
  });

  it('requires Super Admin access', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/audit-events').expect(401);
    const organization = await prisma.organization.create({ data: { name: `Audit tenant ${suffix}` } });
    const admin = await prisma.user.create({ data: { organizationId: organization.id, name: 'Tenant Admin', email: `tenant-audit-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/platform/audit-events').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
    await prisma.user.delete({ where: { id: admin.id } }); await prisma.organization.delete({ where: { id: organization.id } });
  });
});
