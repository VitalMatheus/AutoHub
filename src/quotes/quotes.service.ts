import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { CreateQuoteDto } from './dto/create-quote.dto';
import { CreateQuoteItemDto } from './dto/create-quote-item.dto';
import { ListQuotesDto } from './dto/list-quotes.dto';
import { UpdateQuoteDto } from './dto/update-quote.dto';
import { UpdateQuoteItemDto } from './dto/update-quote-item.dto';
import { sumTotals } from './decimal';

type ItemInput = CreateQuoteItemDto | UpdateQuoteItemDto;
type QuoteAction = 'submit' | 'approve' | 'reject' | 'cancel';

const transitions: Record<QuoteAction, { from: string[]; to: string }> = {
  submit: { from: ['DRAFT'], to: 'PENDING' },
  approve: { from: ['PENDING'], to: 'APPROVED' },
  reject: { from: ['PENDING'], to: 'REJECTED' },
  cancel: { from: ['DRAFT', 'PENDING'], to: 'CANCELLED' },
};

@Injectable()
export class QuotesService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    return principal.organizationId;
  }

  private async ensureCustomerVehicle(tx: Prisma.TransactionClient, organizationId: string, customerId: string, vehicleId: string) {
    const [customer, vehicle] = await Promise.all([
      tx.customer.findFirst({ where: { id: customerId, organizationId, active: true }, select: { id: true } }),
      tx.vehicle.findFirst({ where: { id: vehicleId, organizationId, active: true }, select: { id: true, customerId: true } }),
    ]);
    if (!customer || !vehicle || vehicle.customerId !== customerId) throw new NotFoundException('Customer or Vehicle not found');
  }

  private async draft(tx: Prisma.TransactionClient, organizationId: string, quoteId: string) {
    const quote = await tx.quote.findFirst({ where: { id: quoteId, organizationId }, select: { id: true, status: true } });
    if (!quote) throw new NotFoundException('Quote not found');
    if (quote.status !== 'DRAFT') throw new ConflictException('Only draft Quotes can be edited');
  }

  private async resolveItem(tx: Prisma.TransactionClient, organizationId: string, input: ItemInput) {
    const type = input.type;
    if (type === 'SERVICE') {
      if (!input.serviceId || input.productId) throw new BadRequestException('SERVICE requires only serviceId');
      const service = await tx.service.findFirst({ where: { id: input.serviceId, organizationId, active: true }, select: { id: true, name: true, description: true, price: true } });
      if (!service) throw new NotFoundException('Active Service not found');
      return { type, serviceId: service.id, productId: null, description: service.description?.trim() || service.name, unitPrice: service.price.toString() };
    }
    if (type === 'PRODUCT') {
      if (!input.productId || input.serviceId) throw new BadRequestException('PRODUCT requires only productId');
      const product = await tx.product.findFirst({ where: { id: input.productId, organizationId, active: true }, select: { id: true, name: true, description: true, salePrice: true } });
      if (!product) throw new NotFoundException('Active Product not found');
      return { type, serviceId: null, productId: product.id, description: product.description?.trim() || product.name, unitPrice: product.salePrice.toString() };
    }
    if (input.serviceId || input.productId || !input.description || input.unitPrice === undefined) throw new BadRequestException('MANUAL requires description and unitPrice');
    return { type: 'MANUAL' as const, serviceId: null, productId: null, description: input.description.trim(), unitPrice: input.unitPrice };
  }

  private format(quote: any) {
    const items = quote.items.map((item: any) => ({ ...item, quantity: item.quantity.toString(), unitPrice: item.unitPrice.toString() }));
    return { ...quote, items, total: sumTotals(items) };
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateQuoteDto) {
    const organizationId = this.tenant(principal);
    try {
      const quote = await this.prisma.$transaction(async (tx) => {
        await this.ensureCustomerVehicle(tx, organizationId, dto.customerId, dto.vehicleId);
        const counter = await tx.organization.update({ where: { id: organizationId }, data: { nextQuoteNumber: { increment: 1 } }, select: { nextQuoteNumber: true } });
        return tx.quote.create({ data: { organizationId, customerId: dto.customerId, vehicleId: dto.vehicleId, number: counter.nextQuoteNumber - 1, notes: dto.notes?.trim() }, include: { items: true } });
      });
      return this.format(quote);
    } catch (error) { this.mapConflict(error); throw error; }
  }

  async list(principal: AuthenticatedPrincipal, query: ListQuotesDto) {
    const organizationId = this.tenant(principal);
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const where: Prisma.QuoteWhereInput = { organizationId, ...(query.status ? { status: query.status as any } : {}), ...(query.customerId ? { customerId: query.customerId } : {}) };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.quote.findMany({ where, include: { items: { orderBy: { createdAt: 'asc' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.quote.count({ where }),
    ]);
    return { data: data.map((quote) => this.format(quote)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const quote = await this.prisma.quote.findFirst({ where: { id, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    if (!quote) throw new NotFoundException('Quote not found');
    return this.format(quote);
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateQuoteDto) {
    const organizationId = this.tenant(principal);
    const quote = await this.prisma.$transaction(async (tx) => {
      await this.draft(tx, organizationId, id);
      if (dto.customerId || dto.vehicleId) {
        const current = await tx.quote.findFirstOrThrow({ where: { id, organizationId }, select: { customerId: true, vehicleId: true } });
        await this.ensureCustomerVehicle(tx, organizationId, dto.customerId ?? current.customerId, dto.vehicleId ?? current.vehicleId);
      }
      return tx.quote.update({ where: { organizationId_id: { organizationId, id } }, data: { ...(dto.customerId ? { customerId: dto.customerId } : {}), ...(dto.vehicleId ? { vehicleId: dto.vehicleId } : {}), ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}) }, include: { items: true } });
    });
    return this.format(quote);
  }

  async addItem(principal: AuthenticatedPrincipal, quoteId: string, dto: CreateQuoteItemDto) {
    const organizationId = this.tenant(principal);
    const quote = await this.prisma.$transaction(async (tx) => {
      await this.draft(tx, organizationId, quoteId);
      const resolved = await this.resolveItem(tx, organizationId, dto);
      await tx.quoteItem.create({ data: { organizationId, quoteId, ...resolved, quantity: dto.quantity } });
      return tx.quote.findFirstOrThrow({ where: { id: quoteId, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    });
    return this.format(quote);
  }

  async updateItem(principal: AuthenticatedPrincipal, quoteId: string, itemId: string, dto: UpdateQuoteItemDto) {
    const organizationId = this.tenant(principal);
    const quote = await this.prisma.$transaction(async (tx) => {
      await this.draft(tx, organizationId, quoteId);
      const current = await tx.quoteItem.findFirst({ where: { id: itemId, quoteId, organizationId } });
      if (!current) throw new NotFoundException('Quote Item not found');
      const type = dto.type ?? current.type;
      const merged = { type, serviceId: dto.serviceId ?? (type === current.type ? current.serviceId ?? undefined : undefined), productId: dto.productId ?? (type === current.type ? current.productId ?? undefined : undefined), description: dto.description ?? current.description, quantity: dto.quantity ?? current.quantity.toString(), unitPrice: dto.unitPrice ?? current.unitPrice.toString() } as ItemInput;
      const resolved = await this.resolveItem(tx, organizationId, merged);
      await tx.quoteItem.updateMany({ where: { id: itemId, quoteId, organizationId }, data: { ...resolved, quantity: merged.quantity } });
      return tx.quote.findFirstOrThrow({ where: { id: quoteId, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    });
    return this.format(quote);
  }

  async removeItem(principal: AuthenticatedPrincipal, quoteId: string, itemId: string) {
    const organizationId = this.tenant(principal);
    await this.prisma.$transaction(async (tx) => { await this.draft(tx, organizationId, quoteId); const result = await tx.quoteItem.deleteMany({ where: { id: itemId, quoteId, organizationId } }); if (result.count !== 1) throw new NotFoundException('Quote Item not found'); });
    return this.findOne(principal, quoteId);
  }

  async submit(principal: AuthenticatedPrincipal, id: string) { return this.transition(principal, id, 'submit'); }
  async approve(principal: AuthenticatedPrincipal, id: string) { return this.transition(principal, id, 'approve'); }
  async reject(principal: AuthenticatedPrincipal, id: string) { return this.transition(principal, id, 'reject'); }
  async cancel(principal: AuthenticatedPrincipal, id: string) { return this.transition(principal, id, 'cancel'); }

  private async transition(principal: AuthenticatedPrincipal, id: string, action: QuoteAction) {
    const organizationId = this.tenant(principal);
    const rule = transitions[action];
    return this.prisma.$transaction(async (tx) => {
      const quote = await tx.quote.findFirst({
        where: { id, organizationId },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      if (!quote) throw new NotFoundException('Quote not found');
      if (!rule.from.includes(quote.status)) {
        throw new ConflictException({
          type: 'https://api.autohub.local/problems/quote-invalid-transition',
          title: 'Quote transition is not allowed',
          status: 409,
          detail: `Quote cannot ${action} from ${quote.status}.`,
          code: 'QUOTE_INVALID_TRANSITION',
        });
      }
      const updated = await tx.quote.update({
        where: { organizationId_id: { organizationId, id } },
        data: { status: rule.to as any },
        include: { items: { orderBy: { createdAt: 'asc' } } },
      });
      return this.format(updated);
    });
  }

  private mapConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Quote number already exists in this Organization');
  }
}
