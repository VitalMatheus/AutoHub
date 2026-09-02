import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ListCommercialAccountsDto } from './dto/list-commercial-accounts.dto';

const accountSelect = {
  id: true, name: true, billingEmail: true, billingDocument: true,
  primaryContactOrganizationId: true, primaryContactUserId: true, createdAt: true, updatedAt: true,
  primaryContact: { select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } },
  organizations: { select: { id: true, name: true, operationalStatus: true, createdAt: true }, orderBy: { createdAt: 'asc' as const } },
  subscriptions: { orderBy: { createdAt: 'desc' as const }, take: 1, select: { id: true, status: true, createdAt: true, migratedAt: true, regularizedAt: true, contractedPrice: true, contractedCurrency: true, contractedInterval: true, contractedOrganizationLimit: true, contractedUserLimit: true, contractedWorkOrderLimit: true, contractedGracePeriodDays: true, planVersion: { select: { id: true, version: true, plan: { select: { id: true, name: true } } } } } },
} as const;

function present(account: Prisma.CommercialAccountGetPayload<{ select: typeof accountSelect }>) {
  const subscription = account.subscriptions[0];
  const validContact = account.primaryContact?.role === 'ADMIN' && account.primaryContact.status === 'ACTIVE'
    ? account.primaryContact
    : null;
  return {
    ...account,
    primaryContact: validContact,
    missingPrimaryContact: validContact === null,
    subscriptions: subscription ? [{ ...subscription, contractedPrice: subscription.contractedPrice.toFixed(2) }] : [],
  };
}

@Injectable()
export class CommercialAccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(dto: ListCommercialAccountsDto) {
    const page = dto.page ?? 1;
    const pageSize = dto.pageSize ?? 20;
    const where: Prisma.CommercialAccountWhereInput = dto.search?.trim()
      ? { name: { contains: dto.search.trim(), mode: 'insensitive' } }
      : {};
    const [accounts, total] = await this.prisma.$transaction([
      this.prisma.commercialAccount.findMany({ where, select: accountSelect, orderBy: [{ name: 'asc' }, { id: 'asc' }], skip: (page - 1) * pageSize, take: pageSize }),
      this.prisma.commercialAccount.count({ where }),
    ]);
    return { data: accounts.map(present), meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) } };
  }

  async detail(id: string) {
    const account = await this.prisma.commercialAccount.findUnique({ where: { id }, select: accountSelect });
    if (!account) throw new NotFoundException('Commercial Account not found');
    return present(account);
  }
}
