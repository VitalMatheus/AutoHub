import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { WorkOrder } from './api/work-orders-api';
import { StockAllocationDialog } from './components/stock-allocation-dialog';

const workOrder = { items: [{ id: 'item-1', type: 'PRODUCT', productId: 'product-1', serviceId: null, description: 'Bengala', quantity: '1.000', unitPrice: '200.00' }], stockOptions: [{ id: 'entry-b', productId: 'product-1', availableQuantity: 2, unitCost: '120.00', purchaseDate: '2026-09-01', supplier: { id: 'supplier-b', name: 'Fornecedor B' }, purchase: { id: 'purchase-b', documentNumber: 'NF-123' }, batchNumber: null, warrantyDays: 90 }] } as unknown as WorkOrder;

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
});
