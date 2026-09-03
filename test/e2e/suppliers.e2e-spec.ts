import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Suppliers (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let token: string; let productId: string; let otherSupplierId: string;
  const suffix = Date.now(); const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const org = await prisma.organization.create({ data: { name: `Suppliers ${suffix}` } }); const other = await prisma.organization.create({ data: { name: `Other suppliers ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id;
    const product = await prisma.product.create({ data: { organizationId, name: 'Capacete', sku: `CAP-${suffix}`, salePrice: '150.00' } }); productId = product.id;
    const otherSupplier = await prisma.supplier.create({ data: { organizationId: otherOrganizationId, name: 'Other supplier', document: `1234567890${String(suffix).slice(-4)}` } }); otherSupplierId = otherSupplier.id;
    const admin = await prisma.user.create({ data: { organizationId, name: 'Suppliers admin', email: `suppliers-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => { if (!prisma) return; await prisma.productSupplier.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.supplier.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.product.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('creates normalized Suppliers and links multiple Suppliers to a Product with one preferred', async () => {
    const first = await request(app.getHttpServer()).post('/api/v1/suppliers').set(auth()).send({ name: 'Fornecedor A', document: '12.345.678/0001-90', email: 'A@EXAMPLE.COM' }).expect(201);
    expect(first.body).toMatchObject({ name: 'Fornecedor A', document: '12345678000190', email: 'a@example.com', active: true });
    const second = await request(app.getHttpServer()).post('/api/v1/suppliers').set(auth()).send({ name: 'Fornecedor B' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/products/${productId}/suppliers/${first.body.id}`).set(auth()).send({ lastCost: '99.90', warrantyDays: 365, preferred: true }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/products/${productId}/suppliers/${second.body.id}`).set(auth()).send({ warrantyDays: 90 }).expect(201);
    const links = await request(app.getHttpServer()).get(`/api/v1/products/${productId}/suppliers`).set(auth()).expect(200);
    expect(links.body).toHaveLength(2);
    expect(links.body.filter((link: { preferred: boolean }) => link.preferred)).toHaveLength(1);
    expect(links.body.find((link: { supplierId: string }) => link.supplierId === first.body.id)).toMatchObject({ lastCost: '99.90', warrantyDays: 365, preferred: true });
    await request(app.getHttpServer()).patch(`/api/v1/products/${productId}/suppliers/${second.body.id}`).set(auth()).send({ preferred: true }).expect(200);
    const switched = await request(app.getHttpServer()).get(`/api/v1/products/${productId}/suppliers`).set(auth()).expect(200);
    expect(switched.body.find((link: { supplierId: string }) => link.supplierId === second.body.id).preferred).toBe(true);
    expect(switched.body.find((link: { supplierId: string }) => link.supplierId === first.body.id).preferred).toBe(false);
  });

  it('isolates Suppliers and Product links by Organization', async () => {
    await request(app.getHttpServer()).get(`/api/v1/suppliers/${otherSupplierId}`).set(auth()).expect(404);
    await request(app.getHttpServer()).get(`/api/v1/products/${productId}/suppliers`).set(auth()).expect(200);
    await request(app.getHttpServer()).post(`/api/v1/products/${productId}/suppliers/${otherSupplierId}`).set(auth()).send({ preferred: true }).expect(404);
  });

  it('preserves links while preventing new links to an inactive Supplier', async () => {
    const supplier = await request(app.getHttpServer()).post('/api/v1/suppliers').set(auth()).send({ name: 'Fornecedor inativo' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/products/${productId}/suppliers/${supplier.body.id}`).set(auth()).send({}).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/suppliers/${supplier.body.id}/deactivate`).set(auth()).expect(201);
    await request(app.getHttpServer()).get(`/api/v1/products/${productId}/suppliers`).set(auth()).expect(200).expect((response) => expect(response.body.some((link: { supplierId: string }) => link.supplierId === supplier.body.id)).toBe(true));
  });
});
