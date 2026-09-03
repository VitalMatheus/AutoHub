import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { addCivilDays, recifeCivilDate, recifeMidnight } from '../../src/platform/billing/civil-dates';

describe('Platform Organizations and activation (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const superEmail = `platform-${Date.now()}@example.com`;
  const superPassword = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true } satisfies CanActivate)
      .compile();
    app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    await prisma.user.create({ data: { name: 'Platform Operator', email: superEmail, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(superPassword, { type: argon2.argon2id }) } });
  });

  afterAll(async () => { await prisma.user.delete({ where: { email: superEmail } }); await app.close(); });

  it('provisions an Organization and a pending first admin transactionally', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword }).expect(201);
    const email = `first-admin-${Date.now()}@example.com`;
    const response = await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${login.body.accessToken}`).send({ name: ' Oficina Central ', admin: { name: 'First Admin', email } }).expect(201);
    expect(response.body.activationToken).toEqual(expect.any(String));
    expect(response.body.organization.name).toBe('Oficina Central');
    const admin = await prisma.user.findUnique({ where: { email } });
    expect(admin).toEqual(expect.objectContaining({ status: 'PENDING_ACTIVATION', role: 'ADMIN' }));
    const account = await prisma.commercialAccount.findFirst({ where: { organizations: { some: { id: response.body.organization.id } } }, include: { subscriptions: true } });
    expect(account?.primaryContactUserId).toBe(admin!.id);
    expect(account?.subscriptions[0]).toEqual(expect.objectContaining({ trialEnabled: true, trialStartsAt: null, trialEndsAt: null }));
    const token = await prisma.actionToken.findFirst({ where: { userId: admin!.id } });
    expect(token).toEqual(expect.objectContaining({ usedAt: null }));
    expect(token!.tokenHash).not.toBe(response.body.activationToken);

    await request(app.getHttpServer()).post('/api/v1/auth/activate').send({ token: response.body.activationToken, password: 'new secure password 123' }).expect(201);
    const activatedSubscription = await prisma.subscription.findFirst({ where: { commercialAccountId: account!.id } });
    expect(activatedSubscription).toEqual(expect.objectContaining({ status: 'CURRENT', trialEnabled: true, trialStartsAt: expect.any(Date), trialEndsAt: expect.any(Date) }));
    expect(activatedSubscription!.trialEndsAt).toEqual(recifeMidnight(addCivilDays(recifeCivilDate(activatedSubscription!.trialStartsAt!), 14)));
    await request(app.getHttpServer()).post('/api/v1/auth/activate').send({ token: response.body.activationToken, password: 'another secure password' }).expect(401);
    expect((await prisma.user.findUnique({ where: { email } }))!.status).toBe('ACTIVE');
    const auditEvents = await prisma.auditEvent.findMany({ where: { commercialAccountId: account!.id } });
    expect(JSON.stringify(auditEvents)).not.toContain(response.body.activationToken);
  });

  it('allows disabling Trial but blocks operational access after activation', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword }).expect(201);
    const email = `no-trial-admin-${Date.now()}@example.com`;
    const response = await request(app.getHttpServer()).post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ name: 'No Trial Workshop', trialEnabled: false, admin: { name: 'No Trial Admin', email } }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/activate').send({ token: response.body.activationToken, password: 'new secure password 123' }).expect(201);
    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: 'new secure password 123' }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${adminLogin.body.accessToken}`).expect(200);
    await request(app.getHttpServer()).get('/api/v1/customers').set('Authorization', `Bearer ${adminLogin.body.accessToken}`).expect(403)
      .expect(({ body }) => expect(body.code).toBe('COMMERCIAL_ACCESS_BLOCKED'));
  });

  it('returns 403 to an Organization Admin on platform endpoints', async () => {
    const organization = await prisma.organization.create({ data: { name: `Tenant-${Date.now()}` } });
    const email = `tenant-admin-${Date.now()}@example.com`;
    await prisma.user.create({ data: { organizationId: organization.id, name: 'Tenant Admin', email, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(superPassword, { type: argon2.argon2id }) } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: superPassword }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/platform/organizations').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
    await request(app.getHttpServer()).get('/api/v1/platform/organizations/not-visible-to-admin').set('Authorization', `Bearer ${login.body.accessToken}`).expect(403);
  });

  it('enriches Organization search, combinable filters and detail for Super Admins', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword }).expect(201);
    const organization = await prisma.organization.create({ data: { name: `Searchable-${Date.now()}`, operationalStatus: 'ACTIVE' } });
    const list = await request(app.getHttpServer()).get('/api/v1/platform/organizations')
      .query({ search: organization.name.toLowerCase(), operationalStatus: 'ACTIVE', commercialAccess: 'PAYMENT_BLOCKED', sort: 'name', page: 1, pageSize: 10 })
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(list.body).toEqual(expect.objectContaining({ data: expect.any(Array), meta: expect.objectContaining({ page: 1, pageSize: 10 }) }));
    const detail = await request(app.getHttpServer()).get(`/api/v1/platform/organizations/${organization.id}`).set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(detail.body).toEqual(expect.objectContaining({ id: organization.id, commercialAccount: null, primaryContact: null, lifecycle: expect.any(Array), effectiveAccess: expect.any(Object), administrativePending: expect.any(Array) }));
  });

  it('exposes and filters Financial Standing independently from operational status', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword }).expect(201);
    const suffix = Date.now();
    const created = await request(app.getHttpServer()).post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ name: `Standing-${suffix}`, trialEnabled: false, admin: { name: 'Standing Admin', email: `standing-${suffix}@example.com` } }).expect(201);
    const today = recifeCivilDate(new Date());
    await request(app.getHttpServer()).post(`/api/v1/platform/organizations/${created.body.organization.id}/regularize-commercial-setup`)
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ contractedPrice: '79.00', firstDueDate: today, billingDay: Math.min(Number(today.slice(-2)), 28) }).expect(201);

    const response = await request(app.getHttpServer()).get('/api/v1/platform/organizations')
      .query({ search: `Standing-${suffix}`, operationalStatus: 'ACTIVE', financialStanding: 'CURRENT' })
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);

    expect(response.body.data).toEqual([expect.objectContaining({
      id: created.body.organization.id,
      operationalStatus: 'ACTIVE',
      financialStanding: expect.objectContaining({ status: 'CURRENT', dueToday: true, dueDate: expect.any(String) }),
    })]);
  });

  it('lists and idempotently regularizes Pending Commercial Setup without retroactive debt', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword }).expect(201);
    const suffix = Date.now();
    const created = await request(app.getHttpServer()).post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .send({ name: `Pending Setup-${suffix}`, admin: { name: 'Pending Admin', email: `pending-${suffix}@example.com` } }).expect(201);
    const organizationId = created.body.organization.id as string;
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { commercialAccountId: true } });
    const subscription = await prisma.subscription.findFirstOrThrow({ where: { commercialAccountId: organization.commercialAccountId } });
    await prisma.subscription.update({ where: { id: subscription.id }, data: { migratedAt: new Date('2026-01-01'), regularizedAt: null, firstDueDate: null, billingDay: null } });
    await prisma.subscriptionCharge.create({ data: {
      commercialAccountId: organization.commercialAccountId!, subscriptionId: subscription.id,
      amount: '79.00', dueDate: new Date('2026-08-29'), nature: 'RENEWAL',
    } });

    const pending = await request(app.getHttpServer()).get('/api/v1/platform/organizations')
      .query({ search: `Pending Setup-${suffix}`, lifecycle: 'PENDING_COMMERCIAL_SETUP' })
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(200);
    expect(pending.body.data).toEqual([expect.objectContaining({
      id: organizationId,
      lifecycle: expect.arrayContaining(['PENDING_COMMERCIAL_SETUP']),
      financialStanding: expect.objectContaining({ status: 'CURRENT', dueDate: null }),
      commercialAccess: 'ACCESS_ALLOWED',
      effectiveAccess: expect.objectContaining({ allowed: true }),
      payment: expect.objectContaining({ condition: 'PAID', outstandingAmount: '0.00' }),
    })]);

    const beforeCharges = await prisma.subscriptionCharge.count({ where: { subscriptionId: subscription.id } });
    const payload = { contractedPrice: '89.90', firstDueDate: '2026-10-10', billingDay: 10 };
    const endpoint = `/api/v1/platform/organizations/${organizationId}/regularize-commercial-setup`;
    const first = await request(app.getHttpServer()).post(endpoint).set('Authorization', `Bearer ${login.body.accessToken}`).send(payload).expect(201);
    const repeated = await request(app.getHttpServer()).post(endpoint).set('Authorization', `Bearer ${login.body.accessToken}`).send(payload).expect(201);
    expect(first.body).toEqual(expect.objectContaining({ id: organizationId, lifecycle: expect.not.arrayContaining(['PENDING_COMMERCIAL_SETUP']), commercialSetup: expect.objectContaining({ billingDay: 10 }) }));
    expect(repeated.body.commercialSetup).toEqual(first.body.commercialSetup);
    expect(await prisma.subscriptionCharge.count({ where: { subscriptionId: subscription.id } })).toBe(beforeCharges);
    expect(await prisma.user.count({ where: { organizationId } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { targetId: subscription.id, action: 'subscription.migrated_regularized' } })).toBe(1);

    await expect(prisma.subscription.update({ where: { id: subscription.id }, data: { billingDay: 29 } })).rejects.toThrow();
    await expect(prisma.subscription.update({ where: { id: subscription.id }, data: { firstDueDate: null } })).rejects.toThrow();
  });

  it('requires authentication for enriched Organization list and detail', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/organizations').expect(401);
    await request(app.getHttpServer()).get('/api/v1/platform/organizations/not-found').expect(401);
  });

  it('suspending an Organization revokes sessions and blocks the next request', async () => {
    const organization = await prisma.organization.create({ data: { name: `Suspended-${Date.now()}` } });
    const email = `suspended-admin-${Date.now()}@example.com`;
    await prisma.user.create({ data: { organizationId: organization.id, name: 'Suspended Admin', email, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(superPassword, { type: argon2.argon2id }) } });
    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password: superPassword }).expect(201);
    const platformLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/platform/organizations/${organization.id}/suspend`).set('Authorization', `Bearer ${platformLogin.body.accessToken}`).send({ reason: 'Security review' }).expect(201);
    await request(app.getHttpServer()).get('/api/v1/auth/me').set('Authorization', `Bearer ${adminLogin.body.accessToken}`).expect(401);
    expect(await prisma.session.count({ where: { user: { email }, revokedAt: { not: null } } })).toBe(1);
  });

  it('supports explicit operational transitions, idempotency and conflicts', async () => {
    const organization = await prisma.organization.create({ data: { name: `Transitions-${Date.now()}` } });
    const auth = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword });
    const base = `/api/v1/platform/organizations/${organization.id}`;
    await request(app.getHttpServer()).post(`${base}/suspend`).set('Authorization', `Bearer ${auth.body.accessToken}`).send({ reason: 'Review' }).expect(201);
    await request(app.getHttpServer()).post(`${base}/suspend`).set('Authorization', `Bearer ${auth.body.accessToken}`).send({ reason: 'Repeated' }).expect(201);
    await request(app.getHttpServer()).post(`${base}/reactivate`).set('Authorization', `Bearer ${auth.body.accessToken}`).expect(201);
    await request(app.getHttpServer()).post(`${base}/deactivate`).set('Authorization', `Bearer ${auth.body.accessToken}`).send({ reason: 'Closed' }).expect(201);
    await request(app.getHttpServer()).post(`${base}/suspend`).set('Authorization', `Bearer ${auth.body.accessToken}`).send({ reason: 'Invalid' }).expect(409);
    expect(await prisma.auditEvent.count({ where: { organizationId: organization.id, action: 'organization.suspended' } })).toBe(1);
  });

  it('requires a reason for suspension and deactivation', async () => {
    const organization = await prisma.organization.create({ data: { name: `Reason-${Date.now()}` } });
    const auth = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: superEmail, password: superPassword });
    const base = `/api/v1/platform/organizations/${organization.id}`;
    await request(app.getHttpServer()).post(`${base}/suspend`).set('Authorization', `Bearer ${auth.body.accessToken}`).send({}).expect(400);
    await request(app.getHttpServer()).post(`${base}/deactivate`).set('Authorization', `Bearer ${auth.body.accessToken}`).send({}).expect(400);
  });
});
