import { httpClient } from '@/shared/api/http';
import { normalizeMoney } from '@/features/shared/money';

export type ItemType = 'SERVICE' | 'PRODUCT' | 'MANUAL';
export type DocumentItem = { id: string; type: ItemType; serviceId: string | null; productId: string | null; description: string; quantity: string; unitPrice: string; total?: string };
export type QuoteStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';
export type Quote = { id: string; number: number; customerId: string; vehicleId: string; organization?: { name: string; document?: string | null; phone?: string | null; email?: string | null; addressLine1?: string | null; addressLine2?: string | null; city?: string | null; state?: string | null; postalCode?: string | null }; customer?: { id?: string; name: string; document?: string | null; phone?: string | null; email?: string | null }; vehicle?: { id?: string; plate: string; brand: string; model: string; year?: number | null }; status: QuoteStatus; notes: string | null; items: DocumentItem[]; total: string; createdAt: string; updatedAt: string };
export type Page<T> = { data: T[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type ItemInput = { type: ItemType; serviceId?: string; productId?: string; description?: string; quantity: string; unitPrice?: string };

export const listQuotes = (params: Record<string, unknown>) => httpClient.get<Page<Quote>>('/quotes', { params }).then((r) => r.data);
export const getQuote = (id: string) => httpClient.get<Quote>(`/quotes/${id}`).then((r) => r.data);
export const createQuote = (input: { customerId: string; vehicleId: string; notes?: string }) => httpClient.post<Quote>('/quotes', input).then((r) => r.data);
export const updateQuote = (id: string, input: Partial<{ customerId: string; vehicleId: string; notes: string }>) => httpClient.patch<Quote>(`/quotes/${id}`, input).then((r) => r.data);
const normalizeItem = <T extends ItemInput | Partial<ItemInput>>(input: T): T => input.unitPrice === undefined ? input : { ...input, unitPrice: normalizeMoney(input.unitPrice) } as T;
export const addQuoteItem = (id: string, input: ItemInput) => httpClient.post<Quote>(`/quotes/${id}/items`, normalizeItem(input)).then((r) => r.data);
export const updateQuoteItem = (id: string, itemId: string, input: Partial<ItemInput>) => httpClient.patch<Quote>(`/quotes/${id}/items/${itemId}`, normalizeItem(input)).then((r) => r.data);
export const removeQuoteItem = (id: string, itemId: string) => httpClient.delete<Quote>(`/quotes/${id}/items/${itemId}`).then((r) => r.data);
export const quoteAction = (id: string, action: 'submit' | 'approve' | 'reject' | 'cancel') => httpClient.post<Quote>(`/quotes/${id}/${action}`).then((r) => r.data);
