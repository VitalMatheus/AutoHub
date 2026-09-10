import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { DocumentItem } from '@/features/quotes/api/quotes-api';
import { WorkOrderItemsTable } from './work-order-items-table';

const items: DocumentItem[] = [
  { id: 'item-1', type: 'PRODUCT', serviceId: null, productId: 'product-1', description: 'Pastilha de freio', quantity: '4.000', unitPrice: '200.00', total: '800.00' },
  { id: 'item-2', type: 'SERVICE', serviceId: 'service-1', productId: null, description: 'Troca de pastilha', quantity: '1.000', unitPrice: '150.00', total: '150.00' },
];

describe('WorkOrderItemsTable', () => {
  it('shows every historical supplier allocation for a product', () => {
    render(<WorkOrderItemsTable items={items} editable={false} allocations={[
      { id: 'allocation-1', workOrderItemId: 'item-1', stockEntryId: 'entry-1', quantity: 2, unitCost: '80.00', stockEntry: { supplier: { name: 'Fornecedor A' }, purchase: { id: 'purchase-1', documentNumber: 'NF-100' }, batchNumber: 'L1', warrantyExpiry: '2026-12-10' } },
      { id: 'allocation-2', workOrderItemId: 'item-1', stockEntryId: 'entry-2', quantity: 2, unitCost: '85.00', stockEntry: { supplier: { name: 'Fornecedor B' }, purchase: { id: 'purchase-2', documentNumber: 'NF-200' }, batchNumber: null, warrantyExpiry: null } },
    ]} />);

    expect(screen.getByRole('heading', { name: 'Origem das peças' })).toBeInTheDocument();
    expect(screen.getAllByText('Pastilha de freio')).toHaveLength(2);
    expect(screen.getByText(/2 un\. · Fornecedor A/)).toBeInTheDocument();
    expect(screen.getByText(/2 un\. · Fornecedor B/)).toBeInTheDocument();
    expect(screen.getByText(/NF-100/)).toBeInTheDocument();
    expect(screen.getByText(/custo histórico: R\$ 80,00/)).toBeInTheDocument();
    expect(screen.getByText(/Lote: L1/)).toBeInTheDocument();
    expect(screen.getByText(/Garantia até: 10\/12\/2026/)).toBeInTheDocument();
  });

  it('identifies stock without purchase provenance instead of inventing a supplier', () => {
    render(<WorkOrderItemsTable items={[items[0]]} editable={false} allocations={[{ id: 'allocation-opening', workOrderItemId: 'item-1', stockEntryId: null, quantity: 4, unitCost: null, stockEntry: null }]} />);

    expect(screen.getByText(/Estoque inicial · Fornecedor não identificado/)).toBeInTheDocument();
  });

  it('explains when a product has not been consumed yet', () => {
    render(<WorkOrderItemsTable items={[items[0]]} editable={true} allocations={[]} />);

    expect(screen.getByText('Ainda não consumida do estoque.')).toBeInTheDocument();
  });
});
