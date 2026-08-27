import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configureApplication } from '../../src/bootstrap';

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
        expect(body.components.schemas.ProblemDetails.required).toEqual(expect.arrayContaining(['status', 'detail', 'code']));
        expect(body.components.schemas.DecimalString.pattern).toContain('\\d');
        expect(body.paths['/api/v1/quotes/{id}/approve']).toBeDefined();
        expect(body.paths['/api/v1/work-orders/{quoteId}']).toBeUndefined();
        expect(Object.keys(body.paths).some((path) => path.includes('/payments'))).toBe(true);
      });
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
});
