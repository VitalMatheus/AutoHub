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
      title: 'Erro interno do servidor',
      detail: 'Ocorreu um erro inesperado.',
      code: 'HTTP_500',
    }));
    expect(JSON.stringify(json.mock.calls[0][0])).not.toMatch(/Prisma|SQL|stack|token|hash|secret/i);
  });

  it('keeps contract validation details while rejecting arbitrary exception messages', () => {
    const contract = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(new BadRequestException({ message: ['invalid'] }), contract.host);
    expect(contract.json).toHaveBeenCalledWith(expect.objectContaining({ status: 400, title: 'Requisição inválida', detail: 'Falha na validação da requisição.', code: 'HTTP_400' }));

    const unsafe = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(new BadRequestException('Prisma password hash: secret'), unsafe.host);
    expect(unsafe.json).toHaveBeenCalledWith(expect.objectContaining({ detail: 'Falha na validação da requisição.' }));
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
      detail: 'O pagamento excede o saldo da ordem de serviço.',
    }));
  });

  it('translates a known resource error and hides an unknown client error', () => {
    const known = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(new HttpException('Product not found', 404), known.host);
    expect(known.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 404,
      title: 'Recurso não encontrado',
      detail: 'Produto não encontrado.',
    }));

    const unknown = makeHost();
    new ProblemDetailsFilter({ record: jest.fn() } as never).catch(new HttpException('English implementation detail', 422), unknown.host);
    expect(unknown.json).toHaveBeenCalledWith(expect.objectContaining({
      status: 422,
      detail: 'Não foi possível concluir a solicitação.',
    }));
    expect(JSON.stringify(unknown.json.mock.calls[0][0])).not.toContain('English implementation detail');
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
