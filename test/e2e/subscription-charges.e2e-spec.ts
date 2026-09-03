import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Subscription Charges and Settlements (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `charges-admin-${Date.now()}@example.com`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    await prisma.user.create({ data: { name: 'Charges Operator', email, role: 'SUPER_ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
  });

  afterAll(async () => { await prisma.user.delete({ where: { email } }); await app.close(); });

  it('derives balances, accepts partial settlement, and replays provider deliveries idempotently', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email, password }).expect(201);
    const provisioned = await request(app.getHttpServer()).post('/api/v1/platform/organizations').set('Authorization', `Bearer ${login.body.accessToken}`).send({ name: `Charge Workshop ${Date.now()}`, phone: '81999990000', firstDueDate: '2026-10-10', billingDay: 10, admin: { name: `Admin ${Date.now()}`, email: `admin-${Date.now()}@example.com` } }).expect(201);
    const organization = await prisma.organization.findUniqueOrThrow({ where: { id: provisioned.body.organization.id }, select: { commercialAccountId: true } });
    const subscription = await prisma.subscription.findFirstOrThrow({ where: { commercialAccountId: organization.commercialAccountId }, select: { id: true } });
    const charge = await request(app.getHttpServer()).post('/api/v1/platform/subscription-charges').set('Authorization', `Bearer ${login.body.accessToken}`).send({ commercialAccountId: organization.commercialAccountId, subscriptionId: subscription.id, amount: '100.00', dueDate: '2099-01-01', nature: 'EXTRAORDINARY', provider: 'manual-test', externalId: `charge-${Date.now()}` }).expect(201);
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
});
