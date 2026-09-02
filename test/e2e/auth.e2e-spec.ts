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
      accessToken: expect.any(String),
    }));
    expect(response.body).not.toHaveProperty('refreshToken');
    expect(response.headers['set-cookie']).toHaveLength(1);
    expect(response.headers['set-cookie'][0]).toMatch(/^autohub_refresh=[^;]+;/);
    expect(response.headers['set-cookie'][0]).toContain('HttpOnly');
    expect(response.headers['set-cookie'][0]).toContain('Path=/api/v1/auth');
    expect(response.headers['set-cookie'][0]).toContain('SameSite=Lax');
    expect(response.headers['set-cookie'][0]).not.toContain('Secure');
    const sessions = await prisma.session.findMany({ where: { user: { email } } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0].refreshTokenHash).toMatch(/^[a-f0-9]{64}$/);
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
    const oldCookie = login.headers['set-cookie'][0].split(';')[0];
    const refreshed = await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie).set('Origin', 'http://localhost:5173').expect(201);

    expect(refreshed.body).toEqual(expect.objectContaining({ tokenType: 'Bearer', expiresIn: 900, accessToken: expect.any(String) }));
    expect(refreshed.body).not.toHaveProperty('refreshToken');
    expect(refreshed.headers['set-cookie'][0]).not.toBe(oldCookie);
    await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', oldCookie).set('Origin', 'http://localhost:5173').expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${refreshed.body.accessToken}`).expect(200);
  });

  it('requires an allowed Origin for cookie-authenticated refresh', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', cookie).set('Origin', 'https://attacker.example').expect(403);
  });

  it('rejects cookie-authenticated refresh without an Origin', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const cookie = login.headers['set-cookie'][0].split(';')[0];

    await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', cookie).expect(403);
  });

  it('rejects malformed refresh cookies without leaking their value', async () => {
    const response = await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', 'autohub_refresh=%E0%A4%A')
      .set('Origin', 'http://localhost:5173')
      .expect(401);

    expect(JSON.stringify(response.body)).not.toContain('%E0%A4%A');
  });

  it('allows multiple sessions, then logs out only the current session', async () => {
    const firstAgent = request.agent(app.getHttpServer());
    const first = await firstAgent.post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const secondAgent = request.agent(app.getHttpServer());
    const second = await secondAgent.post('/api/v1/auth/login').send({ email, password }).expect(201);

    await firstAgent.post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${first.body.accessToken}`).set('Origin', 'http://localhost:5173').expect(201);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${first.body.accessToken}`).expect(401);
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${second.body.accessToken}`).expect(200);
    await secondAgent.post('/api/v1/auth/refresh').set('Origin', 'http://localhost:5173').expect(201);
  });

  it('clears the current refresh cookie on logout', async () => {
    const agent = request.agent(app.getHttpServer());
    const login = await agent.post('/api/v1/auth/login')
      .send({ email, password }).expect(201);

    const logout = await agent.post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`).set('Origin', 'http://localhost:5173').expect(201);
    expect(logout.headers['set-cookie'][0]).toMatch(/^autohub_refresh=;/);
    expect(logout.headers['set-cookie'][0]).not.toContain('Max-Age=');
    await agent.post('/api/v1/auth/refresh').set('Origin', 'http://localhost:5173').expect(401);
  });

  it('keeps bearer-only logout compatible without a refresh cookie', async () => {
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);

    await request(app.getHttpServer()).post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(201);
  });

  it('returns an operational-block Problem Details when an organization is disabled', async () => {
    const organization = await prisma.organization.create({ data: { name: 'Disabled Workshop' } });
    const adminEmail = `disabled-${Date.now()}@example.com`;
    const admin = await prisma.user.create({ data: {
      name: 'Disabled Admin', email: adminEmail, role: 'ADMIN', status: 'ACTIVE',
      organizationId: organization.id, passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const login = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: adminEmail, password }).expect(201);

    await prisma.organization.update({ where: { id: organization.id }, data: { operationalStatus: 'INACTIVE' } });
    await request(app.getHttpServer()).get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`).expect(403)
      .expect(({ body }) => {
        expect(body).toEqual(expect.objectContaining({
          code: 'ORGANIZATION_OPERATIONAL_BLOCKED',
          type: 'https://api.autohub.local/problems/organization-operational-blocked',
        }));
      });

    await prisma.user.delete({ where: { id: admin.id } });
    await prisma.organization.delete({ where: { id: organization.id } });
  });

  it('rejects refresh for disabled users and expired sessions', async () => {
    const disabledEmail = `disabled-user-${Date.now()}@example.com`;
    const disabledUser = await prisma.user.create({ data: {
      name: 'Disabled User', email: disabledEmail, role: 'SUPER_ADMIN', status: 'ACTIVE',
      passwordHash: await argon2.hash(password, { type: argon2.argon2id }),
    } });
    const disabledLogin = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email: disabledEmail, password }).expect(201);
    const disabledCookie = disabledLogin.headers['set-cookie'][0].split(';')[0];
    await prisma.user.update({ where: { id: disabledUser.id }, data: { status: 'DISABLED' } });
    await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', disabledCookie).set('Origin', 'http://localhost:5173').expect(401);

    const expiredLogin = await request(app.getHttpServer()).post('/api/v1/auth/login')
      .send({ email, password }).expect(201);
    const expiredCookie = expiredLogin.headers['set-cookie'][0].split(';')[0];
    await prisma.session.updateMany({
      where: { userId: (await prisma.user.findUniqueOrThrow({ where: { email } })).id, revokedAt: null },
      data: { expiresAt: new Date(Date.now() - 1_000) },
    });
    await request(app.getHttpServer()).post('/api/v1/auth/refresh')
      .set('Cookie', expiredCookie).set('Origin', 'http://localhost:5173').expect(401);

    await prisma.user.delete({ where: { id: disabledUser.id } });
  });
});
