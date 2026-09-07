import Joi from 'joi';

/**
 * Validate configuration before any module that depends on it is created.
 * Authentication secrets are required in every environment that can start
 * the authentication module.
 */
export const environmentValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  API_PREFIX: Joi.string().pattern(/^api\/v[1-9][0-9]*$/).default('api/v1'),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  CORS_ORIGINS: Joi.string().custom((value, helpers) => {
    const origins = value.split(',').map((origin: string) => origin.trim()).filter(Boolean);
    if (origins.length === 0 || origins.some((origin: string) => !/^https?:\/\/[^\s]+$/.test(origin))) {
      return helpers.error('string.uri');
    }
    return origins.join(',');
  }).required(),
  SWAGGER_ENABLED: Joi.boolean().truthy('true').falsy('false').default(true),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_ACCESS_TTL: Joi.string().default('15m'),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().positive().default(30),
  // Optional shared parent domain for an approved hostname migration. It is
  // intentionally unset by default so local cookies remain host-only.
  REFRESH_COOKIE_DOMAIN: Joi.string().pattern(/^[A-Za-z0-9.-]+$/).optional(),
  ACTIVATION_TOKEN_TTL_DAYS: Joi.number().integer().positive().default(3),
  ARGON2_MEMORY_COST: Joi.number().integer().positive().default(65536),
  ARGON2_TIME_COST: Joi.number().integer().positive().default(3),
  ARGON2_PARALLELISM: Joi.number().integer().positive().default(1),
  SUPER_ADMIN_EMAIL: Joi.string().email().optional(),
  SUPER_ADMIN_PASSWORD: Joi.string().min(12).max(128).optional(),
  SUPER_ADMIN_NAME: Joi.string().min(1).max(120).optional(),
  THROTTLE_TTL: Joi.number().integer().positive().default(60000),
  THROTTLE_LIMIT: Joi.number().integer().positive().default(100),
  EMAIL_DELIVERY_MODE: Joi.string().valid('capture', 'resend').default('capture'),
  RESEND_API_KEY: Joi.string().when('EMAIL_DELIVERY_MODE', { is: 'resend', then: Joi.required(), otherwise: Joi.optional() }),
  RESEND_FROM: Joi.string().default('Vekar <noreply@example.com>'),
  PUBLIC_APP_URL: Joi.string().uri({ scheme: ['http', 'https'] }).default('http://localhost:5173'),
  TURNSTILE_REQUIRED: Joi.boolean().truthy('true').falsy('false').default(false),
  TURNSTILE_SECRET_KEY: Joi.string().when('TURNSTILE_REQUIRED', { is: true, then: Joi.required(), otherwise: Joi.optional() }),
  TRIAL_ELIGIBILITY_PEPPER: Joi.string().min(16).optional(),
  ACQUISITION_FUNNEL_PEPPER: Joi.string().min(16).optional(),
  ASAAS_MODE: Joi.string().valid('capture', 'sandbox', 'production').default('capture'),
  ASAAS_API_KEY: Joi.string().when('ASAAS_MODE', { is: Joi.valid('sandbox', 'production'), then: Joi.required(), otherwise: Joi.optional() }),
  ASAAS_WEBHOOK_SECRET: Joi.string().min(16).default('local-asaas-webhook-secret'),
});
