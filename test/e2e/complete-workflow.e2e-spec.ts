import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

/** Acceptance seam: this test deliberately uses only the public REST contract after bootstrap. */
describe('Complete workshop workflow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  const suffix = Date.now();
  const superEmail = `workflow-super-${suffix}@example.com`;
  const adminEmail = `workflow-admin-${suffix}@example.com`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({ data: {
      name: 'Workflow Super Admin', email: superEmail, role: 'SUPER_ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
  });

  afterAll(async () => {
    if (prisma) {
      const organization = organizationId ? [organizationId] : [];
      if (organization.length) {
        await prisma.payment.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.workOrderItem.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.workOrder.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.quoteItem.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.quote.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.vehicle.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.customer.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.service.deleteMany({ where: { organizationId: { in: organization } } });
        await prisma.product.deleteMany({ where: { organizationId: { in: organization } } });
      }
      await prisma.user.deleteMany({ where: { email: { in: [superEmail, adminEmail] } } });
      if (organization.length) await prisma.organization.delete({ where: { id: organizationId } });
    }
    await app.close();
  });

  it('completes provisioning, activation, catalogs, quote, work order, payment and history', async () => {
    const api = request(app.getHttpServer());
    const superLogin = await api.post('/api/v1/auth/login').send({ email: superEmail, password }).expect(201);
    const provisioned = await api.post('/api/v1/platform/organizations')
      .set('Authorization', `Bearer ${superLogin.body.accessToken}`)
      .send({ name: `Workflow Workshop ${suffix}`, admin: { name: 'Workflow Admin', email: adminEmail } })
      .expect(201);
    organizationId = provisioned.body.organization.id;
    await api.post('/api/v1/auth/activate').send({ token: provisioned.body.activationToken, password }).expect(201);
    const adminLogin = await api.post('/api/v1/auth/login').send({ email: adminEmail, password }).expect(201);
    const auth = { Authorization: `Bearer ${adminLogin.body.accessToken}` };

    const customer = await api.post('/api/v1/customers').set(auth).send({ name: 'Contract Customer', phone: '85999990000' }).expect(201);
    const vehicle = await api.post('/api/v1/vehicles').set(auth).send({ customerId: customer.body.id, plate: 'ABC-1D23', brand: 'Ford', model: 'Ka' }).expect(201);
    const service = await api.post('/api/v1/services').set(auth).send({ name: 'Inspection', description: 'Full inspection', price: '100.00' }).expect(201);
    await api.post('/api/v1/products').set(auth).send({ name: 'Oil filter', sku: `FILTER-${suffix}`, salePrice: '25.00' }).expect(201);
    const quote = await api.post('/api/v1/quotes').set(auth).send({ customerId: customer.body.id, vehicleId: vehicle.body.id }).expect(201);
    await api.post(`/api/v1/quotes/${quote.body.id}/items`).set(auth).send({ type: 'SERVICE', serviceId: service.body.id, quantity: '1', unitPrice: '100.00' }).expect(201);
    await api.post(`/api/v1/quotes/${quote.body.id}/submit`).set(auth).expect(201);
    const approved = await api.post(`/api/v1/quotes/${quote.body.id}/approve`).set(auth).expect(201);
    expect(approved.body.status).toBe('APPROVED');
    const workOrder = await api.post(`/api/v1/work-orders/from-quote/${quote.body.id}`).set(auth).expect(201);
    await api.post(`/api/v1/work-orders/${workOrder.body.id}/start`).set(auth).expect(201);
    const completed = await api.post(`/api/v1/work-orders/${workOrder.body.id}/complete`).set(auth).expect(201);
    expect(completed.body.status).toBe('COMPLETED');
    const payment = await api.post(`/api/v1/work-orders/${workOrder.body.id}/payments`).set(auth)
      .send({ amount: '100.00', method: 'PIX', paidAt: '2026-01-01T10:00:00.000Z' }).expect(201);
    expect(payment.body.financial).toMatchObject({ status: 'PAID', paid: '100.00', balance: '0.00' });
    const history = await api.get(`/api/v1/vehicles/${vehicle.body.id}/work-orders`).set(auth).expect(200);
    expect(history.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: workOrder.body.id, status: 'COMPLETED' })]));
  });
});
