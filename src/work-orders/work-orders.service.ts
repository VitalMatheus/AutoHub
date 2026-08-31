import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { fixedScale, sumTotals, totalOf } from '../quotes/decimal';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { CreateWorkOrderItemDto } from './dto/create-work-order-item.dto';
import { ListWorkOrdersDto } from './dto/list-work-orders.dto';
import { UpdateWorkOrderDto } from './dto/update-work-order.dto';
import { UpdateWorkOrderItemDto } from './dto/update-work-order-item.dto';

type WorkOrderAction = 'requestApproval' | 'start' | 'waitParts' | 'complete' | 'deliver' | 'cancel';
const transitions: Record<WorkOrderAction, { from: string[]; to: string }> = {
  requestApproval: { from: ['OPEN'], to: 'WAITING_APPROVAL' },
  start: { from: ['OPEN', 'WAITING_APPROVAL', 'WAITING_PARTS'], to: 'IN_PROGRESS' },
  waitParts: { from: ['IN_PROGRESS'], to: 'WAITING_PARTS' },
  complete: { from: ['IN_PROGRESS'], to: 'COMPLETED' },
  deliver: { from: ['COMPLETED'], to: 'DELIVERED' },
  cancel: { from: ['OPEN', 'WAITING_APPROVAL', 'IN_PROGRESS', 'WAITING_PARTS'], to: 'CANCELLED' },
};

@Injectable()
export class WorkOrdersService {
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

  private async resolveItem(tx: Prisma.TransactionClient, organizationId: string, input: CreateWorkOrderItemDto) {
    if (input.type === 'SERVICE') {
      if (!input.serviceId || input.productId) throw new BadRequestException('SERVICE requires only serviceId');
      const service = await tx.service.findFirst({ where: { id: input.serviceId, organizationId, active: true }, select: { id: true, name: true, description: true, price: true } });
      if (!service) throw new NotFoundException('Active Service not found');
      return { type: input.type, serviceId: service.id, productId: null, description: service.description?.trim() || service.name, unitPrice: service.price.toString() };
    }
    if (input.type === 'PRODUCT') {
      if (!input.productId || input.serviceId) throw new BadRequestException('PRODUCT requires only productId');
      const product = await tx.product.findFirst({ where: { id: input.productId, organizationId, active: true }, select: { id: true, name: true, description: true, salePrice: true } });
      if (!product) throw new NotFoundException('Active Product not found');
      return { type: input.type, serviceId: null, productId: product.id, description: product.description?.trim() || product.name, unitPrice: product.salePrice.toString() };
    }
    if (input.serviceId || input.productId || !input.description || input.unitPrice === undefined) throw new BadRequestException('MANUAL requires description and unitPrice');
    return { type: 'MANUAL' as const, serviceId: null, productId: null, description: input.description.trim(), unitPrice: input.unitPrice };
  }

