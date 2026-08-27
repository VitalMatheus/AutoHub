import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { SecurityLogger } from './common/security.logger';
import type { OpenAPIObject, OperationObject, ResponseObject } from '@nestjs/swagger';

export const DECIMAL_STRING_SCHEMA = {
  type: 'string',
  pattern: '^\\d+(\\.\\d{1,2})?$',
  description: 'Decimal monetary value serialized as a string.',
  example: '149.90',
};

/**
 * Performs the small set of contract invariants that the frontend relies on.
 * This is intentionally independent from Nest's implementation details, so it
 * can also be used by CI against a saved/generated OpenAPI document.
 */
export function validateOpenApiContract(document: OpenAPIObject): void {
  if (!/^3\./.test(document.openapi)) throw new Error('OpenAPI 3 document required');
  if (!document.info?.title || !document.info.version) throw new Error('OpenAPI info is required');
  if (!document.paths || Object.keys(document.paths).length === 0) throw new Error('OpenAPI paths are required');
  if (!document.components?.securitySchemes?.bearer) throw new Error('Bearer security scheme is required');
  const problem = document.components.schemas?.ProblemDetails as { required?: string[] } | undefined;
  if (!problem?.required?.includes('status') || !problem.required.includes('detail') || !problem.required.includes('code')) {
    throw new Error('ProblemDetails schema is incomplete');
  }
  const decimal = document.components.schemas?.DecimalString as { type?: string; pattern?: string } | undefined;
  if (decimal?.type !== 'string' || !decimal.pattern) throw new Error('DecimalString schema is incomplete');
  for (const requiredPath of ['/api/v1/health', '/api/v1/customers', '/api/v1/vehicles', '/api/v1/quotes/{id}/approve', '/api/v1/work-orders', '/api/v1/work-orders/{workOrderId}/payments']) {
    if (!document.paths[requiredPath]) throw new Error(`Required path is missing: ${requiredPath}`);
  }
  for (const [path, item] of Object.entries(document.paths)) {
    for (const operation of Object.values(item)) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
      const responses = (operation as OperationObject).responses ?? {};
      if (Object.keys(responses).length === 0) throw new Error(`Operation ${path} has no responses`);
      for (const [status, response] of Object.entries(responses)) {
        if (!/^\d{3}$/.test(status) && status !== 'default') throw new Error(`Invalid response status on ${path}`);
        if (!response || typeof response !== 'object' || !('description' in response)) throw new Error(`Response description is missing on ${path}`);
      }
      if ((operation as OperationObject).security?.length && !responses['401']) throw new Error(`Protected operation ${path} lacks 401 response`);
    }
  }
}

function publishCommonResponses(document: OpenAPIObject): void {
  const problemRef = { $ref: '#/components/schemas/ProblemDetails' };
  const common: Record<string, ResponseObject> = {
    '400': { description: 'Invalid request.', content: { 'application/problem+json': { schema: problemRef } } },
    '401': { description: 'Authentication required.', content: { 'application/problem+json': { schema: problemRef } } },
    '403': { description: 'Insufficient role or access.', content: { 'application/problem+json': { schema: problemRef } } },
    '404': { description: 'Resource not found in the authenticated Organization.', content: { 'application/problem+json': { schema: problemRef } } },
    '429': { description: 'Too many requests.', content: { 'application/problem+json': { schema: problemRef } } },
  };
  for (const item of Object.values(document.paths)) {
    for (const operation of Object.values(item)) {
      if (!operation || typeof operation !== 'object' || !('responses' in operation)) continue;
      const target = operation as OperationObject;
      // Public operations (health and authentication bootstrap endpoints) do
      // not advertise authorization failures they cannot produce.
      if (!target.security?.length) continue;
      target.responses ??= {};
      for (const [status, response] of Object.entries(common)) target.responses[status] ??= response;
    }
  }
}

export function createOpenApiDocument(app: INestApplication): OpenAPIObject {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AutoHub API')
    .setDescription('REST API for the AutoHub workshop-management SaaS')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas.ProblemDetails = {
    type: 'object',
    required: ['type', 'title', 'status', 'detail', 'instance', 'code'],
    properties: {
      type: { type: 'string', format: 'uri' },
      title: { type: 'string' },
      status: { type: 'integer' },
      detail: { type: 'string' },
      instance: { type: 'string' },
      code: { type: 'string' },
    },
  };
  document.components.schemas.DecimalString = DECIMAL_STRING_SCHEMA;
  publishCommonResponses(document);
  validateOpenApiContract(document);
  return document;
}

export function configureApplication(app: INestApplication): void {
  const config = app.get(ConfigService);
  const prefix = config.getOrThrow<string>('API_PREFIX');
  const nodeEnvironment = config.getOrThrow<string>('NODE_ENV');

  app.setGlobalPrefix(prefix);
  app.use(helmet());
  app.enableCors({
    origin: config.getOrThrow<string>('CORS_ORIGINS').split(',').map((origin) => origin.trim()),
  });
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }));
  app.useGlobalFilters(new ProblemDetailsFilter(app.get(SecurityLogger)));

  // Swagger is intentionally unavailable in production, even if an old
  // environment still contains SWAGGER_ENABLED=true.
  if (config.getOrThrow<boolean>('SWAGGER_ENABLED') && nodeEnvironment !== 'production') {
    SwaggerModule.setup(`${prefix}/docs`, app, createOpenApiDocument(app));
  }
}
