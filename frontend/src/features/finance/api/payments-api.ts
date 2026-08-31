import { httpClient } from '@/shared/api/http';

export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type FinancialStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type FinancialState = { total: string; paid: string; balance: string; status: FinancialStatus };
export type Payment = { id: string; amount: string; method: PaymentMethod; status: PaymentStatus; paidAt: string | null; createdAt: string; financial: FinancialState };
export type PaymentInput = { amount: string; method: PaymentMethod; status?: Exclude<PaymentStatus, 'CANCELLED'>; paidAt: string };
export type PaymentList = { data: Payment[]; financial: FinancialState };

export const listPayments = (workOrderId: string) => httpClient.get<PaymentList>(`/work-orders/${workOrderId}/payments`).then((response) => response.data);
export const createPayment = (workOrderId: string, input: PaymentInput) => httpClient.post<Payment>(`/work-orders/${workOrderId}/payments`, input).then((response) => response.data);
export const cancelPayment = (workOrderId: string, paymentId: string) => httpClient.post<Payment>(`/work-orders/${workOrderId}/payments/${paymentId}/cancel`).then((response) => response.data);
