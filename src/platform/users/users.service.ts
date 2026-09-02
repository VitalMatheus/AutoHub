import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthenticatedPrincipal } from '../../auth/authenticated-principal';
import { InviteUserDto } from './dto/invite-user.dto';
import { AuditEventsService } from '../audit-events/audit-events.service';
import { AuditAction, AuditTargetType } from '../audit-events/dto/list-audit-events.dto';

const userSelect = {
  id: true,
  organizationId: true,
  name: true,
  email: true,
  role: true,
  status: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly audit: AuditEventsService,
  ) {}

  private organizationId(principal: AuthenticatedPrincipal): string {
    if (principal.role !== 'ADMIN' || !principal.organizationId) {
      throw new ForbiddenException('Organization Admin access required');
    }
    return principal.organizationId;
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async list(principal: AuthenticatedPrincipal) {
    const organizationId = this.organizationId(principal);
    return this.prisma.user.findMany({
      where: { organizationId },
      select: userSelect,
      orderBy: { createdAt: 'asc' },
    });
  }

  async invite(principal: AuthenticatedPrincipal, dto: InviteUserDto) {
    const organizationId = this.organizationId(principal);
    const email = this.normalizeEmail(dto.email);
    const activationToken = randomBytes(32).toString('base64url');
    const expiresDays = this.config.get<number>('ACTIVATION_TOKEN_TTL_DAYS') ?? 3;

    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.findFirst({
          where: { id: organizationId, operationalStatus: 'ACTIVE' },
          select: { id: true, commercialAccountId: true },
        });
        if (!organization) throw new NotFoundException('Organization not found');
        await this.enforceUserLimit(tx, organization.commercialAccountId, organizationId);

        const user = await tx.user.create({
          data: {
            organizationId,
            name: dto.name.trim(),
            email,
            role: 'ADMIN',
            status: 'PENDING_ACTIVATION',
          },
          select: userSelect,
        });
        await tx.actionToken.create({
          data: {
            userId: user.id,
            purpose: 'ACTIVATE_ACCOUNT',
            tokenHash: this.hashToken(activationToken),
            expiresAt: new Date(Date.now() + expiresDays * 86_400_000),
          },
        });
        await this.audit.record(tx, principal, { action: AuditAction.USER_INVITATION_ISSUED, targetType: AuditTargetType.USER, targetId: user.id, organizationId, commercialAccountId: organization.commercialAccountId ?? undefined, after: { name: user.name, email: user.email, role: user.role, status: user.status } });
        return { user, activationToken };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('User email already exists');
      }
      throw error;
    }
  }

  async setStatus(principal: AuthenticatedPrincipal, userId: string, status: 'ACTIVE' | 'DISABLED') {
    const organizationId = this.organizationId(principal);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.user.findFirst({ where: { id: userId, organizationId, role: 'ADMIN' }, select: { id: true, status: true, organization: { select: { commercialAccountId: true } } } });
        if (!existing) throw new NotFoundException('User not found');
        if (status === 'ACTIVE' && existing.status === 'DISABLED') await this.enforceUserLimit(tx, existing.organization?.commercialAccountId ?? null, organizationId);
        const updated = await tx.user.updateMany({
          where: { id: userId, organizationId, role: 'ADMIN' },
          data: { status },
        });
        if (updated.count !== 1) throw new NotFoundException('User not found');
        if (status === 'DISABLED') {
          await tx.session.updateMany({
            where: { userId, user: { organizationId }, revokedAt: null },
            data: { revokedAt: new Date() },
          });
        }
        const result = await tx.user.findFirst({ where: { id: userId, organizationId }, select: userSelect });
        await this.audit.record(tx, principal, { action: status === 'ACTIVE' ? AuditAction.USER_ACTIVATED : AuditAction.USER_DEACTIVATED, targetType: AuditTargetType.USER, targetId: userId, organizationId, commercialAccountId: existing.organization?.commercialAccountId ?? undefined, before: { status: existing.status }, after: { status } });
        return result;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
        throw new NotFoundException('User not found');
      }
      throw error;
    }
  }

  private async enforceUserLimit(tx: any, commercialAccountId: string | null, organizationId: string) {
    if (!commercialAccountId) return;
    if (tx.$executeRaw) await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${commercialAccountId}, 0))`;
    const subscription = await tx.subscription.findFirst({ where: { commercialAccountId, status: { not: 'ENDED' } }, orderBy: { createdAt: 'desc' }, select: { contractedUserLimit: true } });
    if (!subscription) return;
    const count = await tx.user.count({ where: { organization: { commercialAccountId }, status: { not: 'DISABLED' } } });
    if (count >= subscription.contractedUserLimit) throw new ConflictException({ code: 'PLAN_USER_LIMIT_REACHED', detail: `The Commercial Account allows at most ${subscription.contractedUserLimit} non-disabled Users.` });
  }

  async revokeSessions(principal: AuthenticatedPrincipal, userId: string): Promise<{ success: true }> {
    const organizationId = this.organizationId(principal);
    const user = await this.prisma.user.findFirst({
      where: { id: userId, organizationId, role: 'ADMIN' },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.session.updateMany({
      where: { userId, user: { organizationId }, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }
}
