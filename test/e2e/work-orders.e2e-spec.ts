import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Work Orders (e2e)', () => {
  let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let token: string; let customerId: string; let vehicleId: string;
  const suffix = Date.now(); const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const org = await prisma.organization.create({ data: { name: `Work orders ${suffix}` } }); const other = await prisma.organization.create({ data: { name: `Other work orders ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id;
    const customer = await prisma.customer.create({ data: { organizationId, name: 'WO customer', phone: '111' } }); customerId = customer.id;
    const vehicle = await prisma.vehicle.create({ data: { organizationId, customerId, plate: `W${suffix}`, brand: 'Ford', model: 'Ka' } }); vehicleId = vehicle.id;
    const admin = await prisma.user.create({ data: { organizationId, name: 'WO admin', email: `wo-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => { if (!prisma) return; await prisma.payment.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.workOrderItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.workOrder.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.quoteItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.quote.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.service.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.vehicle.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.customer.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });

  it('creates direct Work Orders with atomic numbering and snapshots', async () => {
    const service = await prisma.service.create({ data: { organizationId, name: 'Alignment', description: 'Alignment service', price: '100.00' } });
    const payload = { customerId, vehicleId, reportedProblem: 'Noise', mileage: 12000, items: [{ type: 'SERVICE', serviceId: service.id, quantity: '1.500', unitPrice: '12.34' }, { type: 'MANUAL', description: 'Inspection', quantity: '2', unitPrice: '3.21' }] };
    await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ ...payload, organizationId: otherOrganizationId }).expect(400);
    const response = await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send(payload).expect(201);
    expect(response.body).toMatchObject({ number: 1, status: 'OPEN', reportedProblem: 'Noise', total: '156.42' });
    expect(response.body.items[0]).toMatchObject({ description: 'Alignment service', quantity: '1.500', unitPrice: '100.00', total: '150.00' });
  });

  it('enforces tenant links and the lifecycle graph', async () => {
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Other', phone: '222' } }); const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `O${suffix}`, brand: 'VW', model: 'Golf' } });
    await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId: otherCustomer.id, vehicleId: otherVehicle.id }).expect(404);
    const created = await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId }).expect(201);
    const action = (path: string) => request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);
    await action(`/api/v1/work-orders/${created.body.id}/start`).expect(201);
    await action(`/api/v1/work-orders/${created.body.id}/complete`).expect(201);
    await action(`/api/v1/work-orders/${created.body.id}/complete`).expect(409).expect((r) => expect(r.body.code).toBe('WORK_ORDER_INVALID_TRANSITION'));
    await action(`/api/v1/work-orders/${created.body.id}/deliver`).expect(201);
  });

  it('converts only approved Quotes, copies snapshots, and serializes repeated conversions', async () => {
    const approvedCustomer = await prisma.customer.create({ data: { organizationId, name: 'Quote customer', phone: '333' } });
    const approvedVehicle = await prisma.vehicle.create({ data: { organizationId, customerId: approvedCustomer.id, plate: `Q${suffix}`, brand: 'Fiat', model: 'Uno' } });
    const approvedQuote = await prisma.quote.create({ data: { organizationId, customerId: approvedCustomer.id, vehicleId: approvedVehicle.id, number: 100000 + suffix % 100000, status: 'APPROVED', notes: 'Quote notes', items: { create: [{ type: 'MANUAL', description: 'Historical inspection', quantity: '1.500', unitPrice: '12.34' }] } }, include: { items: true } });
    const converted = await request(app.getHttpServer()).post(`/api/v1/work-orders/from-quote/${approvedQuote.id}`).set('Authorization', `Bearer ${token}`).expect(201);
    expect(converted.body).toMatchObject({ quoteId: approvedQuote.id, customerId: approvedCustomer.id, vehicleId: approvedVehicle.id, total: '18.51' });
    expect(converted.body.items[0]).toMatchObject({ description: 'Historical inspection', quantity: '1.500', unitPrice: '12.34' });
    await request(app.getHttpServer()).post(`/api/v1/work-orders/from-quote/${approvedQuote.id}`).set('Authorization', `Bearer ${token}`).expect(409).expect((r) => expect(r.body.code).toBe('QUOTE_ALREADY_CONVERTED'));

    const concurrentQuote = await prisma.quote.create({ data: { organizationId, customerId: approvedCustomer.id, vehicleId: approvedVehicle.id, number: 200000 + suffix % 100000, status: 'APPROVED', items: { create: [{ type: 'MANUAL', description: 'Concurrent item', quantity: '1', unitPrice: '10.00' }] } } });
    const concurrent = await Promise.allSettled([1, 2].map(() => request(app.getHttpServer()).post(`/api/v1/work-orders/from-quote/${concurrentQuote.id}`).set('Authorization', `Bearer ${token}`)));
    expect(concurrent.filter((result) => result.status === 'fulfilled' && result.value.status === 201)).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 'fulfilled' && result.value.status === 409 && result.value.body.code === 'QUOTE_ALREADY_CONVERTED')).toHaveLength(1);

    const pendingQuote = await prisma.quote.create({ data: { organizationId, customerId: approvedCustomer.id, vehicleId: approvedVehicle.id, number: 300000 + suffix % 100000, status: 'PENDING' } });
    await request(app.getHttpServer()).post(`/api/v1/work-orders/from-quote/${pendingQuote.id}`).set('Authorization', `Bearer ${token}`).expect(409).expect((r) => expect(r.body.code).toBe('QUOTE_NOT_APPROVED'));

    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Other quote customer', phone: '444' } });
    const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `X${suffix}`, brand: 'Ford', model: 'Ka' } });
    const otherQuote = await prisma.quote.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, vehicleId: otherVehicle.id, number: 400000 + suffix % 100000, status: 'APPROVED' } });
    await request(app.getHttpServer()).post(`/api/v1/work-orders/from-quote/${otherQuote.id}`).set('Authorization', `Bearer ${token}`).expect(404);
  });
});
