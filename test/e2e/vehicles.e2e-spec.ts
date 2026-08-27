import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Vehicles (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let otherOrganizationId: string;
  let adminToken: string;
  let customerId: string;
  let otherCustomerId: string;
  const suffix = Date.now();
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const organization = await prisma.organization.create({ data: { name: `Vehicles ${suffix}` } });
    const other = await prisma.organization.create({ data: { name: `Other vehicles ${suffix}` } });
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const customer = await prisma.customer.create({ data: { organizationId, name: 'Current customer', phone: '1111' } });
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Other customer', phone: '2222' } });
    customerId = customer.id;
    otherCustomerId = otherCustomer.id;
    const admin = await prisma.user.create({ data: {
      organizationId, name: 'Vehicle Admin', email: `vehicle-admin-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.workOrderItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.workOrder.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.vehicle.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.customer.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await app.close();
  });

  it('creates with tenant Customer and normalizes the plate', async () => {
    const before = await prisma.vehicle.count({ where: { organizationId } });
    await request(app.getHttpServer()).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId, plate: 'abc-1d23', brand: 'Ford', model: 'Ka', mileage: 1000, organizationId: otherOrganizationId }).expect(400);
    expect(await prisma.vehicle.count({ where: { organizationId } })).toBe(before);

    const response = await request(app.getHttpServer()).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId, plate: 'abc-1d23', brand: 'Ford', model: 'Ka', mileage: 1000 }).expect(201);
    expect(response.body).toMatchObject({ organizationId, customerId, plate: 'ABC1D23', mileage: 1000 });
  });

  it('rejects duplicate normalized plates within the Organization', async () => {
    await request(app.getHttpServer()).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId, plate: 'ABC 1D23', brand: 'Ford', model: 'Fiesta' }).expect(409);
    await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomerId, plate: 'ABC1D23', brand: 'Ford', model: 'Ka' } });
  });

  it('rejects cross-tenant Customer create and does not create a row', async () => {
    const before = await prisma.vehicle.count({ where: { organizationId } });
    await request(app.getHttpServer()).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId: otherCustomerId, plate: 'ZZZ9999', brand: 'Ford', model: 'Ka' }).expect(404);
    expect(await prisma.vehicle.count({ where: { organizationId } })).toBe(before);
  });

  it('filters, hides another tenant, moves Customer, and physically deletes unused Vehicles', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/vehicles').set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId, plate: 'QWE-1234', brand: 'VW', model: 'Golf' }).expect(201);
    const other = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomerId, plate: 'HID1234', brand: 'VW', model: 'Golf' } });
    const filtered = await request(app.getHttpServer()).get(`/api/v1/vehicles?customerId=${customerId}&plate=QWE1234&active=true`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(filtered.body.meta.total).toBe(1);
    await request(app.getHttpServer()).get(`/api/v1/vehicles/${other.id}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/vehicles/${other.id}`).set('Authorization', `Bearer ${adminToken}`).send({ customerId }).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/vehicles/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({ customerId }).expect(200);
    await request(app.getHttpServer()).delete(`/api/v1/vehicles/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(await prisma.vehicle.findUnique({ where: { id: created.body.id } })).toBeNull();
  });

  it('exposes completed and delivered Work Orders as stable Vehicle history after Customer transfer', async () => {
    const formerCustomer = await prisma.customer.create({ data: { organizationId, name: 'Former owner', phone: `old-${suffix}` } });
    const currentCustomer = await prisma.customer.create({ data: { organizationId, name: 'Current owner', phone: `new-${suffix}` } });
    const vehicle = await prisma.vehicle.create({ data: { organizationId, customerId: formerCustomer.id, plate: `H${suffix}`, brand: 'Ford', model: 'Focus' } });
    const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomerId, plate: `I${suffix}`, brand: 'Ford', model: 'Focus' } });
    await prisma.workOrder.createMany({ data: [
      { organizationId, customerId: formerCustomer.id, vehicleId: vehicle.id, number: 700000 + suffix % 100000, status: 'COMPLETED' },
      { organizationId, customerId: formerCustomer.id, vehicleId: vehicle.id, number: 710000 + suffix % 100000, status: 'DELIVERED' },
      { organizationId, customerId: formerCustomer.id, vehicleId: vehicle.id, number: 720000 + suffix % 100000, status: 'OPEN' },
      { organizationId: otherOrganizationId, customerId: otherCustomerId, vehicleId: otherVehicle.id, number: 730000 + suffix % 100000, status: 'COMPLETED' },
    ] });

    await request(app.getHttpServer()).patch(`/api/v1/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ customerId: currentCustomer.id }).expect(200);

    const history = await request(app.getHttpServer()).get(`/api/v1/vehicles/${vehicle.id}/work-orders?page=1&pageSize=1`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(history.body.meta).toMatchObject({ page: 1, pageSize: 1, total: 2, totalPages: 2 });
    expect(history.body.data).toHaveLength(1);
    expect(['COMPLETED', 'DELIVERED']).toContain(history.body.data[0].status);
    expect(history.body.data[0].customerId).toBe(formerCustomer.id);
    expect(history.body.data[0].customer.name).toBe('Former owner');

    const delivered = await request(app.getHttpServer()).get(`/api/v1/vehicles/${vehicle.id}/work-orders?status=DELIVERED`)
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(delivered.body.meta.total).toBe(1);
    expect(delivered.body.data[0].status).toBe('DELIVERED');
    expect(delivered.body.data[0].customerId).toBe(formerCustomer.id);
    expect(await prisma.workOrder.count({ where: { organizationId, vehicleId: vehicle.id } })).toBe(3);

    await request(app.getHttpServer()).get(`/api/v1/vehicles/${otherVehicle.id}/work-orders`)
      .set('Authorization', `Bearer ${adminToken}`).expect(404);
  });
});
