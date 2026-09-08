import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Direct Sales (e2e)', () => {
  jest.setTimeout(30_000); let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let token: string; let productId: string; const suffix = Date.now(); const password = 'correct horse battery staple';
  beforeAll(async () => { const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService); const org = await prisma.organization.create({ data: { name: `Sales ${suffix}` } }); const other = await prisma.organization.create({ data: { name: `Other sales ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id; const product = await prisma.product.create({ data: { organizationId, name: 'Capacete', sku: `SALE-${suffix}`, salePrice: '150.00', stockQuantity: 3 } }); productId = product.id; const admin = await prisma.user.create({ data: { organizationId, name: 'Sales admin', email: `sales-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } }); token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken; });
  afterAll(async () => { if (!prisma) return; const where = { organizationId: { in: [organizationId, otherOrganizationId] } }; await prisma.stockMovement.deleteMany({ where }); await prisma.salePayment.deleteMany({ where }); await prisma.directSaleStockAllocation.deleteMany({ where }); await prisma.directSaleItem.deleteMany({ where }); await prisma.directSale.deleteMany({ where }); await prisma.product.deleteMany({ where }); await prisma.user.deleteMany({ where }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });
  const auth = () => ({ Authorization: `Bearer ${token}` });
  it('confirms a simple paid sale and derives payment balance without OS', async () => { const draft = await request(app.getHttpServer()).post('/api/v1/direct-sales').set(auth()).send({ items: [{ productId, quantity: 1, unitPrice: '120.00', discount: '10.00' }] }).expect(201); expect(draft.body).toMatchObject({ status: 'DRAFT', total: '110.00' }); const sale = await request(app.getHttpServer()).post(`/api/v1/direct-sales/${draft.body.id}/confirm`).set(auth()).send({ payments: [{ amount: '110.00', method: 'PIX' }] }).expect(201); expect(sale.body.financial).toMatchObject({ total: '110.00', paid: '110.00', balance: '0.00', status: 'PAID' }); expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(2); const receipt = await request(app.getHttpServer()).get(`/api/v1/direct-sales/${draft.body.id}/receipt`).set(auth()).expect(200); expect(receipt.body.fiscal).toBe(false); });
  it('rejects cross-tenant product access', async () => { const other = await prisma.product.create({ data: { organizationId: otherOrganizationId, name: 'Other', sku: `OTHER-${suffix}`, salePrice: '10.00' } }); await request(app.getHttpServer()).post('/api/v1/direct-sales').set(auth()).send({ items: [{ productId: other.id, quantity: 1, unitPrice: '10.00' }] }).expect(404); });
  it('confirms a sale only once when confirmation requests arrive concurrently', async () => {
    const product = await prisma.product.create({ data: { organizationId, name: 'Pastilha', sku: `RACE-${suffix}`, salePrice: '50.00', stockQuantity: 3 } });
    const draft = await request(app.getHttpServer()).post('/api/v1/direct-sales').set(auth()).send({ items: [{ productId: product.id, quantity: 1, unitPrice: '50.00' }] }).expect(201);
    const responses = await Promise.all([1, 2].map(() => request(app.getHttpServer()).post(`/api/v1/direct-sales/${draft.body.id}/confirm`).set(auth()).send({ payments: [{ amount: '50.00', method: 'PIX' }] })));

    expect(responses.map(response => response.status).sort()).toEqual([201, 409]);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity).toBe(2);
    expect(await prisma.salePayment.count({ where: { directSaleId: draft.body.id, status: 'CONFIRMED' } })).toBe(1);
  });
});
