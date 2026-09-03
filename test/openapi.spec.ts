process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/autohub_test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.JWT_ACCESS_SECRET = 'test-only-jwt-access-secret-32-chars';

import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApplication, createOpenApiDocument, validateOpenApiContract } from '../src/bootstrap';

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
    const login = paths['/api/v1/auth/login']?.post;
    const refresh = paths['/api/v1/auth/refresh']?.post;
    const logout = paths['/api/v1/auth/logout']?.post;
    const me = paths['/api/v1/auth/me']?.get;
    expect(login?.responses['201']).toEqual(expect.objectContaining({ description: expect.any(String) }));
    expect(login?.responses['201']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokensResponseDto' } } } }));
    expect(login?.responses).toEqual(expect.objectContaining({ '400': expect.any(Object), '401': expect.any(Object), '429': expect.any(Object) }));
    expect(refresh?.security).toEqual([{ refreshCookie: [] }]);
    expect(refresh?.requestBody).toBeUndefined();
    expect(refresh?.responses['201']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthTokensResponseDto' } } } }));
    expect(refresh?.responses).toEqual(expect.objectContaining({ '400': expect.any(Object), '401': expect.any(Object), '403': expect.any(Object), '429': expect.any(Object) }));
    expect(logout?.responses['201']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/SuccessResponseDto' } } } }));
    expect(me?.responses['200']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/AuthenticatedPrincipalResponseDto' } } } }));
    expect(paths['/api/v1/auth/activate']?.post).toBeDefined();
    expect(paths['/api/v1/auth/activate']?.post?.responses).toEqual(expect.objectContaining({ '400': expect.any(Object), '401': expect.any(Object), '429': expect.any(Object) }));
    expect(paths['/api/v1/quotes/{id}/approve']).toBeDefined();
    const auditEventsGet = paths['/api/v1/platform/audit-events']?.get;
    expect(auditEventsGet).toBeDefined();
    const parameterNames = auditEventsGet?.parameters?.flatMap((parameter) => 'name' in parameter ? [parameter.name] : []) ?? [];
    expect(parameterNames).toEqual(expect.arrayContaining(['from', 'to', 'actor', 'action', 'targetType', 'target', 'cursor', 'pageSize']));
    const auditResponse = auditEventsGet?.responses['200'];
    const auditResponseContent = auditResponse && 'content' in auditResponse ? auditResponse.content : undefined;
    expect(auditResponseContent?.['application/json']?.schema).toEqual({ $ref: '#/components/schemas/AuditEventsResponseDto' });
    expect(schemas.AuditEventsResponseDto).toBeDefined();
    expect(paths['/api/v1/platform/organizations/{id}/activate']?.post).toBeDefined();
    expect(paths['/api/v1/platform/organizations/{id}/deactivate']?.post).toBeDefined();
    expect(paths['/api/v1/platform/organizations/{id}/suspend']?.post).toBeDefined();
    expect(paths['/api/v1/platform/organizations/{id}/reactivate']?.post).toBeDefined();
    const registerOrganization = paths['/api/v1/platform/organizations']?.post;
    expect(registerOrganization?.requestBody).toEqual(expect.objectContaining({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateOrganizationDto' } } },
    }));
    expect(registerOrganization?.responses).toEqual(expect.objectContaining({
      '201': expect.objectContaining({ content: expect.objectContaining({ 'application/json': { schema: { $ref: '#/components/schemas/CreateOrganizationResponseDto' } } }) }),
      '400': expect.any(Object), '401': expect.any(Object), '403': expect.any(Object), '409': expect.any(Object),
    }));
    expect(schemas.CreateOrganizationDto).toEqual(expect.objectContaining({
      required: expect.arrayContaining(['name', 'phone', 'admin', 'firstDueDate', 'billingDay']),
      properties: expect.objectContaining({
        contractedPrice: expect.objectContaining({ type: 'string', default: '79.00' }),
        firstDueDate: expect.objectContaining({ type: 'string', format: 'date' }),
        billingDay: expect.objectContaining({ type: 'number', minimum: 1, maximum: 28 }),
      }),
    }));
    expect((schemas.CreateOrganizationDto as { properties?: Record<string, unknown> }).properties).not.toEqual(expect.objectContaining({
      planVersionId: expect.anything(), commercialAccountId: expect.anything(), trialEnabled: expect.anything(), trialStartsAt: expect.anything(),
    }));
    expect(schemas.CreateOrganizationResponseDto).toEqual(expect.objectContaining({
      properties: expect.objectContaining({ activationSecret: expect.objectContaining({ type: 'string', writeOnly: true }) }),
    }));
    const regularizeCommercialSetup = paths['/api/v1/platform/organizations/{id}/regularize-commercial-setup']?.post;
    expect(regularizeCommercialSetup?.requestBody).toEqual(expect.objectContaining({
      content: { 'application/json': { schema: { $ref: '#/components/schemas/RegularizeCommercialSetupDto' } } },
    }));
    expect(regularizeCommercialSetup?.responses).toEqual(expect.objectContaining({
      '201': expect.any(Object), '400': expect.any(Object), '401': expect.any(Object), '403': expect.any(Object), '404': expect.any(Object), '409': expect.any(Object),
    }));
    const organizationsGet = paths['/api/v1/platform/organizations']?.get;
    expect(organizationsGet?.responses['200']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/OrganizationsResponseDto' } } } }));
    expect(organizationsGet?.responses).toEqual(expect.objectContaining({ '401': expect.any(Object), '403': expect.any(Object) }));
    expect(organizationsGet?.parameters?.flatMap((parameter) => 'name' in parameter ? [parameter.name] : [])).toEqual(expect.arrayContaining(['search', 'operationalStatus', 'lifecycle', 'commercialAccess', 'financialStanding', 'sort', 'page', 'pageSize']));
    expect(paths['/api/v1/platform/organizations/{id}']?.get?.responses['200']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/OrganizationResponseDto' } } } }));
    expect(schemas.OrganizationResponseDto).toEqual(expect.objectContaining({
      properties: expect.objectContaining({
        operationalStatus: expect.any(Object),
        financialStanding: expect.objectContaining({ $ref: '#/components/schemas/OrganizationFinancialStandingDto' }),
      }),
    }));
    expect(paths['/api/v1/platform/plans']?.get).toBeDefined();
    const dashboardGet = paths['/api/v1/dashboard']?.get;
    expect(dashboardGet).toBeDefined();
    expect(dashboardGet?.parameters?.flatMap((parameter) => 'name' in parameter ? [parameter.name] : [])).toEqual(expect.arrayContaining(['asOf', 'from', 'to']));
    expect(dashboardGet?.responses['200']).toEqual(expect.objectContaining({ content: { 'application/json': { schema: { $ref: '#/components/schemas/DashboardResponseDto' } } } }));
    expect(schemas.DashboardResponseDto).toBeDefined();
    expect(paths['/api/v1/platform/commercial-accounts']?.get).toBeDefined();
    expect(paths['/api/v1/platform/commercial-accounts/{id}']?.get).toBeDefined();
    expect(paths['/api/v1/platform/plans/{id}/versions/{versionId}/publish']?.post).toBeDefined();
    expect(Object.keys(paths).some((path) => path.includes('/payments'))).toBe(true);
    expect(schemas.ProblemDetails).toEqual(expect.objectContaining({ type: 'object' }));
    expect(schemas.DecimalString).toEqual(expect.objectContaining({ type: 'string', pattern: expect.any(String) }));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('DRAFT'));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('CONFIRMED'));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('SERVICE'));
    expect(JSON.stringify(document)).toEqual(expect.stringContaining('PENDING'));
    expect(document.paths['/api/v1/customers']?.get?.responses['401']).toBeDefined();
    expect(document.paths['/api/v1/customers']?.get?.responses['404']).toBeDefined();
    expect(() => validateOpenApiContract(document)).not.toThrow();

    await app.close();
  });

  it('rejects an incomplete contract before it can be published', () => {
    expect(() => validateOpenApiContract({ openapi: '2.0', info: { title: 'bad', version: '1' }, paths: {} } as never))
      .toThrow('OpenAPI 3 document required');
  });
});
