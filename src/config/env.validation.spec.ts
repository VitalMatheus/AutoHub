import { environmentValidationSchema } from './env.validation';

const base = {
  DATABASE_URL: 'postgresql://user:password@localhost:5432/database',
  CORS_ORIGINS: 'http://localhost:5173',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  EMAIL_DELIVERY_MODE: 'capture',
  TURNSTILE_REQUIRED: false,
  ASAAS_MODE: 'capture',
  RESEND_API_KEY: '',
  TURNSTILE_SECRET_KEY: '',
  ASAAS_API_KEY: '',
};

describe('environment validation', () => {
  it('allows empty integration secrets in local capture mode', () => {
    const result = environmentValidationSchema.validate(base);

    expect(result.error).toBeUndefined();
  });

  it.each([
    ['EMAIL_DELIVERY_MODE', { EMAIL_DELIVERY_MODE: 'resend' }],
    ['TURNSTILE_REQUIRED', { TURNSTILE_REQUIRED: true }],
    ['ASAAS_MODE', { ASAAS_MODE: 'sandbox' }],
  ])('requires the matching secret when %s is enabled', (_name, override) => {
    const result = environmentValidationSchema.validate({ ...base, ...override });

    expect(result.error?.message).toMatch(/required/);
  });
});
