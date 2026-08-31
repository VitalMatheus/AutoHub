import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let organizationId: string;
  let otherOrganizationId: string;
  let adminToken: string;
  const suffix = Date.now();
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const organization = await prisma.organization.create({ data: { name: `Products ${suffix}` } });
    const other = await prisma.organization.create({ data: { name: `Other products ${suffix}` } });
    organizationId = organization.id;
    otherOrganizationId = other.id;
    const admin = await prisma.user.create({ data: {
      organizationId, name: 'Product Admin', email: `product-admin-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201);
    adminToken = login.body.accessToken;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.product.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } });
    await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } });
    await app.close();
  });

  it('creates a tenant-scoped Product with generated SKU and stock defaults', async () => {
    const before = await prisma.product.count({ where: { organizationId } });
    await request(app.getHttpServer()).post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Injected tenant', salePrice: '149.90', organizationId: otherOrganizationId })
      .expect(400);
    expect(await prisma.product.count({ where: { organizationId } })).toBe(before);

    const response = await request(app.getHttpServer()).post('/api/v1/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Oil filter', description: 'Engine part', sku: ' of-001 ', salePrice: '149.90' })
      .expect(201);
    expect(response.body).toMatchObject({ organizationId, name: 'Oil filter', sku: 'OF-001', salePrice: '149.90', stockQuantity: 0, stockMinimum: 0, lowStock: true, active: true });
    const persisted = await prisma.product.findUnique({ where: { id: response.body.id } });
    expect(persisted).toMatchObject({ sku: 'OF-001', stockQuantity: 0, stockMinimum: 0 });
    const generated = await request(app.getHttpServer()).post('/api/v1/products').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Generated SKU', salePrice: '10.00', stockQuantity: 2, stockMinimum: 3 }).expect(201);
    expect(generated.body).toMatchObject({ stockQuantity: 2, stockMinimum: 3, lowStock: true });
    expect(generated.body.sku).toMatch(/^PROD-/);
    const secondGenerated = await request(app.getHttpServer()).post('/api/v1/products').set('Authorization', `Bearer ${adminToken}`).send({ name: 'Second generated SKU', salePrice: '10.00' }).expect(201);
    expect(secondGenerated.body.sku).not.toBe(generated.body.sku);
  });

  it('filters low-stock Products and allows direct stock adjustment', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Low stock filter', salePrice: '20.00', stockQuantity: 1, stockMinimum: 2 }).expect(201);
    const low = await request(app.getHttpServer()).get('/api/v1/products?lowStock=true').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(low.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id, lowStock: true })]));
    const updated = await request(app.getHttpServer()).patch(`/api/v1/products/${created.body.id}`).set('Authorization', `Bearer ${adminToken}`).send({ stockQuantity: 8 }).expect(200);
    expect(updated.body).toMatchObject({ stockQuantity: 8, stockMinimum: 2, lowStock: false });
  });

  it('does not leak another Organization through the low-stock filter', async () => {
    const other = await prisma.product.create({ data: { organizationId: otherOrganizationId, name: 'Other low stock', sku: `OTHER-LOW-${suffix}`, salePrice: '10.00', stockQuantity: 0, stockMinimum: 1 } });
    const low = await request(app.getHttpServer()).get('/api/v1/products?lowStock=true').set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(low.body.data).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: other.id })]));
  });

  it('has migrated stock columns and non-null SKUs for existing Products', async () => {
    const columns = await prisma.$queryRaw<{ column_name: string; is_nullable: string }[]>`SELECT column_name, is_nullable FROM information_schema.columns WHERE table_name = 'Product' AND column_name IN ('sku', 'stockQuantity', 'stockMinimum')`;
    expect(columns).toEqual(expect.arrayContaining([
      { column_name: 'sku', is_nullable: 'NO' },
      { column_name: 'stockQuantity', is_nullable: 'NO' },
      { column_name: 'stockMinimum', is_nullable: 'NO' },
    ]));
  });

  it('enforces SKU uniqueness inside one Organization but not across Organizations', async () => {
    await request(app.getHttpServer()).post('/api/v1/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Duplicate SKU', sku: 'OF-001', salePrice: '10.00' }).expect(409);
    await prisma.product.create({ data: { organizationId: otherOrganizationId, name: 'Other filter', sku: `OTHER-FILTER-${suffix}`, salePrice: '10.00' } });
  });

  it('excludes deactivated Products by default but supports active filtering and search', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/products').set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Brake pad', sku: 'BP-001', salePrice: '99.00' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/products/${created.body.id}/deactivate`)
      .set('Authorization', `Bearer ${adminToken}`).expect(201);

    const defaultList = await request(app.getHttpServer()).get('/api/v1/products?search=Brake')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(defaultList.body.meta.total).toBe(0);
    const inactiveList = await request(app.getHttpServer()).get('/api/v1/products?active=false&sort=salePrice&direction=desc&pageSize=10')
      .set('Authorization', `Bearer ${adminToken}`).expect(200);
    expect(inactiveList.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id, active: false, salePrice: '99.00' })]));
  });

  it('returns 404 for another Organization on read and mutation', async () => {
    const other = await prisma.product.create({ data: { organizationId: otherOrganizationId, name: 'Hidden product', sku: `HIDDEN-${suffix}`, salePrice: '10.00' } });
    await request(app.getHttpServer()).get(`/api/v1/products/${other.id}`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    await request(app.getHttpServer()).patch(`/api/v1/products/${other.id}`).set('Authorization', `Bearer ${adminToken}`).send({ name: 'Changed' }).expect(404);
    await request(app.getHttpServer()).post(`/api/v1/products/${other.id}/deactivate`).set('Authorization', `Bearer ${adminToken}`).expect(404);
    expect((await prisma.product.findUnique({ where: { id: other.id } }))?.name).toBe('Hidden product');
  });
});
