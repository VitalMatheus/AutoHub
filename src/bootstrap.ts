import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { ProblemDetailsFilter } from './common/problem-details.filter';
import { SecurityLogger } from './common/security.logger';
import type { OpenAPIObject } from '@nestjs/swagger';

export const DECIMAL_STRING_SCHEMA = {
  type: 'string',
  pattern: '^\\d+(\\.\\d{1,2})?$',
  description: 'Decimal monetary value serialized as a string.',
  example: '149.90',
};

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