  private format(workOrder: any) {
    const items = (workOrder.items ?? []).map((item: any) => ({ ...item, quantity: fixedScale(item.quantity, 3), unitPrice: fixedScale(item.unitPrice, 2), total: totalOf(item.quantity.toString(), item.unitPrice.toString()) }));
    return { ...workOrder, items, total: sumTotals(items) };
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateWorkOrderDto) {
    const organizationId = this.tenant(principal);
    const workOrder = await this.prisma.$transaction(async (tx) => {
      await this.ensureCustomerVehicle(tx, organizationId, dto.customerId, dto.vehicleId);
      const counter = await tx.organization.update({ where: { id: organizationId }, data: { nextWorkOrderNumber: { increment: 1 } }, select: { nextWorkOrderNumber: true } });
      const created = await tx.workOrder.create({ data: { organizationId, customerId: dto.customerId, vehicleId: dto.vehicleId, number: counter.nextWorkOrderNumber - 1, reportedProblem: dto.reportedProblem?.trim(), diagnosis: dto.diagnosis?.trim(), mileage: dto.mileage, expectedCompletionDate: dto.expectedCompletionDate ? new Date(dto.expectedCompletionDate) : undefined, notes: dto.notes?.trim() } });
      for (const item of dto.items ?? []) {
        const resolved = await this.resolveItem(tx, organizationId, item);
        await tx.workOrderItem.create({ data: { organizationId, workOrderId: created.id, ...resolved, quantity: item.quantity } });
      }
      return tx.workOrder.findFirstOrThrow({ where: { id: created.id, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    });
    return this.format(workOrder);
  }

  async convertApprovedQuote(principal: AuthenticatedPrincipal, quoteId: string) {
    const organizationId = this.tenant(principal);
    try {
      const workOrder = await this.prisma.$transaction(async (tx) => {
        // Serialize conversions for this Quote before checking its current Work Order.
        const lockedQuote = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT "id" FROM "Quote"
          WHERE "id" = ${quoteId}::uuid AND "organizationId" = ${organizationId}::uuid
          FOR UPDATE
        `;
        if (lockedQuote.length === 0) throw new NotFoundException('Quote not found');

        const existing = await tx.workOrder.findFirst({ where: { quoteId, organizationId }, select: { id: true } });
        if (existing) throw this.quoteAlreadyConverted();

        const quote = await tx.quote.findFirst({
          where: { id: quoteId, organizationId },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
        if (!quote) throw new NotFoundException('Quote not found');
        if (quote.status !== 'APPROVED') {
          throw new ConflictException({
            type: 'https://api.autohub.local/problems/quote-not-approved',
            title: 'Quote is not approved',
            status: 409,
            detail: 'Only approved Quotes can be converted into Work Orders.',
            code: 'QUOTE_NOT_APPROVED',
          });
        }

        const counter = await tx.organization.update({
          where: { id: organizationId },
          data: { nextWorkOrderNumber: { increment: 1 } },
          select: { nextWorkOrderNumber: true },
        });
        const created = await tx.workOrder.create({
          data: {
            organizationId,
            customerId: quote.customerId,
            vehicleId: quote.vehicleId,
            quoteId: quote.id,
            number: counter.nextWorkOrderNumber - 1,
            notes: quote.notes ?? undefined,
          },
        });
        for (const item of quote.items) {
          await tx.workOrderItem.create({
            data: {
              organizationId,
              workOrderId: created.id,
              type: item.type,
              serviceId: item.serviceId,
              productId: item.productId,
              description: item.description,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            },
          });
        }
        return tx.workOrder.findFirstOrThrow({
          where: { id: created.id, organizationId },
          include: { items: { orderBy: { createdAt: 'asc' } } },
        });
      });
      return this.format(workOrder);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw this.quoteAlreadyConverted();
      }
      throw error;
    }
  }

  private quoteAlreadyConverted(): ConflictException {
    return new ConflictException({
      type: 'https://api.autohub.local/problems/quote-already-converted',
      title: 'Quote was already converted',
      status: 409,
      detail: 'An approved Quote can generate only one Work Order.',
      code: 'QUOTE_ALREADY_CONVERTED',
    });
  }

  async list(principal: AuthenticatedPrincipal, query: ListWorkOrdersDto) {
    const organizationId = this.tenant(principal); const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const number = search && /^\d+$/.test(search) ? Number(search) : undefined;
    const where: Prisma.WorkOrderWhereInput = {
      organizationId,
      ...(query.status ? { status: query.status as any } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(search ? { OR: [
        ...(number === undefined ? [] : [{ number }]),
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { vehicle: { plate: { contains: search, mode: 'insensitive' } } },
        { vehicle: { brand: { contains: search, mode: 'insensitive' } } },
        { vehicle: { model: { contains: search, mode: 'insensitive' } } },
      ] } : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({ where, include: { customer: { select: { name: true } }, vehicle: { select: { plate: true, brand: true, model: true } }, items: { orderBy: { createdAt: 'asc' } } }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.workOrder.count({ where }),
    ]);
    return { data: data.map((entry) => this.format(entry)), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const workOrder = await this.prisma.workOrder.findFirst({ where: { id, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    if (!workOrder) throw new NotFoundException('Work Order not found');
    return this.format(workOrder);
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateWorkOrderDto) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.$transaction(async (tx) => {
      const current = await tx.workOrder.findFirst({ where: { id, organizationId }, select: { status: true, customerId: true, vehicleId: true } });
      if (!current) throw new NotFoundException('Work Order not found');
      if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(current.status)) throw new ConflictException('Historical Work Orders cannot be edited');
      if (dto.customerId || dto.vehicleId) await this.ensureCustomerVehicle(tx, organizationId, dto.customerId ?? current.customerId, dto.vehicleId ?? current.vehicleId);
      return tx.workOrder.update({ where: { organizationId_id: { organizationId, id } }, data: { ...(dto.customerId ? { customerId: dto.customerId } : {}), ...(dto.vehicleId ? { vehicleId: dto.vehicleId } : {}), ...(dto.reportedProblem !== undefined ? { reportedProblem: dto.reportedProblem.trim() } : {}), ...(dto.diagnosis !== undefined ? { diagnosis: dto.diagnosis.trim() } : {}), ...(dto.mileage !== undefined ? { mileage: dto.mileage } : {}), ...(dto.expectedCompletionDate !== undefined ? { expectedCompletionDate: new Date(dto.expectedCompletionDate) } : {}), ...(dto.notes !== undefined ? { notes: dto.notes.trim() } : {}) }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    });
    return this.format(result);
  }

  private async editable(tx: Prisma.TransactionClient, organizationId: string, workOrderId: string) {
    const workOrder = await tx.workOrder.findFirst({ where: { id: workOrderId, organizationId }, select: { status: true } });
    if (!workOrder) throw new NotFoundException('Work Order not found');
    if (['COMPLETED', 'DELIVERED', 'CANCELLED'].includes(workOrder.status)) throw new ConflictException('Historical Work Orders cannot be edited');
  }

  async addItem(principal: AuthenticatedPrincipal, workOrderId: string, dto: CreateWorkOrderItemDto) {
    const organizationId = this.tenant(principal);
    const workOrder = await this.prisma.$transaction(async (tx) => {
      await this.editable(tx, organizationId, workOrderId);
      const resolved = await this.resolveItem(tx, organizationId, dto);
      await tx.workOrderItem.create({ data: { organizationId, workOrderId, ...resolved, quantity: dto.quantity } });
      return tx.workOrder.findFirstOrThrow({ where: { id: workOrderId, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    });
    return this.format(workOrder);
  }

  async updateItem(principal: AuthenticatedPrincipal, workOrderId: string, itemId: string, dto: UpdateWorkOrderItemDto) {
    const organizationId = this.tenant(principal);
    const workOrder = await this.prisma.$transaction(async (tx) => {
      await this.editable(tx, organizationId, workOrderId);
      const current = await tx.workOrderItem.findFirst({ where: { id: itemId, workOrderId, organizationId } });
      if (!current) throw new NotFoundException('Work Order Item not found');
      const type = dto.type ?? current.type;
      const merged = { type, serviceId: dto.serviceId ?? (type === current.type ? current.serviceId ?? undefined : undefined), productId: dto.productId ?? (type === current.type ? current.productId ?? undefined : undefined), description: dto.description ?? current.description, quantity: dto.quantity ?? current.quantity.toString(), unitPrice: dto.unitPrice ?? current.unitPrice.toString() } as UpdateWorkOrderItemDto;
      const resolved = await this.resolveItem(tx, organizationId, merged as CreateWorkOrderItemDto);
      await tx.workOrderItem.updateMany({ where: { id: itemId, workOrderId, organizationId }, data: { ...resolved, quantity: merged.quantity } });
      return tx.workOrder.findFirstOrThrow({ where: { id: workOrderId, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
    });
    return this.format(workOrder);
  }

  async removeItem(principal: AuthenticatedPrincipal, workOrderId: string, itemId: string) {
    const organizationId = this.tenant(principal);
    await this.prisma.$transaction(async (tx) => {
      await this.editable(tx, organizationId, workOrderId);
      const result = await tx.workOrderItem.deleteMany({ where: { id: itemId, workOrderId, organizationId } });
      if (result.count !== 1) throw new NotFoundException('Work Order Item not found');
    });
    return this.findOne(principal, workOrderId);
  }

  async requestApproval(p: AuthenticatedPrincipal, id: string) { return this.transition(p, id, 'requestApproval'); }
  async start(p: AuthenticatedPrincipal, id: string) { return this.transition(p, id, 'start'); }
  async waitParts(p: AuthenticatedPrincipal, id: string) { return this.transition(p, id, 'waitParts'); }
  async complete(p: AuthenticatedPrincipal, id: string) { return this.transition(p, id, 'complete'); }
  async deliver(p: AuthenticatedPrincipal, id: string) { return this.transition(p, id, 'deliver'); }
  async cancel(p: AuthenticatedPrincipal, id: string) { return this.transition(p, id, 'cancel'); }

  private async transition(principal: AuthenticatedPrincipal, id: string, action: WorkOrderAction) {
    const organizationId = this.tenant(principal); const rule = transitions[action];
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.workOrder.findFirst({ where: { id, organizationId }, include: { items: { orderBy: { createdAt: 'asc' } } } });
      if (!current) throw new NotFoundException('Work Order not found');
      if (!rule.from.includes(current.status)) throw new ConflictException({ type: 'https://api.autohub.local/problems/work-order-invalid-transition', title: 'Work Order transition is not allowed', status: 409, detail: `Work Order cannot ${action} from ${current.status}.`, code: 'WORK_ORDER_INVALID_TRANSITION' });
      const updated = await tx.workOrder.update({ where: { organizationId_id: { organizationId, id } }, data: { status: rule.to as any }, include: { items: { orderBy: { createdAt: 'asc' } } } });
      return this.format(updated);
    });
  }
}
