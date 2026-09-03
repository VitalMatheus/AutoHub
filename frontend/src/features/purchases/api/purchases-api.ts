import { httpClient } from '@/shared/api/http';

export type PurchaseStatus = 'DRAFT' | 'CONFIRMED' | 'CANCELLED';
export type PurchaseItem = { id: string; productId: string; productName: string; sku: string; quantity: number; unitCost: string; warrantyDays: number; batchNumber: string | null };
export type Purchase = { id: string; supplierId: string; supplier: { id: string; name: string }; status: PurchaseStatus; purchaseDate: string; dueDate: string; documentNumber: string | null; notes: string | null; total: string; items: PurchaseItem[]; expenseId?: string | null; stockEntries?: unknown[] };
export type PurchaseItemInput = { productId: string; quantity: number; unitCost: string; warrantyDays?: number; batchNumber?: string };
export type PurchaseInput = { supplierId: string; purchaseDate: string; dueDate: string; items: PurchaseItemInput[]; documentNumber?: string; notes?: string };
export type PurchaseList = { data: Purchase[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export const listPurchases = (params: Record<string, unknown> = {}) => httpClient.get<PurchaseList>('/purchases', { params }).then((r) => r.data);
export const getPurchase = (id: string) => httpClient.get<Purchase>(`/purchases/${id}`).then((r) => r.data);
export const createPurchase = (input: PurchaseInput) => httpClient.post<Purchase>('/purchases', input).then((r) => r.data);
export const updatePurchase = (id: string, input: PurchaseInput) => httpClient.patch<Purchase>(`/purchases/${id}`, input).then((r) => r.data);
export const confirmPurchase = (id: string) => httpClient.post<Purchase>(`/purchases/${id}/confirm`).then((r) => r.data);
export const cancelPurchase = (id: string) => httpClient.post<Purchase>(`/purchases/${id}/cancel`).then((r) => r.data);
