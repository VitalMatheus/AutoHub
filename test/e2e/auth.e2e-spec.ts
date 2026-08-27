import { CanActivate, INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard } from '@nestjs/throttler';
import request from 'supertest';
import * as argon2 from 'argon2';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { PrismaService } from '../../src/prisma/prisma.service';

describe('Authentication (e2e)', () => {
  jest.setTimeout(30_000);

  let app: INestApplication;
  let prisma: PrismaService;
  const email = `super-admin-${Date.now()}@example.com`;
  const password = 'correct horse battery staple';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideGuard(ThrottlerGuard)
      .useValue({ canActivate: () => true } satisfies CanActivate)
      .compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
    prisma = app.get(PrismaService);
    await prisma.user.create({
      data: {
        name: 'E2E Super Admin', email, role: 'SUPER_ADMIN', status: 'ACTIVE',
        passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
      },
    });
  });

  afterAll(async () => {
    await prisma?.user.deleteMany({ where: { email } });
    await app?.close();
  });

  it('logs in with a normalized email and persists only a refresh hash', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: `  ${email.toUpperCase()} `, password })
      .expect(201);

    expect(response.body).toEqual(expect.objectContaining({
      tokenType: 'Bearer', expiresIn: 900,
      accessToken: expect.any(String), refreshToken: expect.any(String),
    }));
    const sessions = await prisma.session.findMany({ where: { user: { email } } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].refreshTokenHash).not.toBe(response.body.refreshToken);
  });

  it('returns the same safe error for an invalid password', async () => {
    await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password: 'wrong password that is long enough' })
      .expect(401)
      .expect(({ body }) => expect(body.detail).toBe('The request could not be completed.'));
  });

  it('materializes a safe principal and keeps access-token claims minimal', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const claims = JSON.parse(Buffer.from(login.body.accessToken.split('.')[1], 'base64url').toString());

    expect(Object.keys(claims).sort()).toEqual(['exp', 'iat', 'sid', 'sub']);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({
          id: expect.any(String), name: 'E2E Super Admin', email,
          role: 'SUPER_ADMIN', organizationId: null,
        });
        expect(body).not.toHaveProperty('passwordHash');
      });
  });

  it('rotates refresh credentials and rejects the previous one', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const refreshed = await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken }).expect(201);

    expect(refreshed.body.refreshToken).not.toBe(login.body.refreshToken);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken }).expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(200);
  });

  it('allows multiple sessions, then logs out only the current session', async () => {
    const first = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const second = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);

    await request(app.getHttpServer()).post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${first.body.accessToken}`).expect(201);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`).expect(200);
  });

  it('removes access when an organization is disabled', async () => {
    const organization = await prisma.organization.create({ data: { name: 'Disabled Workshop' } });
    const adminEmail = `disabled-${Date.now()}@example.com`;
    const admin = await prisma.user.create({ data: {
      name: 'Disabled Admin', email: adminEmail, role: 'ADMIN', status: 'ACTIVE',
      organizationId: organization.id, passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: adminEmail, password }).expect(201);

    await prisma.organization.update({ where: { id: organization.id }, data: { active: false } });
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(401);

    await prisma.user.delete({ where: { id: admin.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  });
});
