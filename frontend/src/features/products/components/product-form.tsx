import { type FormEvent, useState } from 'react';
import { ApiError, getUserFacingError } from '@/shared/api/http';
import type { ProductInput } from '../api/products-api';
import { isValidMoney, normalizeMoney } from '@/features/shared/money';

type Props = { initial?: Partial<ProductInput>; submitting?: boolean; omitEmptyOptional?: boolean; onSubmit: (value: ProductInput) => Promise<unknown>; onCancel: () => void };
const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm outline-none ring-blue-500 placeholder:text-slate-400 focus:ring-2';

export function ProductForm({ initial, submitting = false, omitEmptyOptional = true, onSubmit, onCancel }: Props) {
  const isEditing = Boolean(initial?.sku);
  const [value, setValue] = useState<ProductInput>({ name: initial?.name ?? '', description: initial?.description ?? '', sku: initial?.sku ?? '', salePrice: initial?.salePrice ?? '', stockQuantity: initial?.stockQuantity ?? 0, stockMinimum: initial?.stockMinimum ?? 0 });
  const [error, setError] = useState('');
  const update = (field: keyof ProductInput, next: string) => setValue((current) => ({ ...current, [field]: next }));
  async function submit(event: FormEvent) {
    event.preventDefault(); setError('');
    if (!value.name.trim()) { setError('Informe o nome do produto.'); return; }
    if (!isValidMoney(value.salePrice)) { setError('Informe um preço decimal válido.'); return; }
    const normalized = { ...value, name: value.name.trim(), description: value.description?.trim(), sku: value.sku?.trim(), salePrice: normalizeMoney(value.salePrice), stockQuantity: Number(value.stockQuantity), stockMinimum: Number(value.stockMinimum) };
    const payload = (omitEmptyOptional ? Object.fromEntries(Object.entries(normalized).filter(([, field]) => field !== '')) : normalized) as ProductInput;
    try { await onSubmit(payload); } catch (cause) {
      if (cause instanceof ApiError && cause.problem.status === 409) setError('Já existe um produto com este SKU.');
      else if (cause instanceof ApiError) setError(getUserFacingError(cause.problem, 'Não foi possível salvar o produto.'));
      else setError('Não foi possível salvar o produto agora.');
    }
  }
  return <form onSubmit={submit} className="space-y-5" noValidate>
    {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
    <div className="grid gap-5 md:grid-cols-2">
      <label className="space-y-1 text-sm font-medium">Nome<input aria-label="Nome" autoFocus className={inputClass} value={value.name} onChange={(e) => update('name', e.target.value)} /></label>
      {isEditing && <label className="space-y-1 text-sm font-medium">SKU<input aria-label="SKU" className={`${inputClass} bg-slate-100`} value={value.sku} readOnly /></label>}
      <label className="space-y-1 text-sm font-medium">Preço de venda<input aria-label="Preço de venda" className={inputClass} inputMode="decimal" value={value.salePrice} onChange={(e) => update('salePrice', e.target.value)} /></label>
      <label className="space-y-1 text-sm font-medium">Estoque atual<input aria-label="Estoque atual" className={inputClass} type="number" min="0" step="1" value={value.stockQuantity} onChange={(e) => update('stockQuantity', e.target.value)} /></label>
      <label className="space-y-1 text-sm font-medium">Estoque mínimo<input aria-label="Estoque mínimo" className={inputClass} type="number" min="0" step="1" value={value.stockMinimum} onChange={(e) => update('stockMinimum', e.target.value)} /></label>
      <label className="space-y-1 text-sm font-medium md:col-span-2">Descrição<textarea aria-label="Descrição" className={inputClass} rows={4} value={value.description} onChange={(e) => update('description', e.target.value)} /></label>
    </div>
    <div className="flex justify-end gap-3 border-t border-slate-200 pt-5"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button disabled={submitting} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Salvar produto</button></div>
  </form>;
}
