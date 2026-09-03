import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Quotes (e2e)', () => {
  jest.setTimeout(30_000);

  let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let token: string; let customerId: string; let vehicleId: string;
  const suffix = Date.now(); const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const org = await prisma.organization.create({ data: { name: `Quotes ${suffix}` } }); const other = await prisma.organization.create({ data: { name: `Other quotes ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id;
    const customer = await prisma.customer.create({ data: { organizationId, name: 'Quote customer', phone: '111' } }); customerId = customer.id;
    const vehicle = await prisma.vehicle.create({ data: { organizationId, customerId, plate: `Q${suffix}`, brand: 'Ford', model: 'Ka' } }); vehicleId = vehicle.id;
    const admin = await prisma.user.create({ data: { organizationId, name: 'Quote admin', email: `quote-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => { if (!prisma) return; await prisma.quoteItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.quote.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.service.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.vehicle.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.customer.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });

  it('creates numbered drafts and preserves catalog snapshots and decimal totals', async () => {
    const service = await prisma.service.create({ data: { organizationId, name: 'Alignment', description: 'Alignment service', price: '100.00' } });
    await request(app.getHttpServer()).post('/api/v1/quotes').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId, organizationId: otherOrganizationId }).expect(400);
    const quote = await request(app.getHttpServer()).post('/api/v1/quotes').set('Authorization', `Bearer ${token}`).send({ customerId, vehicleId }).expect(201);
    const item = await request(app.getHttpServer()).post(`/api/v1/quotes/${quote.body.id}/items`).set('Authorization', `Bearer ${token}`).send({ type: 'SERVICE', serviceId: service.id, quantity: '1.500' }).expect(201);
    expect(item.body).toMatchObject({ number: 1, status: 'DRAFT', total: '150.00' }); expect(item.body.items[0]).toMatchObject({ description: 'Alignment service', quantity: '1.500', unitPrice: '100.00' });
    await prisma.service.update({ where: { id: service.id }, data: { description: 'Changed', price: '999.99' } });
    const fetched = await request(app.getHttpServer()).get(`/api/v1/quotes/${quote.body.id}`).set('Authorization', `Bearer ${token}`).expect(200); expect(fetched.body.items[0]).toMatchObject({ description: 'Alignment service', unitPrice: '100.00' });
  });

  it('allocates unique sequential numbers when drafts are created concurrently in one Organization', async () => {
    const amount = 12;
    const responses = await Promise.all(Array.from({ length: amount }, () =>
      request(app.getHttpServer())
        .post('/api/v1/quotes')
        .set('Authorization', `Bearer ${token}`)
        .send({ customerId, vehicleId })
        .expect(201),
    ));

    const numbers = responses.map(({ body }) => body.number).sort((a, b) => a - b);
    expect(new Set(numbers).size).toBe(amount);
    expect(numbers).toEqual(Array.from({ length: amount }, (_, index) => index + 2));
    await expect(prisma.organization.findUnique({ where: { id: organizationId }, select: { nextQuoteNumber: true } }))
      .resolves.toMatchObject({ nextQuoteNumber: amount + 2 });
  });

  it('lists only tenant Quotes and filters every supported status', async () => {
    const statuses = ['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const;
    const tenantQuotes = await Promise.all(statuses.map((status, index) => prisma.quote.create({
      data: { organizationId, customerId, vehicleId, number: 2000 + index, status },
    })));
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'List other', phone: '444' } });
    const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `L${suffix}`, brand: 'Honda', model: 'Fit' } });
    const otherQuote = await prisma.quote.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, vehicleId: otherVehicle.id, number: 2000, status: 'APPROVED' } });

    const all = await request(app.getHttpServer())
      .get('/api/v1/quotes?page=1&pageSize=100')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(all.body.data.map(({ id }: { id: string }) => id)).toEqual(expect.arrayContaining(tenantQuotes.map(({ id }) => id)));
    expect(all.body.data.map(({ id }: { id: string }) => id)).not.toContain(otherQuote.id);

    for (const [index, status] of statuses.entries()) {
      const filtered = await request(app.getHttpServer())
        .get(`/api/v1/quotes?page=1&pageSize=100&status=${status}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(filtered.body.data).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: tenantQuotes[index].id, status }),
      ]));
      expect(filtered.body.data.every((quote: { status: string }) => quote.status === status)).toBe(true);
      expect(filtered.body.data.map(({ id }: { id: string }) => id)).not.toContain(otherQuote.id);
    }
  });

  it('rejects cross-tenant relationships and edits after leaving draft', async () => {
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Other', phone: '222' } }); const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `O${suffix}`, brand: 'VW', model: 'Golf' } });
    await request(app.getHttpServer()).post('/api/v1/quotes').set('Authorization', `Bearer ${token}`).send({ customerId: otherCustomer.id, vehicleId: otherVehicle.id }).expect(404);
    const quote = await prisma.quote.create({ data: { organizationId, customerId, vehicleId, number: 999, status: 'PENDING' } });
    await request(app.getHttpServer()).post(`/api/v1/quotes/${quote.id}/items`).set('Authorization', `Bearer ${token}`).send({ type: 'MANUAL', description: 'Blocked', quantity: '1', unitPrice: '1.00' }).expect(409);
  });

  it('drives Quotes through the approval graph and keeps terminal states immutable', async () => {
    const draft = await prisma.quote.create({ data: { organizationId, customerId, vehicleId, number: 1000 } });
    const action = (path: string) => request(app.getHttpServer()).post(path).set('Authorization', `Bearer ${token}`);

    await action(`/api/v1/quotes/${draft.id}/submit`).expect(201).expect((response) => expect(response.body.status).toBe('PENDING'));
    await action(`/api/v1/quotes/${draft.id}/approve`).expect(201).expect((response) => expect(response.body.status).toBe('APPROVED'));
    await action(`/api/v1/quotes/${draft.id}/approve`).expect(409).expect((response) => {
      expect(response.body).toMatchObject({ status: 409, code: 'QUOTE_INVALID_TRANSITION' });
    });

    const pending = await prisma.quote.create({ data: { organizationId, customerId, vehicleId, number: 1001, status: 'PENDING' } });
    await action(`/api/v1/quotes/${pending.id}/cancel`).expect(201).expect((response) => expect(response.body.status).toBe('CANCELLED'));
    await action(`/api/v1/quotes/${pending.id}/cancel`).expect(409);

    const rejected = await prisma.quote.create({ data: { organizationId, customerId, vehicleId, number: 1002 } });
    await action(`/api/v1/quotes/${rejected.id}/submit`).expect(201);
    await action(`/api/v1/quotes/${rejected.id}/reject`).expect(201).expect((response) => expect(response.body.status).toBe('REJECTED'));
    await action(`/api/v1/quotes/${rejected.id}/submit`).expect(409);

    const cancelledDraft = await prisma.quote.create({ data: { organizationId, customerId, vehicleId, number: 1003 } });
    await action(`/api/v1/quotes/${cancelledDraft.id}/cancel`).expect(201).expect((response) => expect(response.body.status).toBe('CANCELLED'));
  });

  it('does not reveal a Quote from another Organization through actions', async () => {
    const otherCustomer = await prisma.customer.create({ data: { organizationId: otherOrganizationId, name: 'Action other', phone: '333' } });
    const otherVehicle = await prisma.vehicle.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, plate: `A${suffix}`, brand: 'Fiat', model: 'Uno' } });
    const otherQuote = await prisma.quote.create({ data: { organizationId: otherOrganizationId, customerId: otherCustomer.id, vehicleId: otherVehicle.id, number: 1000 } });
    await request(app.getHttpServer()).post(`/api/v1/quotes/${otherQuote.id}/submit`).set('Authorization', `Bearer ${token}`).expect(404);
  });
});
