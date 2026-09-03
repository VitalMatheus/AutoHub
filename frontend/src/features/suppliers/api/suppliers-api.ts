import { httpClient } from '@/shared/api/http';

export type Supplier = { id: string; name: string; document: string | null; email: string | null; phone: string | null; notes: string | null; active: boolean; createdAt: string; updatedAt: string };
export type SupplierInput = { name: string; document?: string; email?: string; phone?: string; notes?: string };
export type SupplierList = { data: Supplier[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };
export type ProductSupplier = { id: string; productId: string; supplierId: string; externalCode: string | null; lastCost: string | null; warrantyDays: number; preferred: boolean; supplier: Supplier };
export type ProductSupplierInput = { externalCode?: string; lastCost?: string; warrantyDays?: number; preferred?: boolean };

export const listSuppliers = (params: Record<string, unknown> = {}) => httpClient.get<SupplierList>('/suppliers', { params }).then((r) => r.data);
export const getSupplier = (id: string) => httpClient.get<Supplier>(`/suppliers/${id}`).then((r) => r.data);
export const createSupplier = (input: SupplierInput) => httpClient.post<Supplier>('/suppliers', input).then((r) => r.data);
export const updateSupplier = (id: string, input: Partial<SupplierInput>) => httpClient.patch<Supplier>(`/suppliers/${id}`, input).then((r) => r.data);
export const activateSupplier = (id: string) => httpClient.post<Supplier>(`/suppliers/${id}/activate`).then((r) => r.data);
export const deactivateSupplier = (id: string) => httpClient.post<Supplier>(`/suppliers/${id}/deactivate`).then((r) => r.data);
export const listProductSuppliers = (productId: string) => httpClient.get<ProductSupplier[]>(`/products/${productId}/suppliers`).then((r) => r.data);
export const linkProductSupplier = (productId: string, supplierId: string, input: ProductSupplierInput) => httpClient.post<ProductSupplier>(`/products/${productId}/suppliers/${supplierId}`, input).then((r) => r.data);
export const unlinkProductSupplier = (productId: string, supplierId: string) => httpClient.delete<{ success: boolean }>(`/products/${productId}/suppliers/${supplierId}`).then((r) => r.data);
