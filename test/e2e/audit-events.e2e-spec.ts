import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { AuditEventsService } from '../../src/platform/audit-events/audit-events.service';

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
    await prisma.user.deleteMany({ where: { email: { in: [superEmail, adminEmail] } } });
    if (organizationId) await prisma.organization.delete({ where: { id: organizationId } });
    await app.close();
  });

  it('records a safe, read-only timeline and filters it by actor/action/target', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${superToken}`)
      .send({ name: `Audited ${suffix}`, phone: '81999990000', firstDueDate: '2026-10-10', billingDay: 10, admin: { name: 'Audited Admin', email: adminEmail } }).expect(201);
    organizationId = created.body.organization.id;

    const response = await request(app.getHttpServer()).get('/api/v1/platform/audit-events')
      .query({ actor: (await prisma.user.findUniqueOrThrow({ where: { email: superEmail }, select: { id: true } })).id, action: 'organization.created', targetType: 'ORGANIZATION', target: organizationId, pageSize: 1 })
      .set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toEqual(expect.objectContaining({ action: 'organization.created', target: { type: 'ORGANIZATION', id: organizationId } }));
    expect(response.body.data[0].actor).toEqual(expect.objectContaining({ type: 'USER', name: 'Audit Operator', email: superEmail }));
    expect(response.body.data[0]).not.toHaveProperty('activationToken');
    expect(JSON.stringify(response.body)).not.toContain(created.body.activationSecret);

    const superUser = await prisma.user.findUniqueOrThrow({ where: { email: superEmail }, select: { id: true } });
    await prisma.auditEvent.createMany({ data: [
      { actorType: 'USER', actorUserId: superUser.id, actorName: 'Audit Operator', actorEmail: superEmail, occurredAt: new Date('2026-01-02T00:00:00.000Z'), action: 'organization.updated', targetType: 'ORGANIZATION', targetId: organizationId, organizationId, after: { name: 'Historical second' } },
      { actorType: 'USER', actorUserId: superUser.id, actorName: 'Audit Operator', actorEmail: superEmail, occurredAt: new Date('2026-01-01T00:00:00.000Z'), action: 'organization.updated', targetType: 'ORGANIZATION', targetId: organizationId, organizationId, after: { name: 'Historical first' } },
    ] });
    const firstPage = await request(app.getHttpServer()).get('/api/v1/platform/audit-events')
      .query({ action: 'organization.updated', target: organizationId, pageSize: 1 }).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(firstPage.body.data).toHaveLength(1);
    expect(firstPage.body.meta.nextCursor).toEqual(expect.any(String));
    const secondPage = await request(app.getHttpServer()).get('/api/v1/platform/audit-events')
      .query({ action: 'organization.updated', target: organizationId, pageSize: 1, cursor: firstPage.body.meta.nextCursor }).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(secondPage.body.data).toHaveLength(1);
    expect(secondPage.body.data[0].id).not.toBe(firstPage.body.data[0].id);
    const period = await request(app.getHttpServer()).get('/api/v1/platform/audit-events')
      .query({ action: 'organization.updated', target: organizationId, from: '2026-01-02T00:00:00.000Z', to: '2026-01-03T00:00:00.000Z' }).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(period.body.data).toHaveLength(1);
  });

  it('requires Super Admin access', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/audit-events').expect(401);
    const organization = await prisma.organization.create({ data: { name: `Audit tenant ${suffix}` } });
    const admin = await prisma.user.create({ data: { organizationId: organization.id, name: 'Tenant Admin', email: `tenant-audit-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/platform/audit-events').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
    await prisma.user.delete({ where: { id: admin.id } }); await prisma.organization.delete({ where: { id: organization.id } });
  });

  it('does not persist an organization or audit event when provisioning fails', async () => {
    await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${superToken}`)
      .send({ name: `Rolled back ${suffix}`, phone: '81999990000', firstDueDate: '2026-10-10', billingDay: 10, admin: { name: 'Duplicate Admin', email: adminEmail } }).expect(409);

    expect(await prisma.organization.count({ where: { name: `Rolled back ${suffix}` } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { action: 'organization.created', after: { path: ['name'], equals: `Rolled back ${suffix}` } } })).toBe(0);
  });

  it('rolls back provisioning when audit persistence fails inside the transaction', async () => {
    const name = `Audit failure ${suffix}`;
    const email = `audit-failure-${suffix}@example.com`;
    const auditEvents = app.get(AuditEventsService);
    const record = jest.spyOn(auditEvents, 'record').mockRejectedValueOnce(new Error('forced audit failure'));

    await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${superToken}`)
      .send({ name, phone: '81999990000', firstDueDate: '2026-10-10', billingDay: 10, admin: { name: 'Rolled Back Admin', email } }).expect(500);
    record.mockRestore();

    expect(await prisma.organization.count({ where: { name } })).toBe(0);
    expect(await prisma.user.count({ where: { email } })).toBe(0);
    expect(await prisma.actionToken.count({ where: { user: { email } } })).toBe(0);
    expect(await prisma.auditEvent.count({ where: { action: 'organization.created', after: { path: ['name'], equals: name } } })).toBe(0);
  });

  it('keeps the timeline append-only at the HTTP surface', async () => {
    await request(app.getHttpServer()).post('/api/v1/platform/audit-events').set('Authorization', `Bearer ${superToken}`).send({}).expect(404);
    await request(app.getHttpServer()).patch('/api/v1/platform/audit-events/event-id').set('Authorization', `Bearer ${superToken}`).send({}).expect(404);
    await request(app.getHttpServer()).delete('/api/v1/platform/audit-events/event-id').set('Authorization', `Bearer ${superToken}`).expect(404);
  });
});
