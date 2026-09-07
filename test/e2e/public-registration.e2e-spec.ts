import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Public Self-Service Registration (e2e)', () => {
  jest.setTimeout(30_000);
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication(); configureApplication(app); await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => { await app?.close(); });

  it('accepts the public fields, creates one pending account, and stays neutral on retry', async () => {
    const email = `public-${Date.now()}@example.com`;
    const payload = { workshopName: 'Oficina Pública E2E', document: '529.982.247-25', phone: '81999999999', responsibleName: 'Ana Pública', email, password: 'a-secure-password', termsAccepted: true, privacyAccepted: true };
    const first = await request(app.getHttpServer()).post('/api/v1/public/registrations').send(payload).expect(202);
    const second = await request(app.getHttpServer()).post('/api/v1/public/registrations').send({ ...payload, email: email.toUpperCase(), document: '52998224725' }).expect(202);
    expect(first.body).toEqual(second.body);
    expect(JSON.stringify(first.body)).not.toMatch(/token|secret|organizationId|role/i);
    const user = await prisma.user.findUnique({ where: { email }, select: { status: true, passwordHash: true, organizationId: true } });
    expect(user).toMatchObject({ status: 'PENDING_ACTIVATION' });
    expect(user?.passwordHash).toBeTruthy();
    expect(await prisma.organization.count({ where: { document: '52998224725' } })).toBe(1);
  });
});
