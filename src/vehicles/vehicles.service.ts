import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';
import { CreateVehicleDto } from './dto/create-vehicle.dto';
import { ListVehiclesDto } from './dto/list-vehicles.dto';
import { UpdateVehicleDto } from './dto/update-vehicle.dto';
import { ListVehicleHistoryDto } from './dto/list-vehicle-history.dto';
import { sumTotals, totalOf } from '../quotes/decimal';

const vehicleSelect = {
  id: true, organizationId: true, customerId: true, plate: true, brand: true, model: true,
  year: true, color: true, mileage: true, notes: true, active: true, createdAt: true, updatedAt: true,
} as const;

@Injectable()
export class VehiclesService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) {
      throw new ForbiddenException('Organization Admin access required');
    }
    return principal.organizationId;
  }

  private normalizePlate(plate: string): string {
    return plate.replace(/[\s\-./]/g, '').toUpperCase();
  }

  private async ensureCustomer(organizationId: string, customerId: string): Promise<void> {
    const customer = await this.prisma.customer.findFirst({ where: { id: customerId, organizationId }, select: { id: true } });
    if (!customer) throw new NotFoundException('Customer not found');
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateVehicleDto) {
    const organizationId = this.tenant(principal);
    await this.ensureCustomer(organizationId, dto.customerId);
    try {
      return await this.prisma.vehicle.create({
        data: {
          organizationId, customerId: dto.customerId, plate: this.normalizePlate(dto.plate), brand: dto.brand.trim(),
          model: dto.model.trim(), year: dto.year, color: dto.color?.trim(), mileage: dto.mileage, notes: dto.notes?.trim(),
        }, select: vehicleSelect,
      });
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async list(principal: AuthenticatedPrincipal, query: ListVehiclesDto) {
    const organizationId = this.tenant(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const plate = query.plate ? this.normalizePlate(query.plate) : undefined;
    const where: Prisma.VehicleWhereInput = {
      organizationId,
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(plate ? { plate: { contains: plate } } : {}),
      ...(query.active === undefined ? { active: true } : { active: query.active }),
    };
    const orderBy: Prisma.VehicleOrderByWithRelationInput[] = [
      { [query.sort ?? 'createdAt']: query.direction ?? 'asc' }, { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({ where, select: vehicleSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.vehicle.count({ where }),
    ]);
    return { data, meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const vehicle = await this.prisma.vehicle.findFirst({ where: { id, organizationId }, select: vehicleSelect });
    if (!vehicle) throw new NotFoundException('Vehicle not found');
    return vehicle;
  }

  async history(principal: AuthenticatedPrincipal, vehicleId: string, query: ListVehicleHistoryDto) {
    const organizationId = this.tenant(principal);
    const vehicle = await this.prisma.vehicle.findFirst({
      where: { id: vehicleId, organizationId },
      select: { id: true },
    });
    if (!vehicle) throw new NotFoundException('Vehicle not found');

    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const statuses = query.status ? [query.status] : ['COMPLETED', 'DELIVERED'];
    const where: Prisma.WorkOrderWhereInput = {
      organizationId,
      vehicleId,
      status: { in: statuses as Array<'COMPLETED' | 'DELIVERED'> },
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.workOrder.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, document: true, phone: true, email: true } },
          items: { orderBy: { createdAt: 'asc' } },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return {
      data: data.map((workOrder: any) => {
        const items = (workOrder.items ?? []).map((item: any) => ({
          ...item,
          quantity: item.quantity.toString(),
          unitPrice: item.unitPrice.toString(),
          total: totalOf(item.quantity.toString(), item.unitPrice.toString()),
        }));
        return { ...workOrder, items, total: sumTotals(items) };
      }),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    };
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateVehicleDto) {
    const organizationId = this.tenant(principal);
    if (dto.customerId !== undefined) await this.ensureCustomer(organizationId, dto.customerId);
    try {
      const result = await this.prisma.vehicle.updateMany({
        where: { id, organizationId },
        data: {
          ...(dto.customerId === undefined ? {} : { customerId: dto.customerId }),
          ...(dto.plate === undefined ? {} : { plate: this.normalizePlate(dto.plate) }),
          ...(dto.brand === undefined ? {} : { brand: dto.brand.trim() }),
          ...(dto.model === undefined ? {} : { model: dto.model.trim() }),
          ...(dto.year === undefined ? {} : { year: dto.year }),
          ...(dto.color === undefined ? {} : { color: dto.color.trim() }),
          ...(dto.mileage === undefined ? {} : { mileage: dto.mileage }),
          ...(dto.notes === undefined ? {} : { notes: dto.notes.trim() }),
        },
      });
      if (result.count !== 1) throw new NotFoundException('Vehicle not found');
      return this.findOne(principal, id);
    } catch (error) {
      this.mapConflict(error);
      throw error;
    }
  }

  async remove(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    try {
      const result = await this.prisma.vehicle.deleteMany({ where: { id, organizationId } });
      if (result.count !== 1) throw new NotFoundException('Vehicle not found');
      return { success: true };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        const retained = await this.prisma.vehicle.updateMany({ where: { id, organizationId }, data: { active: false } });
        if (retained.count !== 1) throw new NotFoundException('Vehicle not found');
        return this.findOne(principal, id);
      }
      throw error;
    }
  }

  private mapConflict(error: unknown): void {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('Vehicle plate already exists in this Organization');
    }
    if ((error as { code?: string })?.code === 'P2002') {
      throw new ConflictException('Vehicle plate already exists in this Organization');
    }
  }
}
