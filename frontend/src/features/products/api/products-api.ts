import { httpClient } from '@/shared/api/http';

export type Product = { id: string; name: string; description: string | null; sku: string | null; salePrice: string; active: boolean; createdAt: string; updatedAt: string };
export type ProductInput = { name: string; description?: string; sku?: string; salePrice: string };
export type ProductListParams = { page: number; pageSize: number; search?: string; active?: boolean; sort: 'createdAt' | 'name' | 'sku' | 'salePrice' | 'updatedAt'; direction: 'asc' | 'desc' };
export type ProductList = { data: Product[]; meta: { page: number; pageSize: number; total: number; totalPages: number } };

export const listProducts = (params: ProductListParams) => httpClient.get<ProductList>('/products', { params }).then((response) => response.data);
export const getProduct = (id: string) => httpClient.get<Product>(`/products/${id}`).then((response) => response.data);
export const createProduct = (input: ProductInput) => httpClient.post<Product>('/products', input).then((response) => response.data);
export const updateProduct = (id: string, input: Partial<ProductInput>) => httpClient.patch<Product>(`/products/${id}`, input).then((response) => response.data);
export const activateProduct = (id: string) => httpClient.post<Product>(`/products/${id}/activate`).then((response) => response.data);
export const deactivateProduct = (id: string) => httpClient.post<Product>(`/products/${id}/deactivate`).then((response) => response.data);
