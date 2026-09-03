import { NotFoundException } from '@nestjs/common';
import { SuppliersService } from './suppliers.service';

const principal = { role: 'ADMIN', organizationId: 'org' } as never;

function prismaFor(tx: unknown) { return { ...(tx as object), $transaction: jest.fn((callback: (value: unknown) => unknown) => callback(tx)) } as never; }

describe('SuppliersService', () => {
  it('normalizes Supplier contact data and scopes creation to the authenticated Organization', async () => {
    const tx = { supplier: { create: jest.fn().mockResolvedValue({ id: 'supplier', organizationId: 'org', name: 'Distribuidora', document: '12345678000190', email: 'contato@example.com', phone: '81999999999', notes: null, active: true, createdAt: new Date(), updatedAt: new Date() }) } };
    const result = await new SuppliersService(prismaFor(tx)).create(principal, { name: ' Distribuidora ', document: '12.345.678/0001-90', email: 'CONTATO@EXAMPLE.COM', phone: ' 81999999999 ' });
    expect(tx.supplier.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ organizationId: 'org', document: '12345678000190', email: 'contato@example.com', phone: '81999999999' }) }));
    expect(result).toMatchObject({ name: 'Distribuidora', document: '12345678000190' });
  });

  it('returns 404 for a Supplier outside the authenticated Organization', async () => {
    const tx = { supplier: { findFirst: jest.fn().mockResolvedValue(null) } };
    await expect(new SuppliersService(prismaFor(tx)).findOne(principal, 'other')).rejects.toBeInstanceOf(NotFoundException);
    expect(tx.supplier.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 'other', organizationId: 'org' } }));
  });
});
