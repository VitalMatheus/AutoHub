import { BadRequestException, ConflictException, HttpException } from '@nestjs/common';
import { ProblemDetailsFilter } from './problem-details.filter';

describe('ProblemDetailsFilter', () => {
  function makeHost() {
    const json = jest.fn();
    const response = { status: jest.fn().mockReturnThis(), type: jest.fn().mockReturnThis(), json };
    return { host: { switchToHttp: () => ({ getResponse: () => response, getRequest: () => ({ method: 'GET', path: '/request', url: '/request' }) }) } as never, response, json };
  }

  it('returns a safe Problem Details body for unknown internal errors', () => {
    const { host, response, json } = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(
      new Error('Prisma SQL stack token hash secret'),
      host,
    );

    expect(response.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      status: 500,
      detail: 'An unexpected error occurred.',
      code: 'HTTP_500',
    }));
    expect(JSON.stringify(json.mock.calls[0][0])).not.toMatch(/Prisma|SQL|stack|token|hash|secret/i);
  });

  it('keeps contract validation details while rejecting arbitrary exception messages', () => {
    const contract = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(new BadRequestException({ message: ['invalid'] }), contract.host);
    expect(contract.json).toHaveBeenCalledWith(expect.objectContaining({ status: 400, detail: 'Request validation failed.', code: 'HTTP_400' }));

    const unsafe = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(new BadRequestException('Prisma password hash: secret'), unsafe.host);
    expect(unsafe.json).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Request validation failed.' }));
  });

  it('preserves a known coded contract error with a sanitized detail', () => {
    const contract = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(
      new ConflictException({ code: 'PAYMENT_EXCEEDS_BALANCE', detail: 'Prisma secret' }),
      contract.host,
    );
    expect(contract.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 409,
      code: 'PAYMENT_EXCEEDS_BALANCE',
      detail: 'Payment exceeds the Work Order balance.',
    }));
  });

  it('records rate-limit failures as structured security events', () => {
    const securityLogger = { record: jest.fn() };
    const { host } = makeHost();
    new ProblemDetailsFilter(securityLogger as never).catch(new HttpException('Too many requests', 429), host);
    expect(securityLogger.record).toHaveBeenCalledWith(expect.objectContaining({
      event: 'rate_limit.failure', status: 429,
    }));
  });
});
