import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';

const csvCell = (value: unknown) => `"${String(value ?? '').replaceAll('"', '""')}"`;
const csv = (headers: string[], rows: unknown[][]) => `${[headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
const date = (value: Date | null | undefined) => value?.toISOString().slice(0, 10) ?? '';
const money = (value: Prisma.Decimal | null | undefined) => value?.toFixed(2) ?? '';

function pdfText(title: string, lines: string[]): Buffer {
  const escape = (value: string) => value.replaceAll('\\', '\\\\').replaceAll('(', '\\(').replaceAll(')', '\\)');
  const content = [`BT`, `/F1 16 Tf`, `50 780 Td`, `(${escape(title)}) Tj`, `/F1 10 Tf`, ...lines.flatMap((line) => [`0 -18 Td`, `(${escape(line.slice(0, 110))}) Tj`]), `ET`].join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let index = 0; index < objects.length; index++) {
    offsets.push(Buffer.byteLength(body, 'utf8'));
    body += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }
  const xref = Buffer.byteLength(body, 'utf8');
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, '0')} 00000 n `).join('\n')}\ntrailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body, 'utf8');
}

@Injectable()
export class ExportsService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    return principal.organizationId;
  }

  async csv(principal: AuthenticatedPrincipal, resource: string): Promise<string> {
    const organizationId = this.tenant(principal);
    switch (resource) {
      case 'customers': {
        const rows = await this.prisma.customer.findMany({ where: { organizationId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { name: true, document: true, phone: true, email: true, active: true } });
        return csv(['name', 'document', 'phone', 'email', 'active'], rows.map((row) => [row.name, row.document, row.phone, row.email, row.active]));
      }
      case 'vehicles': {
        const rows = await this.prisma.vehicle.findMany({ where: { organizationId }, orderBy: [{ plate: 'asc' }, { id: 'asc' }], select: { plate: true, brand: true, model: true, year: true, active: true, customer: { select: { name: true } } } });
        return csv(['plate', 'brand', 'model', 'year', 'customer', 'active'], rows.map((row) => [row.plate, row.brand, row.model, row.year, row.customer.name, row.active]));
      }
      case 'quotes': {
        const rows = await this.prisma.quote.findMany({ where: { organizationId }, orderBy: [{ number: 'asc' }], select: { number: true, status: true, createdAt: true, customer: { select: { name: true } } } });
        return csv(['number', 'status', 'customer', 'createdAt'], rows.map((row) => [row.number, row.status, row.customer.name, date(row.createdAt)]));
      }
      case 'work-orders': {
        const rows = await this.prisma.workOrder.findMany({ where: { organizationId }, orderBy: [{ number: 'asc' }], select: { number: true, status: true, createdAt: true, customer: { select: { name: true } } } });
        return csv(['number', 'status', 'customer', 'createdAt'], rows.map((row) => [row.number, row.status, row.customer.name, date(row.createdAt)]));
      }
      case 'products': {
        const rows = await this.prisma.product.findMany({ where: { organizationId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { name: true, sku: true, salePrice: true, stockQuantity: true, active: true } });
        return csv(['name', 'sku', 'salePrice', 'stockQuantity', 'active'], rows.map((row) => [row.name, row.sku, money(row.salePrice), row.stockQuantity, row.active]));
      }
      case 'services': {
        const rows = await this.prisma.service.findMany({ where: { organizationId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { name: true, price: true, active: true } });
        return csv(['name', 'price', 'active'], rows.map((row) => [row.name, money(row.price), row.active]));
      }
      case 'suppliers': {
        const rows = await this.prisma.supplier.findMany({ where: { organizationId }, orderBy: [{ name: 'asc' }, { id: 'asc' }], select: { name: true, document: true, email: true, phone: true, active: true } });
        return csv(['name', 'document', 'email', 'phone', 'active'], rows.map((row) => [row.name, row.document, row.email, row.phone, row.active]));
      }
      case 'expenses': {
        const rows = await this.prisma.expense.findMany({ where: { organizationId }, orderBy: [{ dueDate: 'desc' }, { id: 'desc' }], select: { description: true, category: true, amount: true, dueDate: true, status: true } });
        return csv(['description', 'category', 'amount', 'dueDate', 'status'], rows.map((row) => [row.description, row.category, money(row.amount), date(row.dueDate), row.status]));
      }
      case 'purchases': {
        const rows = await this.prisma.purchase.findMany({ where: { organizationId }, orderBy: [{ purchaseDate: 'desc' }, { id: 'desc' }], select: { purchaseDate: true, dueDate: true, status: true, documentNumber: true, supplier: { select: { name: true } } } });
        return csv(['purchaseDate', 'dueDate', 'status', 'documentNumber', 'supplier'], rows.map((row) => [date(row.purchaseDate), date(row.dueDate), row.status, row.documentNumber, row.supplier.name]));
      }
      case 'direct-sales': {
        const rows = await this.prisma.directSale.findMany({ where: { organizationId }, orderBy: [{ number: 'asc' }], select: { number: true, status: true, confirmedAt: true, customer: { select: { name: true } } } });
        return csv(['number', 'status', 'customer', 'confirmedAt'], rows.map((row) => [row.number, row.status, row.customer?.name, date(row.confirmedAt)]));
      }
      default: throw new NotFoundException('Export not found');
    }
  }

  async quotePdf(principal: AuthenticatedPrincipal, id: string): Promise<Buffer> {
    const organizationId = this.tenant(principal);
    const quote = await this.prisma.quote.findFirst({ where: { id, organizationId }, select: { number: true, status: true, notes: true, customer: { select: { name: true } }, vehicle: { select: { plate: true, brand: true, model: true } }, items: { select: { description: true, quantity: true, unitPrice: true } } } });
    if (!quote) throw new NotFoundException('Quote not found');
    return pdfText(`Quote #${quote.number}`, [`Status: ${quote.status}`, `Customer: ${quote.customer.name}`, `Vehicle: ${quote.vehicle.brand} ${quote.vehicle.model} (${quote.vehicle.plate})`, ...quote.items.map((item) => `${item.description} | ${item.quantity.toString()} x ${money(item.unitPrice)}`), quote.notes ? `Notes: ${quote.notes}` : '']);
  }

  async workOrderPdf(principal: AuthenticatedPrincipal, id: string): Promise<Buffer> {
    const organizationId = this.tenant(principal);
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, organizationId }, select: { number: true, status: true, reportedProblem: true, diagnosis: true, customer: { select: { name: true } }, vehicle: { select: { plate: true, brand: true, model: true } }, items: { select: { description: true, quantity: true, unitPrice: true } } } });
    if (!workOrder) throw new NotFoundException('Work Order not found');
    return pdfText(`Work Order #${workOrder.number}`, [`Status: ${workOrder.status}`, `Customer: ${workOrder.customer.name}`, `Vehicle: ${workOrder.vehicle.brand} ${workOrder.vehicle.model} (${workOrder.vehicle.plate})`, workOrder.reportedProblem ? `Problem: ${workOrder.reportedProblem}` : '', workOrder.diagnosis ? `Diagnosis: ${workOrder.diagnosis}` : '', ...workOrder.items.map((item) => `${item.description} | ${item.quantity.toString()} x ${money(item.unitPrice)}`)]);
  }
}
