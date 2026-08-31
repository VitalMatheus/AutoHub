import { AxiosError } from 'axios';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getAccessToken, getUserFacingError, httpClient, setAccessToken, setRefreshAccessTokenHandler } from './http';

describe('HTTP authentication boundary', () => {
  beforeEach(() => {
    setAccessToken('expired-token');
    setRefreshAccessTokenHandler(null);
  });

  afterEach(() => {
    setAccessToken(null);
    setRefreshAccessTokenHandler(null);
    vi.restoreAllMocks();
  });

  it('shares one refresh operation and retries each expired request once', async () => {
    let operationalRequests = 0;
    let refreshRequests = 0;
    let releaseRefresh!: () => void;
    const refreshFinished = new Promise<void>((resolve) => { releaseRefresh = resolve; });
    const adapter = httpClient.defaults.adapter;
    httpClient.defaults.adapter = async (config) => {
      if (config.url === '/auth/refresh') {
        refreshRequests += 1;
        await refreshFinished;
        return { data: { accessToken: 'fresh-token', expiresIn: 900, tokenType: 'Bearer' }, status: 200, statusText: 'OK', headers: {}, config };
      }
      operationalRequests += 1;
      if (operationalRequests <= 2) {
        throw new AxiosError('expired', 'ERR_BAD_RESPONSE', config, undefined, {
          status: 401,
          statusText: 'Unauthorized',
          headers: {},
          config,
          data: { status: 401, detail: 'Sessão expirada.', code: 'HTTP_401' },
        });
      }
      return { data: { ok: true }, status: 200, statusText: 'OK', headers: {}, config };
    };
    setRefreshAccessTokenHandler(async () => {
      const response = await httpClient.post('/auth/refresh');
      return response.data.accessToken;
    });

    const requests = Promise.all([httpClient.get('/customers'), httpClient.get('/vehicles')]);
    await vi.waitFor(() => expect(refreshRequests).toBe(1));
    releaseRefresh();
    const responses = await requests;

    expect(responses).toHaveLength(2);
    expect(operationalRequests).toBe(4);
    expect(refreshRequests).toBe(1);
    expect(getAccessToken()).toBe('fresh-token');
    httpClient.defaults.adapter = adapter;
  });

  it('does not retry authentication endpoints after a 401', async () => {
    const post = vi.spyOn(httpClient, 'post').mockRejectedValue(new Error('refresh failed'));
    setRefreshAccessTokenHandler(async () => 'never-used');

    await expect(httpClient.post('/auth/refresh')).rejects.toThrow('refresh failed');
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('does not start another refresh after the retried request receives 401', async () => {
    let refreshRequests = 0;
    const adapter = httpClient.defaults.adapter;
    httpClient.defaults.adapter = async (config) => {
      throw new AxiosError('expired', 'ERR_BAD_RESPONSE', config, undefined, {
        status: 401,
        statusText: 'Unauthorized',
        headers: {},
        config,
        data: { status: 401, detail: 'Sessão expirada.', code: 'HTTP_401' },
      });
    };
    setRefreshAccessTokenHandler(async () => {
      refreshRequests += 1;
      return 'fresh-token';
    });

    await expect(httpClient.get('/customers')).rejects.toThrow('Sessão expirada.');
    expect(refreshRequests).toBe(1);
    httpClient.defaults.adapter = adapter;
  });
});

describe('HTTP error presentation', () => {
  it('translates known legacy API details and uses a safe Portuguese fallback', () => {
    expect(getUserFacingError({ status: 409, detail: 'Payment exceeds the Work Order balance.', code: 'PAYMENT_EXCEEDS_BALANCE' }, 'fallback')).toBe('O pagamento excede o saldo da ordem de serviço.');
    expect(getUserFacingError({ status: 500, detail: 'The request could not be completed.', code: 'HTTP_500' }, 'fallback')).toBe('Não foi possível concluir a solicitação.');
  });

  it('keeps a Portuguese API detail when it is already safe to show', () => {
    expect(getUserFacingError({ status: 404, detail: 'Produto não encontrado.', code: 'HTTP_404' }, 'fallback')).toBe('Produto não encontrado.');
  });

  it.each([
    ['QUOTE_NOT_APPROVED', 'Only approved Quotes can be converted into Work Orders.', 'Apenas orçamentos aprovados podem ser convertidos em ordens de serviço.'],
    ['WORK_ORDER_INVALID_TRANSITION', 'Work Order cannot complete from OPEN.', 'A transição solicitada para a ordem de serviço não é permitida.'],
    ['HTTP_409', 'Product SKU already exists in this Organization', 'O SKU do produto já existe nesta oficina.'],
    ['HTTP_404', 'Service not found', 'Serviço não encontrado.'],
  ])('translates %s API errors without exposing the original detail', (code, detail, expected) => {
    expect(getUserFacingError({ status: 409, detail, code }, 'fallback')).toBe(expected);
  });

  it('uses a safe Portuguese fallback for unknown technical details', () => {
    expect(getUserFacingError({ status: 500, detail: 'PrismaClientKnownRequestError: SQL detail', code: 'HTTP_500' }, 'Não foi possível salvar.')).toBe('Não foi possível salvar.');
  });
});
