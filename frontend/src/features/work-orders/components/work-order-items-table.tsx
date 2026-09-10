import type { DocumentItem, ItemInput } from '@/features/quotes/api/quotes-api';
import { ItemsTable, money } from '@/features/shared/document-components';
import type { WorkOrderStockAllocation } from '../api/work-orders-api';

function formatDate(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return `${day}/${month}/${year}`;
}

type Props = {
  items: DocumentItem[];
  allocations?: WorkOrderStockAllocation[];
  editable: boolean;
  onRemove?: (id: string) => Promise<unknown>;
  onUpdate?: (item: DocumentItem, input: Partial<ItemInput>) => Promise<unknown>;
};

export function WorkOrderItemsTable({ items, allocations = [], editable, onRemove, onUpdate }: Props) {
  const productItems = items.filter((item) => item.type === 'PRODUCT');
  const allocationsByItem = new Map<string, WorkOrderStockAllocation[]>();
  for (const allocation of allocations) {
    const current = allocationsByItem.get(allocation.workOrderItemId) ?? [];
    current.push(allocation);
    allocationsByItem.set(allocation.workOrderItemId, current);
  }

  return <>
    <ItemsTable items={items} editable={editable} onRemove={onRemove} onUpdate={onUpdate} />
    {productItems.length > 0 && <section aria-labelledby="work-order-stock-origin-title" className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <h3 id="work-order-stock-origin-title" className="font-semibold text-slate-900">Origem das peças</h3>
      <div className="mt-4 space-y-4">
        {productItems.map((item) => {
          const itemAllocations = allocationsByItem.get(item.id) ?? [];
          return <article key={item.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <h4 className="font-medium text-slate-900">{item.description}</h4>
            {itemAllocations.length === 0 ? <p className="mt-2 text-sm text-slate-500">Ainda não consumida do estoque.</p> : <ul className="mt-2 space-y-2 text-sm">
              {itemAllocations.map((allocation) => <li key={allocation.id} className="rounded-lg border border-slate-100 p-3">
                <p className="font-medium text-slate-800">{allocation.quantity} un. · {allocation.stockEntry?.supplier?.name ?? 'Estoque inicial · Fornecedor não identificado'}</p>
                {allocation.stockEntry && <p className="mt-1 text-slate-600">{allocation.stockEntry.purchase?.documentNumber ? `Compra: NF: ${allocation.stockEntry.purchase.documentNumber}` : 'Compra sem nota informada'} · custo histórico: {allocation.unitCost ? money(allocation.unitCost) : 'não informado'}</p>}
                {allocation.stockEntry && (allocation.stockEntry.batchNumber || allocation.stockEntry.warrantyExpiry) && <p className="mt-1 text-xs text-slate-500">{allocation.stockEntry.batchNumber ? `Lote: ${allocation.stockEntry.batchNumber}` : ''}{allocation.stockEntry.batchNumber && allocation.stockEntry.warrantyExpiry ? ' · ' : ''}{allocation.stockEntry.warrantyExpiry ? `Garantia até: ${formatDate(allocation.stockEntry.warrantyExpiry)}` : ''}</p>}
              </li>)}
            </ul>}
          </article>;
        })}
      </div>
    </section>}
  </>;
}
