import axios, { AxiosError, type AxiosInstance } from 'axios';

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

const apiBaseUrl = import.meta.env.VITE_API_URL || '/api/v1';
let accessToken: string | null = null;

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

httpClient.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

httpClient.interceptors.response.use(undefined, (error: AxiosError<ProblemDetails>) => {
  if (error.response?.data && typeof error.response.data.status === 'number') {
    throw new ApiError(error.response.data);
  }
  throw new ApiError({ status: error.response?.status ?? 0, detail: 'Não foi possível concluir a solicitação.', code: 'HTTP_ERROR' });
});
