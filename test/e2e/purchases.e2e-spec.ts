import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Purchases (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let token: string; let supplierId: string; let productId: string; const suffix = Date.now(); const password = 'correct horse battery staple';
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const org = await prisma.organization.create({ data: { name: `Purchases ${suffix}` } }); const other = await prisma.organization.create({ data: { name: `Other purchases ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id;
    const supplier = await prisma.supplier.create({ data: { organizationId, name: 'Distribuidora' } }); supplierId = supplier.id; const product = await prisma.product.create({ data: { organizationId, name: 'Capacete', sku: `HELMET-${suffix}`, salePrice: '200.00' } }); productId = product.id;
    const admin = await prisma.user.create({ data: { organizationId, name: 'Purchase admin', email: `purchase-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } }); token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });
  afterAll(async () => { if (!prisma) return; await prisma.stockEntry.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.purchaseItem.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.purchase.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.expense.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.productSupplier.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.supplier.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.product.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });
  const auth = () => ({ Authorization: `Bearer ${token}` });
  it('creates a draft and confirms it atomically into stock and payable', async () => {
    const draft = await request(app.getHttpServer()).post('/api/v1/purchases').set(auth()).send({ supplierId, purchaseDate: '2026-09-01', dueDate: '2026-09-15', items: [{ productId, quantity: 2, unitCost: '80.00', warrantyDays: 365, batchNumber: 'L-1' }] }).expect((response) => { if (response.status !== 201) throw new Error(JSON.stringify(response.body)); });
    expect(draft.body).toMatchObject({ status: 'DRAFT', total: '160.00' }); expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(0);
    const confirmed = await request(app.getHttpServer()).post(`/api/v1/purchases/${draft.body.id}/confirm`).set(auth()).expect(201);
    expect(confirmed.body.status).toBe('CONFIRMED'); expect(confirmed.body.expenseId).toBeTruthy(); expect((await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity).toBe(2);
    const entry = await prisma.stockEntry.findFirstOrThrow({ where: { purchaseId: draft.body.id } }); expect(entry).toMatchObject({ supplierId, productId, quantity: 2, batchNumber: 'L-1', warrantyDays: 365 }); expect(entry.unitCost.toString()).toBe('80'); expect(await prisma.expense.count({ where: { id: confirmed.body.expenseId, organizationId } })).toBe(1);
    await request(app.getHttpServer()).patch(`/api/v1/purchases/${draft.body.id}`).set(auth()).send({ supplierId, purchaseDate: '2026-09-01', dueDate: '2026-09-15', items: [{ productId, quantity: 4, unitCost: '80.00' }] }).expect(409);
  });
  it('does not expose a purchase through another tenant identity', async () => { const response = await request(app.getHttpServer()).get('/api/v1/purchases').set(auth()).expect(200); expect(response.body.data.every((row: { organizationId?: string }) => row.organizationId !== otherOrganizationId)).toBe(true); });
});
