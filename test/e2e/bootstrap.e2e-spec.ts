import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';
import { SecurityLogger } from '../../src/common/security.logger';

describe('Bootstrap (e2e)', () => {
  jest.setTimeout(30_000);

  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    configureApplication(app);
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('reports application and database readiness through the versioned API', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ status: 'ok', database: 'up' });
      });
  });

  it('publishes OpenAPI documentation', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/docs-json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.openapi).toMatch(/^3\./);
        expect(body.paths['/api/v1/health']).toBeDefined();
        expect(body.components.securitySchemes.bearer).toBeDefined();
        expect(body.components.securitySchemes.refreshCookie).toEqual(expect.objectContaining({ type: 'apiKey', in: 'cookie', name: 'autohub_refresh' }));
        expect(body.paths['/api/v1/auth/refresh'].post.security).toEqual([{ refreshCookie: [] }]);
        expect(body.paths['/api/v1/auth/refresh'].post.requestBody).toBeUndefined();
        expect(body.components.schemas.ProblemDetails.required).toEqual(expect.arrayContaining(['status', 'detail', 'code']));
        expect(body.components.schemas.DecimalString.pattern).toContain('\\d');
        expect(body.paths['/api/v1/health'].get.responses['401']).toBeUndefined();
        expect(body.paths['/api/v1/customers'].get.responses['401']).toBeDefined();
        expect(body.paths['/api/v1/quotes/{id}/approve']).toBeDefined();
        expect(body.paths['/api/v1/work-orders/{quoteId}']).toBeUndefined();
        expect(Object.keys(body.paths).some((path) => path.includes('/payments'))).toBe(true);
        expect(body.paths['/api/v1/public/registrations'].post.security).toBeUndefined();
        expect(body.paths['/api/v1/public/registrations'].post.requestBody.content['application/json'].schema.$ref).toContain('CreateRegistrationDto');
        expect(body.paths['/api/v1/public/registrations'].post.requestBody.content['application/json'].schema.$ref).not.toMatch(/Organization|Plan|Subscription/);
      });
  });

  it('executes a public operation discovered from the generated contract', async () => {
    const contract = await request(app.getHttpServer()).get('/api/v1/docs-json').expect(200);
    const path = '/api/v1/health';
    const operation = contract.body.paths[path].get;
    const expectedStatus = Number(Object.keys(operation.responses).find((status) => /^2\d\d$/.test(status)));
    expect(expectedStatus).toBe(200);
    const response = await request(app.getHttpServer()).get(path).expect(expectedStatus);
    expect(response.body).toMatchObject({ status: 'ok' });
  });

  it('publishes transport hardening and rejects unexpected input without internals', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: 'invalid password', passwordHash: 'do-not-accept' })
      .expect(400);
    expect(response.headers['content-security-policy']).toBeDefined();
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.body).toMatchObject({ status: 400, detail: 'Request validation failed.' });
    expect(JSON.stringify(response.body)).not.toMatch(/passwordHash|refreshToken|stack|Prisma|SQL/i);
  });

  it('enforces the configured CORS allowlist and records sensitive-route throttling', async () => {
    const allowed = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', 'http://localhost:5173').expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');
    const rejected = await request(app.getHttpServer()).get('/api/v1/health').set('Origin', 'https://attacker.example').expect(200);
    expect(rejected.headers['access-control-allow-origin']).toBeUndefined();

    const logger = app.get(SecurityLogger);
    const record = jest.spyOn(logger, 'record');
    const responses = [];
    for (let attempt = 0; attempt < 6; attempt += 1) {
      responses.push(await request(app.getHttpServer())
        .post('/api/v1/auth/login').send({ email: 'unknown@example.com', password: 'incorrect password' }));
      if (responses.at(-1)?.status === 429) break;
    }
    expect(responses.some((response) => response.status === 401)).toBe(true);
    expect(responses.some((response) => response.status === 429)).toBe(true);
    expect(record).toHaveBeenCalledWith(expect.objectContaining({ event: 'rate_limit.failure', status: 429 }));
  });
});
