import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { AccessTokenPayload, AuthenticatedPrincipal } from './authenticated-principal';
import { PRINCIPAL_SELECT } from './authenticated-principal';

export const INVALID_CREDENTIALS = 'Invalid email or password';
const AUTHENTICATION_REQUIRED = 'Authentication required';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  normalizeEmail(email: string): string { return email.trim().toLowerCase(); }

  private hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(email) },
      include: { organization: true },
    });
    if (!user?.passwordHash || user.status !== 'ACTIVE' || (user.organization && user.organization.operationalStatus !== 'ACTIVE')) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }
    const valid = await argon2.verify(user.passwordHash, password).catch(() => false);
    if (!valid) throw new UnauthorizedException(INVALID_CREDENTIALS);

    const refreshToken = randomBytes(32).toString('base64url');
    const ttlDays = this.config.get<number>('REFRESH_TOKEN_TTL_DAYS') ?? 30;
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    const session = await this.prisma.session.create({ data: {
      userId: user.id, refreshTokenHash: this.hashRefreshToken(refreshToken), expiresAt,
    }});
    const accessToken = await this.issueAccessToken(user.id, session.id);
    return { accessToken, refreshToken, expiresIn: 900, tokenType: 'Bearer' };
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const now = new Date();
    const session = await this.prisma.session.findFirst({
      where: { refreshTokenHash: tokenHash },
      select: { id: true, userId: true, revokedAt: true, expiresAt: true },
    });
    if (!session || session.revokedAt || session.expiresAt <= now) {
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
    }

    // Validate the account before consuming the current credential. A disabled
    // user or organization must not lose a still-valid session as a side
    // effect of an unauthorized refresh attempt.
    const principal = await this.resolvePrincipal(session.userId, session.id);

    const nextRefreshToken = randomBytes(32).toString('base64url');
    const rotated = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.session.updateMany({
        where: {
          id: session.id,
          refreshTokenHash: tokenHash,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { refreshTokenHash: this.hashRefreshToken(nextRefreshToken) },
      });
      if (updated.count !== 1) throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
      return tx.session.findUnique({ where: { id: session.id }, select: { userId: true } });
    });
    if (!rotated) throw new UnauthorizedException(AUTHENTICATION_REQUIRED);

    return {
      accessToken: await this.issueAccessToken(principal.id, session.id),
      refreshToken: nextRefreshToken,
      expiresIn: 900,
      tokenType: 'Bearer',
    };
  }

  async resolvePrincipal(userId: string, sessionId: string): Promise<AuthenticatedPrincipal> {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: new Date() } },
      select: { user: { select: { ...PRINCIPAL_SELECT, status: true, organization: { select: { operationalStatus: true } } } } },
    });
    const user = session?.user;
    if (!user || user.status !== 'ACTIVE' || (user.organization && user.organization.operationalStatus !== 'ACTIVE')) {
      throw new UnauthorizedException(AUTHENTICATION_REQUIRED);
    }
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organizationId: user.organizationId,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async activate(token: string, password: string) {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.get<number>('ARGON2_MEMORY_COST') ?? 65536,
      timeCost: this.config.get<number>('ARGON2_TIME_COST') ?? 3,
      parallelism: this.config.get<number>('ARGON2_PARALLELISM') ?? 1,
    });
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const action = await tx.actionToken.findFirst({ where: { tokenHash, purpose: 'ACTIVATE_ACCOUNT', usedAt: null, expiresAt: { gt: now } }, select: { id: true, userId: true } });
      if (!action) throw new UnauthorizedException('Activation token is invalid or expired');
      const claimed = await tx.actionToken.updateMany({ where: { id: action.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new UnauthorizedException('Activation token is invalid or expired');
      const activated = await tx.user.updateMany({ where: { id: action.userId, status: 'PENDING_ACTIVATION', organization: { operationalStatus: 'ACTIVE' } }, data: { passwordHash, status: 'ACTIVE' } });
      if (activated.count !== 1) throw new UnauthorizedException('Account cannot be activated');
    });
    return { success: true };
  }

  private issueAccessToken(userId: string, sessionId: string): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, sid: sessionId };
    return this.jwt.signAsync(payload);
  }

  async bootstrapSuperAdmin(email: string, password: string, name: string) {
    const normalizedEmail = this.normalizeEmail(email);
    const passwordHash = await argon2.hash(password, {
      type: argon2.argon2id,
      memoryCost: this.config.get<number>('ARGON2_MEMORY_COST') ?? 65536,
      timeCost: this.config.get<number>('ARGON2_TIME_COST') ?? 3,
      parallelism: this.config.get<number>('ARGON2_PARALLELISM') ?? 1,
    });
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(824631);`;
      const existing = await tx.user.count({ where: { role: 'SUPER_ADMIN' } });
      if (existing > 0) throw new Error('A Super Admin already exists');
      return tx.user.create({ data: {
        name: name.trim(), email: normalizedEmail, passwordHash, role: 'SUPER_ADMIN', status: 'ACTIVE',
      }, select: { id: true, name: true, email: true, role: true, status: true } });
    }, { isolationLevel: 'Serializable' });
  }
}
