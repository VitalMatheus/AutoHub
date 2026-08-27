import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { formatMoney } from '../common/money/format-money';
import { PrismaService } from '../prisma/prisma.service';
import { CreateServiceDto } from './dto/create-service.dto';
import { ListServicesDto } from './dto/list-services.dto';
import { UpdateServiceDto } from './dto/update-service.dto';

const serviceSelect = {
  id: true, organizationId: true, name: true, description: true, price: true,
  active: true, createdAt: true, updatedAt: true,
} as const;

type ServiceRecord = Prisma.ServiceGetPayload<{ select: typeof serviceSelect }>;

function serializeService(service: ServiceRecord) {
  return { ...service, price: formatMoney(service.price) };
}

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  private tenant(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) {
      throw new ForbiddenException('Organization Admin access required');
    }
    return principal.organizationId;
  }

  async create(principal: AuthenticatedPrincipal, dto: CreateServiceDto) {
    const organizationId = this.tenant(principal);
    const service = await this.prisma.service.create({
      data: { organizationId, name: dto.name.trim(), description: dto.description?.trim(), price: dto.price },
      select: serviceSelect,
    });
    return serializeService(service);
  }

  async list(principal: AuthenticatedPrincipal, query: ListServicesDto) {
    const organizationId = this.tenant(principal);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 20;
    const search = query.search?.trim();
    const active = query.active ?? true;
    const where: Prisma.ServiceWhereInput = {
      organizationId, active,
      ...(search ? { OR: [{ name: { contains: search, mode: 'insensitive' } }, { description: { contains: search, mode: 'insensitive' } }] } : {}),
    };
    const orderBy: Prisma.ServiceOrderByWithRelationInput[] = [
      { [query.sort ?? 'createdAt']: query.direction ?? 'asc' }, { id: 'asc' },
    ];
    const [data, total] = await this.prisma.$transaction([
      this.prisma.service.findMany({ where, select: serviceSelect, orderBy, skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.service.count({ where }),
    ]);
    return { data: data.map(serializeService), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async findOne(principal: AuthenticatedPrincipal, id: string) {
    const organizationId = this.tenant(principal);
    const service = await this.prisma.service.findFirst({ where: { id, organizationId }, select: serviceSelect });
    if (!service) throw new NotFoundException('Service not found');
    return serializeService(service);
  }

  async update(principal: AuthenticatedPrincipal, id: string, dto: UpdateServiceDto) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.service.updateMany({
      where: { id, organizationId },
      data: {
        ...(dto.name === undefined ? {} : { name: dto.name.trim() }),
        ...(dto.description === undefined ? {} : { description: dto.description.trim() }),
        ...(dto.price === undefined ? {} : { price: dto.price }),
      },
    });
    if (result.count !== 1) throw new NotFoundException('Service not found');
    return this.findOne(principal, id);
  }

  async activate(principal: AuthenticatedPrincipal, id: string) { return this.setActive(principal, id, true); }
  async deactivate(principal: AuthenticatedPrincipal, id: string) { return this.setActive(principal, id, false); }

  private async setActive(principal: AuthenticatedPrincipal, id: string, active: boolean) {
    const organizationId = this.tenant(principal);
    const result = await this.prisma.service.updateMany({ where: { id, organizationId }, data: { active } });
    if (result.count !== 1) throw new NotFoundException('Service not found');
    return this.findOne(principal, id);
  }
}
