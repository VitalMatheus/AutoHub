import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { formatMoney } from '../common/money/format-money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplierDto } from './dto/create-supplier.dto';
import { ListSuppliersDto } from './dto/list-suppliers.dto';
import { LinkProductSupplierDto } from './dto/link-product-supplier.dto';
import { UpdateSupplierDto } from './dto/update-supplier.dto';

const supplierSelect = { id: true, organizationId: true, name: true, document: true, email: true, phone: true, notes: true, active: true, createdAt: true, updatedAt: true } as const;
const linkSelect = { id: true, productId: true, supplierId: true, externalCode: true, lastCost: true, warrantyDays: true, preferred: true, supplier: { select: supplierSelect } } as const;
function presentLink(row: any) { return { ...row, lastCost: row.lastCost === null ? null : formatMoney(row.lastCost) }; }

@Injectable()
export class SuppliersService {
  constructor(private readonly prisma: PrismaService) {}
  private tenant(p: AuthenticatedPrincipal) { if (p.role !== 'ADMIN' || !p.organizationId) throw new ForbiddenException('Organization Admin access required'); return p.organizationId; }
  private document(value?: string) { if (value === undefined) return undefined; const digits = value.replace(/\D/g, ''); return digits || undefined; }
  private conflict(error: unknown): never { if ((error as { code?: string })?.code === 'P2002') throw new ConflictException('Supplier document already exists in this Organization'); throw error; }

  async create(p: AuthenticatedPrincipal, dto: CreateSupplierDto) {
    const organizationId = this.tenant(p);
    try { return await this.prisma.supplier.create({ data: { organizationId, name: dto.name.trim(), document: this.document(dto.document), email: dto.email?.trim().toLowerCase(), phone: dto.phone?.trim(), notes: dto.notes?.trim() }, select: supplierSelect }); } catch (e) { return this.conflict(e); }
  }
  async list(p: AuthenticatedPrincipal, q: ListSuppliersDto) {
    const organizationId = this.tenant(p); const page = q.page ?? 1; const pageSize = q.pageSize ?? 20; const search = q.search?.trim();
    const where: Prisma.SupplierWhereInput = { organizationId, ...(q.active === undefined ? { active: true } : { active: q.active }), ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { document: { contains: this.document(search) ?? search, mode: 'insensitive' } }, { email: { contains: search, mode: 'insensitive' } }] } : {}) };
    const [data, total] = await this.prisma.$transaction([this.prisma.supplier.findMany({ where, select: supplierSelect, orderBy: [{ [q.sort ?? 'name']: q.direction ?? 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }), this.prisma.supplier.count({ where })]);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }
  async findOne(p: AuthenticatedPrincipal, id: string) { const row = await this.prisma.supplier.findFirst({ where: { id, organizationId: this.tenant(p) }, select: supplierSelect }); if (!row) throw new NotFoundException('Supplier not found'); return row; }
  async update(p: AuthenticatedPrincipal, id: string, dto: UpdateSupplierDto) {
    const organizationId = this.tenant(p); try { const result = await this.prisma.supplier.updateMany({ where: { id, organizationId }, data: { ...(dto.name === undefined ? {} : { name: dto.name.trim() }), ...(dto.document === undefined ? {} : { document: this.document(dto.document) }), ...(dto.email === undefined ? {} : { email: dto.email.trim().toLowerCase() }), ...(dto.phone === undefined ? {} : { phone: dto.phone.trim() }), ...(dto.notes === undefined ? {} : { notes: dto.notes.trim() }) } }); if (result.count !== 1) throw new NotFoundException('Supplier not found'); return this.findOne(p, id); } catch (e) { return this.conflict(e); }
  }
  async setActive(p: AuthenticatedPrincipal, id: string, active: boolean) { const organizationId = this.tenant(p); const result = await this.prisma.supplier.updateMany({ where: { id, organizationId }, data: { active } }); if (result.count !== 1) throw new NotFoundException('Supplier not found'); return this.findOne(p, id); }
  async listProductSuppliers(p: AuthenticatedPrincipal, productId: string) { const organizationId = this.tenant(p); const product = await this.prisma.product.findFirst({ where: { id: productId, organizationId }, select: { id: true } }); if (!product) throw new NotFoundException('Product not found'); const rows = await this.prisma.productSupplier.findMany({ where: { productId, organizationId }, select: linkSelect, orderBy: [{ preferred: 'desc' }, { createdAt: 'asc' }] }); return rows.map(presentLink); }
  async link(p: AuthenticatedPrincipal, productId: string, supplierId: string, dto: LinkProductSupplierDto) {
    const organizationId = this.tenant(p);
    try { return await this.prisma.$transaction(async (tx) => {
      const [product, supplier] = await Promise.all([tx.product.findFirst({ where: { id: productId, organizationId }, select: { id: true, active: true } }), tx.supplier.findFirst({ where: { id: supplierId, organizationId }, select: { id: true, active: true } })]);
      if (!product || !supplier) throw new NotFoundException('Product or Supplier not found');
      if (!supplier.active) throw new ConflictException('Inactive Supplier cannot be linked to a Product');
      const existing = await tx.productSupplier.findFirst({ where: { productId, supplierId, organizationId }, select: { id: true } });
      const anyLink = await tx.productSupplier.findFirst({ where: { productId, organizationId }, select: { id: true } });
      const preferred = dto.preferred ?? !anyLink;
      if (preferred) await tx.productSupplier.updateMany({ where: { productId, organizationId }, data: { preferred: false } });
      const row = existing ? await tx.productSupplier.update({ where: { id: existing.id }, data: { externalCode: dto.externalCode?.trim(), lastCost: dto.lastCost === undefined ? undefined : new Prisma.Decimal(dto.lastCost), warrantyDays: dto.warrantyDays, preferred }, select: linkSelect }) : await tx.productSupplier.create({ data: { organizationId, productId, supplierId, externalCode: dto.externalCode?.trim(), lastCost: dto.lastCost === undefined ? undefined : new Prisma.Decimal(dto.lastCost), warrantyDays: dto.warrantyDays ?? 0, preferred }, select: linkSelect });
      return presentLink(row);
    }); } catch (e) { if ((e as { code?: string })?.code === 'P2002') throw new ConflictException('Product already has this Supplier'); throw e; }
  }
  async unlink(p: AuthenticatedPrincipal, productId: string, supplierId: string) {
    const organizationId = this.tenant(p); return this.prisma.$transaction(async (tx) => { const row = await tx.productSupplier.findFirst({ where: { productId, supplierId, organizationId } }); if (!row) throw new NotFoundException('Product Supplier link not found'); await tx.productSupplier.delete({ where: { id: row.id } }); if (row.preferred) { const next = await tx.productSupplier.findFirst({ where: { productId, organizationId }, orderBy: { createdAt: 'asc' }, select: { id: true } }); if (next) await tx.productSupplier.update({ where: { id: next.id }, data: { preferred: true } }); } return { success: true }; });
  }
}
