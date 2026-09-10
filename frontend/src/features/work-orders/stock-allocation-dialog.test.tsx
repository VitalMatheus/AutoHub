import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkOrder } from './api/work-orders-api';
import { StockAllocationDialog } from './components/stock-allocation-dialog';

const workOrder = { items: [{ id: 'item-1', type: 'PRODUCT', productId: 'product-1', serviceId: null, description: 'Bengala', quantity: '1.000', unitPrice: '200.00' }], stockOptions: [{ id: 'entry-b', productId: 'product-1', availableQuantity: 2, origin: 'PURCHASE', unitCost: '120.00', purchaseDate: '2026-09-01', supplier: { id: 'supplier-b', name: 'Fornecedor B' }, purchase: { id: 'purchase-b', documentNumber: 'NF-123' }, batchNumber: null, warrantyDays: 90 }] } as unknown as WorkOrder;

describe('StockAllocationDialog', () => {
  it('sends the selected supplier stock entry when completing the work order', async () => {
    const user = userEvent.setup(); const onConfirm = vi.fn();
    render(<StockAllocationDialog workOrder={workOrder} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText('Origem do estoque para Bengala'), 'entry-b'); await user.click(screen.getByRole('button', { name: 'Concluir OS' }));
    expect(onConfirm).toHaveBeenCalledWith([{ workOrderItemId: 'item-1', stockEntryId: 'entry-b', quantity: 1 }]);
    expect(screen.getByText(/Fornecedor B/)).toBeInTheDocument(); expect(screen.getByText(/NF-123/)).toBeInTheDocument();
  });

  it('keeps selected origins and leaves other products for FIFO', async () => {
    const user = userEvent.setup(); const onConfirm = vi.fn();
    const workOrderWithAutomaticItem = {
      ...workOrder,
      items: [...workOrder.items, { id: 'item-2', type: 'PRODUCT', productId: 'product-2', serviceId: null, description: 'Pastilha', quantity: '1.000', unitPrice: '100.00' }],
    } as unknown as WorkOrder;
    render(<StockAllocationDialog workOrder={workOrderWithAutomaticItem} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText('Origem do estoque para Bengala'), 'entry-b'); await user.click(screen.getByRole('button', { name: 'Concluir OS' }));
    expect(onConfirm).toHaveBeenCalledWith([{ workOrderItemId: 'item-1', stockEntryId: 'entry-b', quantity: 1 }]);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('does not offer exhausted stock entries as supplier origins', () => {
    const exhausted = { ...workOrder, stockOptions: [{ ...workOrder.stockOptions![0], id: 'entry-exhausted', availableQuantity: 0 }] } as unknown as WorkOrder;
    render(<StockAllocationDialog workOrder={exhausted} onCancel={vi.fn()} onConfirm={vi.fn()} />);
    expect(screen.getByText('0 origem(ns) disponível(is)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Automático (FIFO)' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Fornecedor B/ })).not.toBeInTheDocument();
  });

  it('offers opening stock and sends it without a fake stock entry id', async () => {
    const user = userEvent.setup(); const onConfirm = vi.fn();
    const opening = { ...workOrder, stockOptions: [{ id: 'opening-product-1', productId: 'product-1', availableQuantity: 2, origin: 'OPENING', unitCost: null, purchaseDate: null, supplier: null, purchase: null, batchNumber: null, warrantyDays: 0 }] } as unknown as WorkOrder;
    render(<StockAllocationDialog workOrder={opening} onCancel={vi.fn()} onConfirm={onConfirm} />);
    await user.selectOptions(screen.getByLabelText('Origem do estoque para Bengala'), 'opening-product-1');
    await user.click(screen.getByRole('button', { name: 'Concluir OS' }));
    expect(onConfirm).toHaveBeenCalledWith([{ workOrderItemId: 'item-1', quantity: 1 }]);
    expect(screen.getByRole('option', { name: /Estoque inicial · fornecedor não identificado/ })).toBeInTheDocument();
  });
});
