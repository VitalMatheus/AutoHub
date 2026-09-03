import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';
import { addCivilDays, recifeCivilDate, recifeMidnight } from '../../src/platform/billing/civil-dates';

describe('Subscription Charges and Settlements (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `charges-admin-${Date.now()}@example.com`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard).useValue({ canActivate: () => true } satisfies CanActivate)
      .compile();
    app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    await prisma.user.create({ data: { name: 'Charges Operator', email, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
  });

  afterAll(async () => { await prisma.user.delete({ where: { email } }); await app.close(); });

  it('derives balances, accepts partial settlement, and replays provider deliveries idempotently', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
    const adminEmail = `admin-${Date.now()}@example.com`;
    const provisioned = await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${login.body.accessToken}`).send({ name: `Charge Workshop ${Date.now()}`, phone: '81999990000', firstDueDate: '2026-10-10', billingDay: 10, admin: { name: 'Charges Admin', email: adminEmail } }).expect(201);
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: provisioned.body.organization.id }, select: { commercialAccountId: true } });
    const subscription = await prisma.subscription.findFirstOrThrow({ where: { commercialAccountId: organization.commercialAccountId }, select: { id: true } });
    const charge = await request(app.getHttpServer()).post('/api/v1/platform/subscription-charges').set('Authorization', `Bearer ${login.body.accessToken}`).send({ commercialAccountId: organization.commercialAccountId, subscriptionId: subscription.id, amount: '100.00', dueDate: '2099-01-01', nature: 'FIRST_PAYMENT', provider: 'manual-test', externalId: `charge-${Date.now()}` }).expect(201);
    await request(app.getHttpServer()).post('/api/v1/auth/activate').send({ token: provisioned.body.activationSecret, password }).expect(201);
    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: adminEmail, password }).expect(201);
    const accountCharge = await request(app.getHttpServer()).get('/api/v1/account/subscription-charge').set('Authorization', `Bearer ${adminLogin.body.accessToken}`).expect(200);
    expect(accountCharge.body).toEqual(expect.objectContaining({ id: charge.body.id, organizationId: provisioned.body.organization.id, amount: '100.00', outstandingAmount: '100.00' }));
    expect(accountCharge.body).not.toHaveProperty('provider');
    expect(accountCharge.body).not.toHaveProperty('externalId');
    expect(charge.body).toEqual(expect.objectContaining({ amount: '100.00', condition: 'PENDING', paidAmount: '0.00', outstandingAmount: '100.00' }));

    const settlement = { amount: '40.00', receivedAt: new Date().toISOString(), provider: 'manual-test', externalId: `settlement-${Date.now()}` };
    const partial = await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/settlements`).set('Authorization', `Bearer ${login.body.accessToken}`).send(settlement).expect(201);
    expect(partial.body).toEqual(expect.objectContaining({ condition: 'PARTIALLY_PAID', paidAmount: '40.00', outstandingAmount: '60.00' }));
    const replay = await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/settlements`).set('Authorization', `Bearer ${login.body.accessToken}`).send(settlement).expect(201);
    expect(replay.body.paidAmount).toBe('40.00');
    expect(await prisma.chargeSettlement.count({ where: { provider: settlement.provider, externalId: settlement.externalId } })).toBe(1);
  });

  it('rejects amount changes after settlement and preserves an audit trail', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
    const account = await prisma.commercialAccount.findFirstOrThrow({ orderBy: { createdAt: 'desc' }, select: { id: true, subscriptions: { take: 1, orderBy: { createdAt: 'desc' }, select: { id: true } } } });
    const charge = await request(app.getHttpServer()).post('/api/v1/platform/subscription-charges').set('Authorization', `Bearer ${login.body.accessToken}`).send({ commercialAccountId: account.id, subscriptionId: account.subscriptions[0].id, amount: '50.00', dueDate: '2099-01-01', nature: 'EXTRAORDINARY' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/settlements`).set('Authorization', `Bearer ${login.body.accessToken}`).send({ amount: '10.00', receivedAt: new Date().toISOString() }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/platform/subscription-charges/${charge.body.id}`).set('Authorization', `Bearer ${login.body.accessToken}`).send({ amount: '60.00', reason: 'Correction' }).expect(409);
    expect(await prisma.auditEvent.count({ where: { targetType: 'SUBSCRIPTION_CHARGE', targetId: charge.body.id } })).toBeGreaterThanOrEqual(1);
  });

  it('allows only one integral administrative settlement and records its origin', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
    const adminEmail = `administrative-${Date.now()}@example.com`;
    const provisioned = await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${login.body.accessToken}`).send({ name: `Administrative Workshop ${Date.now()}`, phone: '81999990000', firstDueDate: '2026-10-10', billingDay: 10, admin: { name: 'Workshop Admin', email: adminEmail } }).expect(201);
    const account = await prisma.organization.findUniqueOrThrow({ where: { id: provisioned.body.organization.id }, select: { id: true, commercialAccountId: true } });
    const subscription = await prisma.subscription.findFirstOrThrow({ where: { commercialAccountId: account.commercialAccountId }, select: { id: true } });
    const charge = await request(app.getHttpServer()).post('/api/v1/platform/subscription-charges').set('Authorization', `Bearer ${login.body.accessToken}`).send({ commercialAccountId: account.commercialAccountId, subscriptionId: subscription.id, organizationId: account.id, amount: '100.00', dueDate: '2099-01-01', nature: 'RENEWAL' }).expect(201);
    const payload = { amount: '100.00', method: 'BANK_TRANSFER', effectiveAt: new Date().toISOString(), reason: 'Quitação excepcional fora do gateway' };
    const settled = await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/administrative-settlement`).set('Authorization', `Bearer ${login.body.accessToken}`).send(payload).expect(201);
    expect(settled.body).toEqual(expect.objectContaining({ condition: 'PAID', paidAmount: '100.00', outstandingAmount: '0.00' }));
    const settlement = await prisma.chargeSettlement.findFirstOrThrow({ where: { chargeId: charge.body.id } });
    expect(settlement).toEqual(expect.objectContaining({ origin: 'ADMINISTRATIVE', method: 'BANK_TRANSFER', provider: null, externalId: null }));
    expect(await prisma.auditEvent.count({ where: { action: 'charge_settlement.administratively_settled', targetId: settlement.id } })).toBe(1);
    await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/administrative-settlement`).set('Authorization', `Bearer ${login.body.accessToken}`).send(payload).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/administrative-settlement`).set('Authorization', `Bearer ${login.body.accessToken}`).send({ ...payload, amount: '99.99' }).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/auth/activate`).send({ token: provisioned.body.activationSecret, password }).expect(201);
    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: adminEmail, password }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.body.id}/administrative-settlement`).set('Authorization', `Bearer ${adminLogin.body.accessToken}`).send(payload).expect(403);
  });

  it('blocks only after the sixth Recife civil day and restores the same session after full payment', async () => {
    const suffix = Date.now();
    const account = await prisma.commercialAccount.create({ data: { name: `Blocked Account ${suffix}` } });
    const organization = await prisma.organization.create({ data: { name: `Blocked Workshop ${suffix}`, commercialAccountId: account.id } });
    const version = await prisma.planVersion.findFirstOrThrow({ where: { status: 'PUBLISHED' }, orderBy: { createdAt: 'asc' } });
    const today = recifeCivilDate(new Date());
    const dueDate = addCivilDays(today, -6);
    const subscription = await prisma.subscription.create({ data: {
      commercialAccountId: account.id, planVersionId: version.id, status: 'CURRENT', trialEnabled: false,
      contractedPrice: '100.00', firstDueDate: recifeMidnight(dueDate), billingDay: Number(dueDate.slice(-2)),
      firstPaymentReceivedAt: recifeMidnight(addCivilDays(dueDate, -1)), firstPaidPeriodStartedAt: recifeMidnight(dueDate),
    } });
    const charge = await prisma.subscriptionCharge.create({ data: {
      commercialAccountId: account.id, subscriptionId: subscription.id, organizationId: organization.id,
      amount: '100.00', dueDate: recifeMidnight(dueDate), nature: 'RENEWAL',
      billingPeriodStart: recifeMidnight(dueDate), billingPeriodEnd: recifeMidnight(addCivilDays(dueDate, 30)),
    } });
    const adminEmail = `blocked-${suffix}@example.com`;
    await prisma.user.create({ data: { organizationId: organization.id, name: 'Blocked Admin', email: adminEmail, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    try {
      const superLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
      const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: adminEmail, password }).expect(201);
      const bearer = { Authorization: `Bearer ${adminLogin.body.accessToken}` };
      await request(app.getHttpServer()).get('/api/v1/customers').set(bearer).expect(403);
      await request(app.getHttpServer()).get('/api/v1/auth/me').set(bearer).expect(200);
      await request(app.getHttpServer()).get('/api/v1/account/access-status').set(bearer).expect(200).expect(({ body }) => expect(body.commercialAccess).toBe('PAYMENT_BLOCKED'));
      await request(app.getHttpServer()).get(`/api/v1/platform/organizations/${organization.id}`).set('Authorization', `Bearer ${superLogin.body.accessToken}`).expect(200);
      await request(app.getHttpServer()).post(`/api/v1/platform/subscription-charges/${charge.id}/administrative-settlement`).set('Authorization', `Bearer ${superLogin.body.accessToken}`).send({ amount: '100.00', method: 'PIX', effectiveAt: new Date().toISOString(), reason: 'Pagamento confirmado' }).expect(201);
      await request(app.getHttpServer()).get('/api/v1/customers').set(bearer).expect(200);
      await request(app.getHttpServer()).get('/api/v1/auth/me').set(bearer).expect(200);
      expect(await prisma.session.count({ where: { user: { email: adminEmail }, revokedAt: null } })).toBe(1);
      expect((await prisma.organization.findUniqueOrThrow({ where: { id: organization.id } })).operationalStatus).toBe('ACTIVE');
    } finally {
      await prisma.user.deleteMany({ where: { email: adminEmail } });
      await prisma.chargeSettlement.deleteMany({ where: { chargeId: charge.id } });
      await prisma.subscriptionCharge.delete({ where: { id: charge.id } });
      await prisma.subscription.delete({ where: { id: subscription.id } });
      await prisma.organization.delete({ where: { id: organization.id } });
      await prisma.commercialAccount.delete({ where: { id: account.id } });
    }
  });
});
