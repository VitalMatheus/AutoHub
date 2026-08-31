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

  afterAll(async () => { if (!prisma) return; await prisma.payment.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.workOrderItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.workOrder.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.quoteItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.quote.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.service.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.product.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.vehicle.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.customer.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });

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

  it('allocates unique sequential numbers for concurrent direct creations in one Organization', async () => {
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { nextWorkOrderNumber: true } });
    const requests = Array.from({ length: 8 }, () => request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId }));
    const responses = await Promise.all(requests);
    expect(responses.every((response) => response.status === 201)).toBe(true);
    const numbers = responses.map((response) => response.body.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(requests.length);
    expect(numbers).toEqual(Array.from({ length: requests.length }, (_, index) => before.nextWorkOrderNumber + index));
    const persisted = await prisma.workOrder.findMany({ where: { organizationId, number: { in: numbers } }, select: { number: true } });
    expect(persisted).toHaveLength(requests.length);
    const after = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { nextWorkOrderNumber: true } });
    expect(after.nextWorkOrderNumber).toBe(before.nextWorkOrderNumber + requests.length);
  });

  it('lists financial Work Orders with derived states and explicit Organization isolation', async () => {
    const own = await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId, items: [{ type: 'MANUAL', description: 'Financial repair', quantity: '1', unitPrice: '100.00' }] }).expect(201);
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Financial other', phone: '333' } });
    const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `F${suffix}`, brand: 'Fiat', model: 'Uno' } });
    const other = await prisma.workOrder.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, vehicleId: otherVehicle.id, number: 900000 + suffix % 100000, items: { create: [{ type: 'MANUAL', description: 'Other financial repair', quantity: '1', unitPrice: '200.00' }] } } });
    await prisma.payment.create({ data: { organizationId, workOrderId: own.body.id, amount: '35.10', method: 'PIX', status: 'CONFIRMED' } });

    const listed = await request(app.getHttpServer()).get('/api/v1/work-orders/financial').set('Authorization', `Bearer ${token}`).query({ page: 1, pageSize: 100 }).expect(200);
    const ownRow = listed.body.data.find((row: { id: string }) => row.id === own.body.id);
    expect(ownRow).toMatchObject({ customer: { name: 'WO customer' }, vehicle: { brand: 'Ford', model: 'Ka' }, status: 'OPEN', total: '100.00', financial: { total: '100.00', paid: '35.10', balance: '64.90', status: 'PARTIAL' } });
    expect(listed.body.data.some((row: { id: string }) => row.id === other.id)).toBe(false);
  });

  it('does not leave a numbering gap when an item cannot be resolved', async () => {
    const service = await prisma.service.create({ data: { organizationId, name: 'Unavailable service', price: '20.00', active: false } });
    const before = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { nextWorkOrderNumber: true } });
    await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId, items: [{ type: 'SERVICE', serviceId: service.id, quantity: '1' }] }).expect(404);
    const afterFailure = await prisma.organization.findUniqueOrThrow({ where: { id: organizationId }, select: { nextWorkOrderNumber: true } });
    expect(afterFailure.nextWorkOrderNumber).toBe(before.nextWorkOrderNumber);
    const created = await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId }).expect(201);
    expect(created.body.number).toBe(before.nextWorkOrderNumber);
  });

  it('supports every lifecycle branch and rejects terminal transitions', async () => {
    const make = async () => (await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId }).expect(201)).body;
    const action = (path: string) => request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);

    const waitingApproval = await make();
    await action(`/api/v1/work-orders/${waitingApproval.id}/request-approval`).expect(201);
    await action(`/api/v1/work-orders/${waitingApproval.id}/start`).expect(201);
    await action(`/api/v1/work-orders/${waitingApproval.id}/wait-parts`).expect(201);
    await action(`/api/v1/work-orders/${waitingApproval.id}/start`).expect(201);
    await action(`/api/v1/work-orders/${waitingApproval.id}/complete`).expect(201);
    await action(`/api/v1/work-orders/${waitingApproval.id}/deliver`).expect(201);
    await action(`/api/v1/work-orders/${waitingApproval.id}/cancel`).expect(409);

    for (const state of ['OPEN', 'WAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS'] as const) {
      const workOrder = await make();
      if (state === 'WAITING_APPROVAL') await action(`/api/v1/work-orders/${workOrder.id}/request-approval`).expect(201);
      if (state === 'IN_PROGRESS') await action(`/api/v1/work-orders/${workOrder.id}/start`).expect(201);
      if (state === 'WAITING_PARTS') { await action(`/api/v1/work-orders/${workOrder.id}/start`).expect(201); await action(`/api/v1/work-orders/${workOrder.id}/wait-parts`).expect(201); }
      await action(`/api/v1/work-orders/${workOrder.id}/cancel`).expect(201);
    }
  });

  it('rejects every action whose precondition does not match the current state', async () => {
    const make = async () => (await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId }).expect(201)).body;
    const action = (id: string, name: string) => request(app.getHttpServer()).post(`/api/v1/work-orders/${id}/${name}`).set('Authorization', `Bearer ${token}`);
    const advance = async (id: string, state: string) => {
      if (state === 'WAITING_APPROVAL') await action(id, 'request-approval').expect(201);
      if (state === 'IN_PROGRESS' || state === 'WAITING_PARTS' || state === 'COMPLETED' || state === 'DELIVERED') await action(id, 'start').expect(201);
      if (state === 'WAITING_PARTS') await action(id, 'wait-parts').expect(201);
      if (state === 'COMPLETED' || state === 'DELIVERED') await action(id, 'complete').expect(201);
      if (state === 'DELIVERED') await action(id, 'deliver').expect(201);
    };
    const invalid: Record<string, string[]> = {
      OPEN: ['wait-parts', 'complete', 'deliver'],
      WAITING_APPROVAL: ['request-approval', 'wait-parts', 'complete', 'deliver'],
      IN_PROGRESS: ['request-approval', 'start', 'deliver'],
      WAITING_PARTS: ['request-approval', 'wait-parts', 'complete', 'deliver'],
      COMPLETED: ['request-approval', 'start', 'wait-parts', 'complete', 'cancel'],
      DELIVERED: ['request-approval', 'start', 'wait-parts', 'complete', 'deliver', 'cancel'],
      CANCELLED: ['request-approval', 'start', 'wait-parts', 'complete', 'deliver', 'cancel'],
    };
    for (const [state, actions] of Object.entries(invalid)) {
      const workOrder = await make();
      await advance(workOrder.id, state);
      if (state === 'CANCELLED') await action(workOrder.id, 'cancel').expect(201);
      for (const name of actions) await action(workOrder.id, name).expect(409).expect((response) => expect(response.body.code).toBe('WORK_ORDER_INVALID_TRANSITION'));
      if (state === 'OPEN') await action(workOrder.id, 'cancel').expect(201);
      if (state === 'WAITING_APPROVAL') await action(workOrder.id, 'cancel').expect(201);
      if (state === 'IN_PROGRESS') await action(workOrder.id, 'cancel').expect(201);
      if (state === 'WAITING_PARTS') await action(workOrder.id, 'cancel').expect(201);
    }
  });

  it('preserves catalog snapshots and permits edits only before terminal states', async () => {
    const service = await prisma.service.create({ data: { organizationId, name: 'Brake service', description: 'Brake inspection', price: '80.00' } });
    const product = await prisma.product.create({ data: { organizationId, name: 'Brake pad', description: 'Front pad', sku: `BRAKE-PAD-${suffix}`, salePrice: '45.00' } });
    const created = await request(app.getHttpServer()).post('/api/v1/work-orders').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId, items: [{ type: 'SERVICE', serviceId: service.id, quantity: '1', unitPrice: '999.99' }, { type: 'PRODUCT', productId: product.id, quantity: '2' }] }).expect(201);
    expect(created.body.items.map((item: any) => item.unitPrice)).toEqual(['80.00', '45.00']);

    await prisma.service.update({ where: { id: service.id }, data: { name: 'Changed service', description: 'Changed description', price: '12.00' } });
    await prisma.product.update({ where: { id: product.id }, data: { name: 'Changed pad', description: 'Changed product', salePrice: '2.00' } });
    const unchanged = await request(app.getHttpServer()).get(`/api/v1/work-orders/${created.body.id}`).set('Authorization', `Bearer ${token}`).expect(200);
    expect(unchanged.body.items.map((item: any) => item.description)).toEqual(['Brake inspection', 'Front pad']);
    expect(unchanged.body.total).toBe('170.00');

    await request(app.getHttpServer()).patch(`/api/v1/work-orders/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ notes: 'Updated notes' }).expect(200);
    const added = await request(app.getHttpServer()).post(`/api/v1/work-orders/${created.body.id}/items`).set('Authorization', `Bearer ${token}`).send({ type: 'MANUAL', description: 'Shop fee', quantity: '1', unitPrice: '10.00' }).expect(201);
    const manual = added.body.items.find((item: any) => item.description === 'Shop fee');
    await request(app.getHttpServer()).patch(`/api/v1/work-orders/${created.body.id}/items/${manual.id}`).set('Authorization', `Bearer ${token}`).send({ description: 'Updated fee', unitPrice: '11.00' }).expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/work-orders/${created.body.id}/items/${manual.id}`).set('Authorization', `Bearer ${token}`).expect(200);

    await request(app.getHttpServer()).post(`/api/v1/work-orders/${created.body.id}/start`).set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${created.body.id}/complete`).set('Authorization', `Bearer ${token}`).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/work-orders/${created.body.id}`).set('Authorization', `Bearer ${token}`).send({ notes: 'forbidden' }).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/work-orders/${created.body.id}/items`).set('Authorization', `Bearer ${token}`).send({ type: 'MANUAL', description: 'Forbidden', quantity: '1', unitPrice: '1.00' }).expect(409);
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
