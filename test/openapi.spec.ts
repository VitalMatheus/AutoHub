process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/autohub_test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET = 'test-only-jwt-access-secret-32-chars';

import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApplication, createOpenApiDocument } from '../src/bootstrap';

describe('OpenAPI structure', () => {
  it('generates the required local contract without starting PostgreSQL', async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    const app = moduleRef.createNestApplication();
    configureApplication(app);
    const document = createOpenApiDocument(app);
    const schemas = document.components?.schemas ?? {};
    const paths = document.paths;

    expect(document.openapi).toMatch(/^3\./);
    expect(document.components?.securitySchemes?.bearer).toBeDefined();
    expect(paths['/api/v1/health']).toBeDefined();
    expect(paths['/api/v1/quotes/{id}/approve']).toBeDefined();
    expect(Object.keys(paths).some((path) => path.includes('/payments'))).toBe(true);
    expect(schemas.ProblemDetails).toEqual(expect.objectContaining({ type: 'object' }));
    expect(schemas.DecimalString).toEqual(expect.objectContaining({ type: 'string', pattern: expect.any(String) }));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('DRAFT'));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('CONFIRMED'));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('SERVICE'));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('PENDING'));

    await app.close();
  });
});
