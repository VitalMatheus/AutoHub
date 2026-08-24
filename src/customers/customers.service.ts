import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { ListCustomersDto } from './dto/list-customers.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

const customerSelect = {
  id: true, organizationId: true, name: true, document: true, phone: true,
  email: true, notes: true, active: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) {
      throw new ForbiddenException('Organization Admin access required');
    }
    return principal.organizationId;
  }

  private normalizeDocument(document?: string): string | undefined {
    if (document === undefined) return undefined;
    const normalized = document.replace(/\D/g, '');
    return normalized || undefined;
  }

  private normalizeEmail(email?: string): string | undefined {
    return email === undefined ? undefined : email.trim().toLowerCase();
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateCustomerDto) {
    const organizationId = this.tenant(principal);
    try {
      return await this.prisma.customer.create({
        data: {
          organizationId, name: dto.name.trim(), document: this.normalizeDocument(dto.document),
          phone: dto.phone.trim(), email: this.normalizeEmail(dto.email), notes: dto.notes?.trim(),
        }, select: customerSelect,
      });
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async list(principal: AuthenticatedPrincipal, query: ListCustomersDto) {
    const organizationId = this.tenant(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const where: Prisma.CustomerWhereInput = {
      organizationId,
      ...(query.active === undefined ? {} : { active: query.active }),
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { document: { contains: search } }, { phone: { contains: search } }] } : {}),
    };
    const orderBy: Prisma.CustomerOrderByWithRelationInput[] = [
      { [query.sort ?? 'createdAt']: query.direction ?? 'asc' }, { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({ where, select: customerSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.customer.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const customer = await this.prisma.customer.findFirst({ where: { id, organizationId }, select: customerSelect });
    if (!customer) throw new NotFoundException('Customer not found');
    return customer;
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateCustomerDto) {
    const organizationId = this.tenant(principal);
    try {
      const result = await this.prisma.customer.updateMany({
        where: { id, organizationId },
        data: {
          ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
          ...(dto.document === undefined ? {} : { document: this.normalizeDocument(dto.document) }),
          ...(dto.phone === undefined ? {} : { phone: dto.phone.trim() }),
          ...(dto.email === undefined ? {} : { email: this.normalizeEmail(dto.email) }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes.trim() }),
        },
      });
      if (result.count !== 1) throw new NotFoundException('Customer not found');
      return this.findOne(principal, id);
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async remove(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    try {
      const result = await this.prisma.customer.deleteMany({ where: { id, organizationId } });
      if (result.count !== 1) throw new NotFoundException('Customer not found');
      return { success: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        const retained = await this.prisma.customer.updateMany({ where: { id, organizationId }, data: { active: false } });
        if (retained.count !== 1) throw new NotFoundException('Customer not found');
        return this.findOne(principal, id);
      }
      throw error;
    }
  }

  private mapConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Customer document already exists in this Organization');
    }
  }
}
