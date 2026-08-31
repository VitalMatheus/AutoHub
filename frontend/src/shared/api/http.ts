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
};

const CODE_ERROR_TRANSLATIONS: Record<string, string> = {
  PAYMENT_EXCEEDS_BALANCE: 'O pagamento excede o saldo da ordem de serviço.',
  PAYMENT_ALREADY_CANCELLED: 'O pagamento já está cancelado.',
  WORK_ORDER_CANCELLED: 'Work Orders canceladas não podem receber pagamentos.',
};

const PORTUGUESE_ERROR_MARKERS = ['não ', 'não.', 'falha', 'solicitação', 'pagamento', 'produto', 'usuário', 'acesso', 'obrigatória'];

/** Converts API-safe details to text that can be shown outside authentication screens. */
export function getUserFacingError(problem: Pick<ProblemDetails, 'status' | 'detail' | 'code'>, fallback: string): string {
  const byCode = CODE_ERROR_TRANSLATIONS[problem.code];
  if (byCode) return byCode;
  const byDetail = LEGACY_ERROR_TRANSLATIONS[problem.detail];
  if (byDetail) return byDetail;
  const detail = problem.detail.trim();
  if (PORTUGUESE_ERROR_MARKERS.some((marker) => detail.toLocaleLowerCase('pt-BR').includes(marker))) return detail;
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
