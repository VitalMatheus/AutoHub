import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { UpdateProductDto } from './dto/update-product.dto';

const productSelect = {
  id: true, organizationId: true, name: true, description: true, sku: true, salePrice: true,
  active: true, createdAt: true, updatedAt: true,
} as const;

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

  async create(principal: AuthenticatedPrincipal, dto: CreateProductDto) {
    const organizationId = this.tenant(principal);
    try {
      return await this.prisma.product.create({
        data: {
          organizationId,
          name: dto.name.trim(),
          description: dto.description?.trim(),
          sku: this.normalizeSku(dto.sku),
          salePrice: dto.salePrice,
        },
        select: productSelect,
      });
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async list(principal: AuthenticatedPrincipal, query: ListProductsDto) {
    const organizationId = this.tenant(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where: Prisma.ProductWhereInput = {
      organizationId,
      ...(query.active === undefined ? { active: true } : { active: query.active }),
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
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const product = await this.prisma.product.findFirst({ where: { id, organizationId }, select: productSelect });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateProductDto) {
    const organizationId = this.tenant(principal);
    try {
      const result = await this.prisma.product.updateMany({
        where: { id, organizationId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.description === undefined ? {} : { description: dto.description.trim() }),
          ...(dto.sku === undefined ? {} : { sku: this.normalizeSku(dto.sku) }),
          ...(dto.salePrice === undefined ? {} : { salePrice: dto.salePrice }),
        },
      });
      if (result.count !== 1) throw new NotFoundException('Product not found');
      return this.findOne(principal, id);
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async activate(principal: AuthenticatedPrincipal, id: string) { return this.setActive(principal, id, true); }
  async deactivate(principal: AuthenticatedPrincipal, id: string) { return this.setActive(principal, id, false); }

  private async setActive(principal: AuthenticatedPrincipal, id: string, active: boolean) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.product.updateMany({ where: { id, organizationId }, data: { active } });
    if (result.count !== 1) throw new NotFoundException('Product not found');
    return this.findOne(principal, id);
  }

  private mapConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Product SKU already exists in this Organization');
    }
    if ((error as { code?: string })?.code === 'P2002') {
      throw new ConflictException('Product SKU already exists in this Organization');
    }
  }
}
