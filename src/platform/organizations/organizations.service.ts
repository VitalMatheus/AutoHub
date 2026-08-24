import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateOrganizationDto } from './dto/update-organization.dto';

const organizationSelect = { id: true, name: true, document: true, phone: true, email: true, addressLine1: true, addressLine2: true, city: true, state: true, postalCode: true, active: true, createdAt: true, updatedAt: true } as const;

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private normalizeEmail(email: string) { return email.trim().toLowerCase(); }
  private normalizeDocument(document: string) { return document.replace(/\D/g, ''); }
  private hashToken(token: string) { return createHash('sha256').update(token).digest('hex'); }

  async create(dto: CreateOrganizationDto) {
    const adminName = dto.admin?.name ?? dto.adminName;
    const adminEmail = dto.admin?.email ?? dto.adminEmail;
    if (!adminName || !adminEmail) throw new BadRequestException('First Organization Admin is required');
    const activationToken = randomBytes(32).toString('base64url');
    const expiresDays = this.config.get<number>('ACTIVATION_TOKEN_TTL_DAYS') ?? 3;
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.create({ data: {
          name: dto.name.trim(), document: dto.document ? this.normalizeDocument(dto.document) : undefined, phone: dto.phone, email: dto.email ? this.normalizeEmail(dto.email) : undefined,
          addressLine1: dto.addressLine1, addressLine2: dto.addressLine2, city: dto.city, state: dto.state, postalCode: dto.postalCode,
        }, select: organizationSelect });
        const admin = await tx.user.create({ data: {
          organizationId: organization.id, name: adminName.trim(), email: this.normalizeEmail(adminEmail), role: 'ADMIN', status: 'PENDING_ACTIVATION',
        }, select: { id: true, name: true, email: true, role: true, status: true, organizationId: true } });
        await tx.actionToken.create({ data: { userId: admin.id, purpose: 'ACTIVATE_ACCOUNT', tokenHash: this.hashToken(activationToken), expiresAt: new Date(Date.now() + expiresDays * 86400000) } });
        return { organization, admin };
      });
      return { ...result, activationToken };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Organization or admin already exists');
      throw error;
    }
  }

  async list(page = 1, pageSize = 20) {
    const safePage = Math.max(1, page); const safeSize = Math.min(100, Math.max(1, pageSize));
    const [data, total] = await this.prisma.$transaction([
      this.prisma.organization.findMany({ select: organizationSelect, orderBy: { createdAt: 'desc' }, skip: (safePage - 1) * safeSize, take: safeSize }),
      this.prisma.organization.count(),
    ]);
    return { data, meta: { page: safePage, pageSize: safeSize, total, totalPages: Math.ceil(total / safeSize) } };
  }

  async findOne(id: string) {
    const organization = await this.prisma.organization.findUnique({ where: { id }, select: { ...organizationSelect, users: { where: { role: 'ADMIN' }, select: { id: true, name: true, email: true, status: true } } } });
    if (!organization) throw new NotFoundException('Organization not found');
    return organization;
  }

  async update(id: string, dto: UpdateOrganizationDto) {
    try {
      return await this.prisma.organization.update({ where: { id }, data: { ...dto, name: dto.name?.trim(), email: dto.email ? this.normalizeEmail(dto.email) : undefined, document: dto.document ? this.normalizeDocument(dto.document) : undefined }, select: organizationSelect });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Organization not found');
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('Organization document already exists');
      throw error;
    }
  }

  async setActive(id: string, active: boolean) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const organization = await tx.organization.update({ where: { id }, data: { active }, select: organizationSelect });
        if (!active) {
          await tx.session.updateMany({ where: { user: { organizationId: id }, revokedAt: null }, data: { revokedAt: new Date() } });
        }
        return organization;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') throw new NotFoundException('Organization not found');
      throw error;
    }
  }

}
