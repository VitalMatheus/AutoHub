import { httpClient } from '@/shared/api/http';

export type PaymentMethod = 'CASH' | 'PIX' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'BANK_TRANSFER' | 'OTHER';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'CANCELLED';
export type FinancialStatus = 'UNPAID' | 'PARTIAL' | 'PAID';
export type FinancialState = { total: string; paid: string; balance: string; status: FinancialStatus };
export type Payment = { id: string; amount: string; method: PaymentMethod; status: PaymentStatus; paidAt: string | null; createdAt: string; financial: FinancialState };
export type PaymentInput = { amount: string; method: PaymentMethod; status?: Exclude<PaymentStatus, 'CANCELLED'>; paidAt: string };
export type PaymentList = { data: Payment[]; financial: FinancialState };

export type ExpenseCategory = 'PARTS_AND_SUPPLIES' | 'PERSONNEL' | 'RENT' | 'UTILITIES' | 'TAXES' | 'FINANCIAL_FEES' | 'MAINTENANCE' | 'MARKETING' | 'OTHER';
export type ExpenseStatus = 'OPEN' | 'CANCELLED';
export type Expense = { id: string; category: ExpenseCategory; description: string; amount: string; dueDate: string; status: ExpenseStatus; paid: string; balance: string; financialStatus: FinancialStatus; payments: ExpensePayment[]; createdAt: string; updatedAt: string };
export type ExpensePayment = { id: string; amount: string; method: PaymentMethod; status: PaymentStatus; paidAt: string | null; createdAt: string };
export type ExpenseList = { data: Expense[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type ExpenseInput = { category: ExpenseCategory; description: string; amount: string; dueDate: string };
export type ExpensePaymentList = { data: ExpensePayment[]; financial: FinancialState };

export const listPayments = (workOrderId: string) => httpClient.get<PaymentList>(`/work-orders/${workOrderId}/payments`).then((response) => response.data);
export const createPayment = (workOrderId: string, input: PaymentInput) => httpClient.post<Payment>(`/work-orders/${workOrderId}/payments`, input).then((response) => response.data);
export const cancelPayment = (workOrderId: string, paymentId: string) => httpClient.post<Payment>(`/work-orders/${workOrderId}/payments/${paymentId}/cancel`).then((response) => response.data);
export const listExpenses = (params: Record<string, unknown> = {}) => httpClient.get<ExpenseList>('/expenses', { params }).then((response) => response.data);
export const getExpense = (expenseId: string) => httpClient.get<Expense>(`/expenses/${expenseId}`).then((response) => response.data);
export const createExpense = (input: ExpenseInput) => httpClient.post<Expense>('/expenses', input).then((response) => response.data);
export const updateExpense = (expenseId: string, input: Partial<ExpenseInput>) => httpClient.patch<Expense>(`/expenses/${expenseId}`, input).then((response) => response.data);
export const cancelExpense = (expenseId: string) => httpClient.post<Expense>(`/expenses/${expenseId}/cancel`).then((response) => response.data);
export const listExpensePayments = (expenseId: string) => httpClient.get<ExpensePaymentList>(`/expenses/${expenseId}/payments`).then((response) => response.data);
export const createExpensePayment = (expenseId: string, input: PaymentInput) => httpClient.post<Expense>(`/expenses/${expenseId}/payments`, input).then((response) => response.data);
export const cancelExpensePayment = (expenseId: string, paymentId: string) => httpClient.post<Expense>(`/expenses/${expenseId}/payments/${paymentId}/cancel`).then((response) => response.data);
