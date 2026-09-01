import { ForbiddenException, Injectable } from '@nestjs/common';
import { WorkOrderStatus } from '@prisma/client';
import type { AuthenticatedPrincipal } from '../auth/authenticated-principal';
import { PrismaService } from '../prisma/prisma.service';

const openWorkOrderStatuses: WorkOrderStatus[] = [WorkOrderStatus.OPEN, WorkOrderStatus.WAITING_APPROVAL, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.WAITING_PARTS];

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async summary(principal: AuthenticatedPrincipal) {
    if (principal.role !== 'ADMIN' || !principal.organizationId) throw new ForbiddenException('Organization Admin access required');
    const organizationId = principal.organizationId;
    const [customers, openWorkOrders, pendingQuotes] = await this.prisma.$transaction([
      this.prisma.customer.count({ where: { organizationId, active: true } }),
      this.prisma.workOrder.count({ where: { organizationId, status: { in: openWorkOrderStatuses } } }),
      this.prisma.quote.count({ where: { organizationId, status: 'PENDING' } }),
    ]);
    return { customers, openWorkOrders, pendingQuotes };
  }
}
