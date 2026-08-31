import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';

export type ProblemDetails = {
  type?: string;
  title?: string;
  status: number;
  detail: string;
  instance?: string;
  code: string;
};

export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail);
    this.name = 'ApiError';
    this.problem = problem;
  }
}

const LEGACY_ERROR_TRANSLATIONS: Record<string, string> = {
  'Payment exceeds the Work Order balance.': 'O pagamento excede o saldo da ordem de serviço.',
  'The request could not be completed.': 'Não foi possível concluir a solicitação.',
  'An unexpected error occurred.': 'Ocorreu um erro inesperado.',
  'Request validation failed.': 'Falha na validação da requisição.',
  'Only approved Quotes can be converted into Work Orders.': 'Apenas orçamentos aprovados podem ser convertidos em ordens de serviço.',
  'An approved Quote can generate only one Work Order.': 'Um orçamento aprovado pode gerar apenas uma ordem de serviço.',
  'Work Order cannot complete from OPEN.': 'A transição solicitada para a ordem de serviço não é permitida.',
  'Product SKU already exists in this Organization': 'O SKU do produto já existe nesta oficina.',
  'Service not found': 'Serviço não encontrado.',
  'Active Service not found': 'Serviço ativo não encontrado.',
  'Quote not found': 'Orçamento não encontrado.',
  'Work Order not found': 'Ordem de serviço não encontrada.',
  'Customer or Vehicle not found': 'Cliente ou veículo não encontrado.',
  'Customer not found': 'Cliente não encontrado.',
  'Vehicle not found': 'Veículo não encontrado.',
  'Organization not found': 'Oficina não encontrada.',
  'Quote Item not found': 'Item do orçamento não encontrado.',
  'Work Order Item not found': 'Item da ordem de serviço não encontrado.',
  'Only draft Quotes can be edited': 'Apenas orçamentos em rascunho podem ser editados.',
  'Customer document already exists in this Organization': 'O documento do cliente já existe nesta oficina.',
  'Vehicle plate already exists in this Organization': 'A placa do veículo já existe nesta oficina.',
  'Produto não encontrado.': 'Produto não encontrado.',
};

const CODE_ERROR_TRANSLATIONS: Record<string, string> = {
  PAYMENT_EXCEEDS_BALANCE: 'O pagamento excede o saldo da ordem de serviço.',
  PAYMENT_ALREADY_CANCELLED: 'O pagamento já está cancelado.',
  WORK_ORDER_CANCELLED: 'Ordens de serviço canceladas não podem receber pagamentos.',
};
const SAFE_DETAILS = new Set([...Object.values(LEGACY_ERROR_TRANSLATIONS), ...Object.values(CODE_ERROR_TRANSLATIONS)]);

/** Converts API-safe details to text that can be shown outside authentication screens. */
export function getUserFacingError(problem: Pick<ProblemDetails, 'status' | 'detail' | 'code'>, fallback: string): string {
  const byCode = CODE_ERROR_TRANSLATIONS[problem.code];
  if (byCode) return byCode;
  const byDetail = LEGACY_ERROR_TRANSLATIONS[problem.detail];
  if (byDetail) return byDetail;
  if (SAFE_DETAILS.has(problem.detail.trim())) return problem.detail.trim();
  return fallback;
}

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
let accessToken: string | null = null;
let refreshAccessToken: (() => Promise<string>) | null = null;
let handleRefreshFailure: (() => void) | null = null;
let refreshPromise: Promise<string> | null = null;

export const httpClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function setRefreshAccessTokenHandler(handler: (() => Promise<string>) | null): void {
  refreshAccessToken = handler;
}

export function setRefreshFailureHandler(handler: (() => void) | null): void {
  handleRefreshFailure = handler;
}

function isAuthRequest(url?: string): boolean {
  return Boolean(url && /\/auth\/(login|refresh|logout)$/.test(url));
}

function isRetriedRequest(config: InternalAxiosRequestConfig): boolean {
  return (config as InternalAxiosRequestConfig & { _authRetry?: boolean })._authRetry === true;
}

httpClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

httpClient.interceptors.response.use(undefined, async (error: AxiosError<ProblemDetails>) => {
  const config = error.config;
  if (error.response?.status === 401 && config && accessToken && refreshAccessToken && !isAuthRequest(config.url) && !isRetriedRequest(config)) {
    if (!refreshPromise) {
      refreshPromise = refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
    }
    try {
      const token = await refreshPromise;
      setAccessToken(token);
      (config as InternalAxiosRequestConfig & { _authRetry?: boolean })._authRetry = true;
      return httpClient(config);
    } catch (refreshError) {
      setAccessToken(null);
      handleRefreshFailure?.();
      throw refreshError;
    }
  }
  if (error.response?.data && typeof error.response.data.status === 'number') {
    throw new ApiError(error.response.data);
  }
  throw new ApiError({ status: error.response?.status ?? 0, detail: 'Não foi possível concluir a solicitação.', code: 'HTTP_ERROR' });
});
