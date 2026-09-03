import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Expenses (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication; let prisma: PrismaService; let organizationId: string; let otherOrganizationId: string; let token: string; let otherExpenseId: string;
  const suffix = Date.now(); const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile(); app = moduleRef.createNestApplication(); configureApplication(app); await app.init(); prisma = app.get(PrismaService);
    const org = await prisma.organization.create({ data: { name: `Expenses ${suffix}` } }); const other = await prisma.organization.create({ data: { name: `Other expenses ${suffix}` } }); organizationId = org.id; otherOrganizationId = other.id;
    const otherExpense = await prisma.expense.create({ data: { organizationId: otherOrganizationId, category: 'RENT', description: 'Other rent', amount: '100.00', dueDate: new Date('2026-01-10') } }); otherExpenseId = otherExpense.id;
    const admin = await prisma.user.create({ data: { organizationId, name: 'Expenses admin', email: `expenses-${suffix}@example.com`, role: 'ADMIN', status: 'ACTIVE', passwordHash: await argon2.hash(password, { type: argon2.argon2id }) } });
    token = (await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: admin.email, password }).expect(201)).body.accessToken;
  });

  afterAll(async () => { if (!prisma) return; await prisma.expensePayment.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.expense.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.user.deleteMany({ where: { organizationId: { in: [organizationId, otherOrganizationId] } } }); await prisma.organization.deleteMany({ where: { id: { in: [organizationId, otherOrganizationId] } } }); await app.close(); });
  const auth = () => ({ Authorization: `Bearer ${token}` });

  it('creates an Expense, records partial payments, derives balance, and lists financial status', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/expenses').set(auth()).send({ category: 'UTILITIES', description: 'Conta de energia', amount: '100.00', dueDate: '2026-01-10' }).expect(201);
    expect(created.body).toMatchObject({ amount: '100.00', paid: '0.00', balance: '100.00', financialStatus: 'UNPAID' });
    await request(app.getHttpServer()).post(`/api/v1/expenses/${created.body.id}/payments`).set(auth()).send({ amount: '35.10', method: 'PIX', paidAt: '2026-01-01T10:00:00.000Z' }).expect(201).expect((response) => expect(response.body).toMatchObject({ paid: '35.10', balance: '64.90', financialStatus: 'PARTIAL' }));
    await request(app.getHttpServer()).post(`/api/v1/expenses/${created.body.id}/payments`).set(auth()).send({ amount: '64.90', method: 'BANK_TRANSFER', paidAt: '2026-01-02T10:00:00.000Z' }).expect(201).expect((response) => expect(response.body).toMatchObject({ paid: '100.00', balance: '0.00', financialStatus: 'PAID' }));
    const listed = await request(app.getHttpServer()).get('/api/v1/expenses?financialStatus=PAID&page=1&pageSize=20').set(auth()).expect(200);
    expect(listed.body.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: created.body.id, financialStatus: 'PAID' })]));
    expect(await prisma.expensePayment.count({ where: { expenseId: created.body.id, status: 'CONFIRMED' } })).toBe(2);
  });

  it('prevents overpayment and cross-organization access', async () => {
    await request(app.getHttpServer()).get(`/api/v1/expenses/${otherExpenseId}`).set(auth()).expect(404);
    const created = await request(app.getHttpServer()).post('/api/v1/expenses').set(auth()).send({ category: 'RENT', description: 'Aluguel', amount: '100.00', dueDate: '2026-01-10' }).expect(201);
    await request(app.getHttpServer()).post(`/api/v1/expenses/${created.body.id}/payments`).set(auth()).send({ amount: '100.01', method: 'CASH', paidAt: '2026-01-03T10:00:00.000Z' }).expect(409).expect((response) => expect(response.body.code).toBe('EXPENSE_PAYMENT_EXCEEDS_BALANCE'));
    await request(app.getHttpServer()).post(`/api/v1/expenses/${otherExpenseId}/payments`).set(auth()).send({ amount: '1.00', method: 'CASH', paidAt: '2026-01-03T10:00:00.000Z' }).expect(404);
  });

  it('preserves confirmed payments and rejects editing or cancelling a paid Expense', async () => {
    const created = await request(app.getHttpServer()).post('/api/v1/expenses').set(auth()).send({ category: 'MAINTENANCE', description: 'Manutenção', amount: '50.00', dueDate: '2026-01-10' }).expect(201);
    const payment = await request(app.getHttpServer()).post(`/api/v1/expenses/${created.body.id}/payments`).set(auth()).send({ amount: '20.00', method: 'PIX', paidAt: '2026-01-04T10:00:00.000Z' }).expect(201);
    await request(app.getHttpServer()).patch(`/api/v1/expenses/${created.body.id}`).set(auth()).send({ description: 'Alterada' }).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/expenses/${created.body.id}/cancel`).set(auth()).expect(409);
    await request(app.getHttpServer()).post(`/api/v1/expenses/${created.body.id}/payments/${payment.body.payment.id}/cancel`).set(auth()).expect(201);
    expect(await prisma.expensePayment.findUnique({ where: { id: payment.body.payment.id }, select: { status: true } })).toMatchObject({ status: 'CANCELLED' });
  });
});
