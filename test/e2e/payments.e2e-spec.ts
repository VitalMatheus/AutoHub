import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Payments (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let workOrderId: string; let otherWorkOrderId: string; let token: string;
  const suffix = Date.now(); const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const org = await prisma.organization.create({ data: { name: `Payments ${suffix}` } });
    const other = await prisma.organization.create({ data: { name: `Other payments ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id;
    const customer = await prisma.customer.create({ data: { organizationId, name: 'Payment customer', phone: '111' } });
    const vehicle = await prisma.vehicle.create({ data: { organizationId, customerId: customer.id, plate: `P${suffix}`, brand: 'Ford', model: 'Ka' } });
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Other customer', phone: '222' } });
    const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `X${suffix}`, brand: 'VW', model: 'Golf' } });
    const workOrder = await prisma.workOrder.create({ data: { organizationId, customerId: customer.id, vehicleId: vehicle.id, number: 1, items: { create: [{ type: 'MANUAL', description: 'Repair', quantity: '1', unitPrice: '100.00' }] } }, include: { items: true } }); workOrderId = workOrder.id;
    const otherWorkOrder = await prisma.workOrder.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, vehicleId: otherVehicle.id, number: 1, items: { create: [{ type: 'MANUAL', description: 'Other repair', quantity: '1', unitPrice: '100.00' }] } } }); otherWorkOrderId = otherWorkOrder.id;
    const admin = await prisma.user.create({ data: { organizationId, name: 'Payments admin', email: `payments-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.payment.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.workOrderItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.workOrder.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.vehicle.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await app.close();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('records partial decimal payments, exposes derived state, and preserves cancellation', async () => {
    const first = await request(app.getHttpServer()).post(`/api/v1/work-orders/${workOrderId}/payments`).set(auth()).send({ amount: '35.10', method: 'PIX', paidAt: '2026-01-01T10:00:00.000Z' }).expect(201);
    expect(first.body).toMatchObject({ amount: '35.10', status: 'CONFIRMED', financial: { status: 'PARTIAL', paid: '35.10', balance: '64.90' } });
    const cancelled = await request(app.getHttpServer()).post(`/api/v1/work-orders/${workOrderId}/payments/${first.body.id}/cancel`).set(auth()).expect(201);
    expect(cancelled.body).toMatchObject({ status: 'CANCELLED', financial: { status: 'UNPAID', paid: '0.00', balance: '100.00' } });
    expect(await prisma.payment.findUnique({ where: { id: first.body.id } })).toMatchObject({ status: 'CANCELLED' });
  });

  it('prevents overpayment and cross-organization access', async () => {
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${otherWorkOrderId}/payments`).set(auth()).send({ amount: '1.00', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${workOrderId}/payments`).set(auth()).send({ amount: '100.01', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' }).expect(409).expect((response) => expect(response.body.code).toBe('PAYMENT_EXCEEDS_BALANCE'));
  });

  it('allows cancelled Work Orders to be consulted but never records new Payments', async () => {
    const cancelled = await prisma.workOrder.create({ data: { organizationId, customerId: (await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, select: { customerId: true } })).customerId, vehicleId: (await prisma.workOrder.findUniqueOrThrow({ where: { id: workOrderId }, select: { vehicleId: true } })).vehicleId, number: 99, status: 'CANCELLED', items: { create: [{ type: 'MANUAL', description: 'Cancelled repair', quantity: '1', unitPrice: '50.00' }] } } });
    await prisma.payment.create({ data: { organizationId, workOrderId: cancelled.id, amount: '10.00', method: 'PIX', status: 'CANCELLED' } });
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${cancelled.id}/payments`).set(auth()).send({ amount: '1.00', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' }).expect(409).expect((response) => expect(response.body.code).toBe('WORK_ORDER_CANCELLED'));
    const listed = await request(app.getHttpServer()).get(`/api/v1/work-orders/${cancelled.id}/payments`).set(auth()).expect(200);
    expect(listed.body.data).toHaveLength(1);
    expect(listed.body.data[0]).toMatchObject({ status: 'CANCELLED', amount: '10.00' });
    await prisma.payment.deleteMany({ where: { workOrderId: cancelled.id } });
    await prisma.workOrderItem.deleteMany({ where: { workOrderId: cancelled.id } });
    await prisma.workOrder.delete({ where: { id: cancelled.id } });
  });

  it('serializes concurrent confirmed payments so the total is never exceeded', async () => {
    const results = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post(`/api/v1/work-orders/${workOrderId}/payments`).set(auth()).send({ amount: '60.00', method: 'CASH', paidAt: '2026-01-01T10:00:00.000Z' })));
    expect(results.filter((result) => result.status === 201)).toHaveLength(1);
    expect(results.filter((result) => result.status === 409 && result.body.code === 'PAYMENT_EXCEEDS_BALANCE')).toHaveLength(1);
    const confirmed = await prisma.payment.aggregate({ where: { organizationId, workOrderId, status: 'CONFIRMED' }, _sum: { amount: true } });
    expect(confirmed._sum.amount?.toFixed(2)).toBe('60.00');
  });
});
