import { useState } from 'react';
import type { WorkOrder, WorkOrderAllocationInput } from '../api/work-orders-api';

type Props = { workOrder: WorkOrder; pending?: boolean; onCancel: () => void; onConfirm: (allocations?: WorkOrderAllocationInput[]) => void };

export function StockAllocationDialog({ workOrder, pending = false, onCancel, onConfirm }: Props) {
  const productItems = workOrder.items.filter((item) => item.type === 'PRODUCT' && item.productId);
  const [sources, setSources] = useState<Record<string, string>>(() => Object.fromEntries(productItems.map((item) => [item.id, 'AUTO'])));
  const options = workOrder.stockOptions ?? [];
  function confirm() {
    const selected = productItems.map((item) => ({ item, source: sources[item.id] ?? 'AUTO' }));
    const explicit = selected.filter(({ source }) => source !== 'AUTO');
    if (explicit.length === 0) { onConfirm(); return; }
    onConfirm(explicit.map(({ item, source }) => ({ workOrderItemId: item.id, stockEntryId: source, quantity: Number(item.quantity) })));
  }
  return <div role="dialog" aria-modal="true" aria-labelledby="stock-allocation-title" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4"><section className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl"><h2 id="stock-allocation-title" className="text-lg font-bold">Definir origem dos produtos</h2><p className="mt-2 text-sm text-slate-600">Escolha de qual entrada de estoque cada produto será consumido. Os produtos mantidos em automático usarão o FIFO.</p><div className="mt-5 space-y-4">{productItems.map((item) => { const itemOptions = options.filter((option) => option.productId === item.productId); return <label key={item.id} className="block text-sm font-medium"><span className="flex items-center justify-between gap-3"><span>{item.description} · quantidade {item.quantity}</span><span className="text-xs font-normal text-slate-500">{itemOptions.length} origem(ns) disponível(is)</span></span><select aria-label={`Origem do estoque para ${item.description}`} className="mt-2 w-full rounded-xl border border-slate-300 p-2.5" value={sources[item.id] ?? 'AUTO'} onChange={(event) => setSources((current) => ({ ...current, [item.id]: event.target.value }))}><option value="AUTO">Automático (FIFO)</option>{itemOptions.map((option) => <option key={option.id} value={option.id} disabled={option.availableQuantity < Number(item.quantity)}>{option.supplier?.name ?? 'Fornecedor não identificado'} · disponível {option.availableQuantity} · compra {option.purchaseDate}{option.purchase?.documentNumber ? ` · NF ${option.purchase.documentNumber}` : ''}{option.availableQuantity < Number(item.quantity) ? ' · quantidade insuficiente' : ''}</option>)}</select></label>; })}</div><div className="mt-6 flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700">Cancelar</button><button type="button" disabled={pending} onClick={confirm} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? 'Concluindo…' : 'Concluir OS'}</button></div></section></div>;
}
