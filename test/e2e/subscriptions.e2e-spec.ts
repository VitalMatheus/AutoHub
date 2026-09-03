import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Platform Subscriptions (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService; let accountId: string; let subscriptionId: string; let adminId: string; let planVersionId: string;
  let superToken: string; let adminToken: string; const suffix = Date.now(); const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const operator = await prisma.user.create({ data: { name: 'Subscription Operator', email: `subscription-super-${suffix}@example.com`, passwordHash: hash, role: 'SUPER_ADMIN', status: 'ACTIVE' } });
    const account = await prisma.commercialAccount.create({ data: { name: `Subscription Account ${suffix}` } }); accountId = account.id;
    const organization = await prisma.organization.create({ data: { name: `Subscription Unit ${suffix}`, commercialAccountId: account.id } });
    const admin = await prisma.user.create({ data: { organizationId: organization.id, name: 'Subscription Admin', email: `subscription-admin-${suffix}@example.com`, passwordHash: hash, role: 'ADMIN', status: 'ACTIVE' } }); adminId = admin.id;
    const version = await prisma.planVersion.findFirstOrThrow({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } }); planVersionId = version.id;
    const subscription = await prisma.subscription.create({ data: { commercialAccountId: account.id, planVersionId: version.id, migratedAt: new Date('2026-01-01'), contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval, contractedOrganizationLimit: version.organizationLimit, contractedUserLimit: version.userLimit, contractedWorkOrderLimit: version.workOrderLimit, contractedGracePeriodDays: version.gracePeriodDays, trialEnabled: false } }); subscriptionId = subscription.id;
    superToken = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: operator.email, password }).expect(201)).body.accessToken;
    adminToken = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => {
    await prisma.auditEvent.deleteMany({ where: { commercialAccountId: accountId } });
    await prisma.chargeSettlement.deleteMany({ where: { charge: { commercialAccountId: accountId } } });
    await prisma.subscriptionCharge.deleteMany({ where: { commercialAccountId: accountId } });
    await prisma.subscription.deleteMany({ where: { commercialAccountId: accountId } });
    await prisma.user.delete({ where: { id: adminId } }); await prisma.organization.deleteMany({ where: { commercialAccountId: accountId } }); await prisma.commercialAccount.delete({ where: { id: accountId } });
    await prisma.user.deleteMany({ where: { email: { startsWith: `subscription-super-${suffix}` } } }); await app.close();
  });

  it('lists pending migrated subscriptions and regularizes them through an audited action', async () => {
    const listed = await request(app.getHttpServer()).get('/api/v1/platform/subscriptions').set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(listed.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: subscriptionId, contractedPrice: '79.00', conditions: expect.objectContaining({ pendingCommercialSetup: true, trial: false }) })]));
    const regularized = await request(app.getHttpServer()).post(`/api/v1/platform/subscriptions/${subscriptionId}/regularize`).set('Authorization', `Bearer ${superToken}`).send({ commercialStartAt: '2026-02-01T00:00:00.000Z', firstPaymentReceivedAt: '2026-02-01T00:00:00.000Z', reason: 'Regularização da migração' }).expect(201);
    expect(regularized.body).toEqual(expect.objectContaining({ regularizationReason: 'Regularização da migração', conditions: expect.objectContaining({ pendingCommercialSetup: true, awaitingFirstPayment: false }) }));
    expect(await prisma.auditEvent.findFirst({ where: { targetId: subscriptionId, action: 'subscription.migrated_regularized' } })).not.toBeNull();
  });

  it('keeps subscription administration exclusive to Super Admins', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/subscriptions').expect(401);
    await request(app.getHttpServer()).get('/api/v1/platform/subscriptions').set('Authorization', `Bearer ${adminToken}`).expect(403);
  });

  it('ends a Subscription without deleting history and allows a new isolated contract', async () => {
    const oldCharge = await prisma.subscriptionCharge.create({
      data: { commercialAccountId: accountId, subscriptionId, amount: '79.00', dueDate: new Date('2026-09-01T03:00:00.000Z'), nature: 'RENEWAL' },
    });

    await request(app.getHttpServer()).post(`/api/v1/platform/subscriptions/${subscriptionId}/cancel-immediately`)
      .set('Authorization', `Bearer ${superToken}`).send({ reason: 'Encerramento solicitado pela oficina' }).expect(201);

    const oldAfterCancellation = await prisma.subscription.findUniqueOrThrow({ where: { id: subscriptionId } });
    expect(oldAfterCancellation.status).toBe('ENDED');
    expect(await prisma.subscriptionCharge.findUnique({ where: { id: oldCharge.id } })).not.toBeNull();
    expect(await prisma.organization.findUnique({ where: { commercialAccountId: accountId } })).not.toBeNull();
    await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${oldCharge.id}/administrative-settlement`)
      .set('Authorization', `Bearer ${superToken}`).send({ amount: '79.00', method: 'BANK_TRANSFER', effectiveAt: new Date(Date.now() - 60_000).toISOString(), reason: 'Quitação após cancelamento' }).expect(201)
      .expect(({ body }) => expect(body.outstandingAmount).toBe('0.00'));

    const recontrated = await request(app.getHttpServer()).post('/api/v1/platform/subscriptions')
      .set('Authorization', `Bearer ${superToken}`).send({ commercialAccountId: accountId, planVersionId, trialEnabled: false }).expect(201);
    expect(recontrated.body.id).not.toBe(subscriptionId);
    expect(recontrated.body.status).toBe('CURRENT');

    const subscriptions = await prisma.subscription.findMany({ where: { commercialAccountId: accountId }, orderBy: { createdAt: 'asc' } });
    expect(subscriptions).toHaveLength(2);
    expect(subscriptions[0].status).toBe('ENDED');
    expect(subscriptions[1].status).toBe('CURRENT');
    expect(await prisma.subscriptionCharge.count({ where: { subscriptionId } })).toBe(1);
    expect(await prisma.subscriptionCharge.count({ where: { subscriptionId: recontrated.body.id } })).toBe(1);
    expect(await prisma.auditEvent.count({ where: { commercialAccountId: accountId, action: 'subscription.cancelled' } })).toBeGreaterThanOrEqual(1);
    expect(await prisma.auditEvent.count({ where: { targetId: recontrated.body.id, action: 'subscription.created' } })).toBe(1);
  });
});
