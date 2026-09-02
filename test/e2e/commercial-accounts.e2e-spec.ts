import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Platform Commercial Accounts (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let accountId: string;
  let organizationId: string;
  let contactId: string;
  let superToken: string;
  let adminToken: string;
  const suffix = Date.now();
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    const hash = await argon2.hash(password, { type: argon2.argon2id });
    const platform = await prisma.user.create({ data: { name: 'Commercial Operator', email: `commercial-super-${suffix}@example.com`, passwordHash: hash, role: 'SUPER_ADMIN', status: 'ACTIVE' } });
    const account = await prisma.commercialAccount.create({ data: { name: `Commercial ${suffix}` } });
    accountId = account.id;
    const organization = await prisma.organization.create({ data: { name: `Commercial Unit ${suffix}`, commercialAccountId: account.id, operationalStatus: 'ACTIVE' } });
    organizationId = organization.id;
    const contact = await prisma.user.create({ data: { name: 'Primary Admin', email: `commercial-admin-${suffix}@example.com`, passwordHash: hash, role: 'ADMIN', status: 'ACTIVE', organizationId: organization.id } });
    contactId = contact.id;
    await prisma.commercialAccount.update({ where: { id: account.id }, data: { primaryContactOrganizationId: organization.id, primaryContactUserId: contact.id } });
    const operatorLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: platform.email, password }).expect(201);
    superToken = operatorLogin.body.accessToken;
    const adminLogin = await request(app.getHttpServer()).post('/api/v1/auth/login').send({ email: contact.email, password }).expect(201);
    adminToken = adminLogin.body.accessToken;
  });

  afterAll(async () => {
    await prisma.commercialAccount.update({ where: { id: accountId }, data: { primaryContactOrganizationId: null, primaryContactUserId: null } });
    await prisma.user.delete({ where: { id: contactId } });
    await prisma.organization.delete({ where: { id: organizationId } });
    await prisma.commercialAccount.delete({ where: { id: accountId } });
    await prisma.user.deleteMany({ where: { email: `commercial-super-${suffix}@example.com` } });
    await app.close();
  });

  it('lists and details the account, unit, and active ADMIN contact', async () => {
    const list = await request(app.getHttpServer()).get('/api/v1/platform/commercial-accounts').set('Authorization', `Bearer ${superToken}`).expect(200);
    const found = list.body.data.find((item: { id: string }) => item.id === accountId);
    expect(found).toEqual(expect.objectContaining({ id: accountId, missingPrimaryContact: false }));
    expect(found.primaryContact).toEqual(expect.objectContaining({ id: contactId, role: 'ADMIN', status: 'ACTIVE' }));
    expect(found.organizations).toEqual(expect.arrayContaining([expect.objectContaining({ id: organizationId, operationalStatus: 'ACTIVE' })]));

    const detail = await request(app.getHttpServer()).get(`/api/v1/platform/commercial-accounts/${accountId}`).set('Authorization', `Bearer ${superToken}`).expect(200);
    expect(detail.body.primaryContact.id).toBe(contactId);
  });

  it('keeps commercial account reads exclusive to Super Admins and has no transfer/delete routes', async () => {
    await request(app.getHttpServer()).get('/api/v1/platform/commercial-accounts').expect(401);
    await request(app.getHttpServer()).get('/api/v1/platform/commercial-accounts').set('Authorization', `Bearer ${adminToken}`).expect(403);
    await request(app.getHttpServer()).post(`/api/v1/platform/commercial-accounts/${accountId}/transfer`).set('Authorization', `Bearer ${superToken}`).send({ organizationId }).expect(404);
    await request(app.getHttpServer()).delete(`/api/v1/platform/commercial-accounts/${accountId}`).set('Authorization', `Bearer ${superToken}`).expect(404);
  });

  it('rejects a Primary Contact from another Commercial Account at the database boundary', async () => {
    const otherAccount = await prisma.commercialAccount.create({ data: { name: `Other Commercial ${suffix}` } });
    const otherOrganization = await prisma.organization.create({ data: { name: `Other Unit ${suffix}`, commercialAccountId: otherAccount.id } });
    const otherContact = await prisma.user.create({ data: {
      name: 'Other Admin', email: `other-admin-${suffix}@example.com`, passwordHash: await argon2.hash(password, { type: argon2.argon2id }), role: 'ADMIN', status: 'ACTIVE', organizationId: otherOrganization.id,
    } });

    await expect(prisma.commercialAccount.update({
      where: { id: accountId },
      data: { primaryContactOrganizationId: otherOrganization.id, primaryContactUserId: otherContact.id },
    })).rejects.toMatchObject({ code: 'P2003' });

    await prisma.user.delete({ where: { id: otherContact.id } });
    await prisma.organization.delete({ where: { id: otherOrganization.id } });
    await prisma.commercialAccount.delete({ where: { id: otherAccount.id } });
  });
});
