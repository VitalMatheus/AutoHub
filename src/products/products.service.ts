import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { formatMoney } from '../common/money/format-money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { AdjustStockDto } from './dto/adjust-stock.dto';

const productSelect = {
  id: true, organizationId: true, name: true, description: true, sku: true, salePrice: true,
  active: true, stockQuantity: true, stockMinimum: true, createdAt: true, updatedAt: true,
} as const;

type ProductRecord = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function serializeProduct(product: ProductRecord) {
  return { ...product, salePrice: formatMoney(product.salePrice), lowStock: product.stockQuantity <= product.stockMinimum };
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) {
      throw new ForbiddenException('Organization Admin access required');
    }
    return principal.organizationId;
  }

  private normalizeSku(sku?: string): string | undefined {
    if (sku === undefined) return undefined;
    const normalized = sku.trim().toUpperCase();
    return normalized || undefined;
  }

  private generateSku(): string { return `PROD-${randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`; }

  async create(principal: AuthenticatedPrincipal, dto: CreateProductDto) {
    const organizationId = this.tenant(principal);
    const suppliedSku = this.normalizeSku(dto.sku);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const product = await this.prisma.product.create({
          data: {
            organizationId,
            name: dto.name.trim(),
            description: dto.description?.trim(),
            sku: suppliedSku ?? this.generateSku(),
            salePrice: dto.salePrice,
            stockQuantity: dto.stockQuantity ?? 0,
            stockMinimum: dto.stockMinimum ?? 0,
          },
          select: productSelect,
        });
        return serializeProduct(product);
      } catch (error) {
        if (!suppliedSku && this.isConflict(error) && attempt < 2) continue;
        this.mapConflict(error);
        throw error;
      }
    }
    throw new ConflictException('Unable to generate a unique Product SKU');
  }

  async list(principal: AuthenticatedPrincipal, query: ListProductsDto) {
    const organizationId = this.tenant(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    let lowStockIds: string[] | undefined;
    if (query.lowStock === true) {
      const rows = await this.prisma.$queryRaw<{ id: string }[]>(Prisma.sql`SELECT "id" FROM "Product" WHERE "organizationId" = CAST(${organizationId} AS uuid) AND "stockQuantity" <= "stockMinimum"`);
      lowStockIds = rows.map(({ id }) => id);
    }
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.active === undefined ? { active: true } : { active: query.active }),
      ...(lowStockIds ? { id: { in: lowStockIds } } : {}),
      ...(search ? { OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ] } : {}),
    };
    const orderBy: Prisma.ProductOrderByWithRelationInput[] = [
      { [query.sort ?? 'createdAt']: query.direction ?? 'asc' }, { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({ where, select: productSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.product.count({ where }),
    ]);
    return { data: data.map(serializeProduct), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const product = await this.prisma.product.findFirst({ where: { id, organizationId }, select: productSelect });
    if (!product) throw new NotFoundException('Product not found');
    return serializeProduct(product);
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateProductDto) {
    const organizationId = this.tenant(principal);
    try {
      const requestedStock = dto.stockQuantity;
      const data = {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.description === undefined ? {} : { description: dto.description.trim() }),
        ...(dto.sku === undefined ? {} : { sku: this.normalizeSku(dto.sku) }),
        ...(dto.salePrice === undefined ? {} : { salePrice: dto.salePrice }),
        ...(dto.stockMinimum === undefined ? {} : { stockMinimum: dto.stockMinimum }),
      };
      const result = Object.keys(data).length > 0
        ? await this.prisma.product.updateMany({ where: { id, organizationId }, data })
        : { count: (await this.prisma.product.findFirst({ where: { id, organizationId }, select: { id: true } })) ? 1 : 0 };
      if (result.count !== 1) throw new NotFoundException('Product not found');
      if (requestedStock !== undefined) {
        const current = await this.prisma.product.findFirst({ where: { id, organizationId }, select: { stockQuantity: true } });
        if (!current) throw new NotFoundException('Product not found');
        const quantityChange = requestedStock - current.stockQuantity;
        if (quantityChange !== 0) await this.adjustStock(principal, id, { quantityChange, note: 'Ajuste de estoque do Product' });
      }
      return this.findOne(principal, id);
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async activate(principal: AuthenticatedPrincipal, id: string) { return this.setActive(principal, id, true); }
  async deactivate(principal: AuthenticatedPrincipal, id: string) { return this.setActive(principal, id, false); }

  async adjustStock(principal: AuthenticatedPrincipal, id: string, dto: AdjustStockDto) {
    const organizationId = this.tenant(principal);
    const product = await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string; stockQuantity: number }>>`
        SELECT "id", "stockQuantity" FROM "Product"
        WHERE "id" = ${id}::uuid AND "organizationId" = ${organizationId}::uuid FOR UPDATE
      `;
      if (locked.length !== 1) throw new NotFoundException('Product not found');
      const next = locked[0].stockQuantity + dto.quantityChange;
      if (next < 0) throw new ConflictException('Stock adjustment would make the Product stock negative');
      await tx.product.update({ where: { organizationId_id: { organizationId, id } }, data: { stockQuantity: dto.quantityChange < 0 ? { decrement: -dto.quantityChange } : { increment: dto.quantityChange } } });
      await tx.stockMovement.create({ data: { organizationId, productId: id, type: 'ADJUSTMENT', quantityChange: dto.quantityChange, note: dto.note?.trim() } });
      return tx.product.findFirstOrThrow({ where: { id, organizationId }, select: productSelect });
    });
    return serializeProduct(product);
  }

  private async setActive(principal: AuthenticatedPrincipal, id: string, active: boolean) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.product.updateMany({ where: { id, organizationId }, data: { active } });
    if (result.count !== 1) throw new NotFoundException('Product not found');
    return this.findOne(principal, id);
  }

  private mapConflict(error: unknown): void {
    if (this.isConflict(error)) {
      throw new ConflictException('Product SKU already exists in this Organization');
    }
  }

  private isConflict(error: unknown): boolean {
    return (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
      || (error as { code?: string })?.code === 'P2002';
  }
}
