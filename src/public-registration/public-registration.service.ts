import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHmac, createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { TransactionalEmailService } from '../common/transactional-email.service';
import { TurnstileService } from '../common/turnstile.service';
import { CreateRegistrationDto } from './dto/create-registration.dto';
import { normalizeCpfCnpj } from './cpf-cnpj.validator';
import { BASIC_PLAN_CODE } from '../platform/plans/basic-plan';
import { TrialRemindersService } from '../trial/trial-reminders.service';

export const REGISTRATION_NEUTRAL_MESSAGE = 'Se os dados puderem iniciar um cadastro, enviaremos instruções para o e-mail informado.';
export const RECOVERY_NEUTRAL_MESSAGE = 'Se houver uma conta compatível, enviaremos instruções para o e-mail informado.';
const TRIAL_DURATION_MS = 14 * 24 * 60 * 60 * 1000;

@Injectable()
export class PublicRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: TransactionalEmailService,
    private readonly turnstile: TurnstileService,
    private readonly trialReminders: TrialRemindersService,
  ) {}

  private normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
  private fingerprint(value: string): string {
    const pepper = this.config.get<string>('TRIAL_ELIGIBILITY_PEPPER') ?? this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', pepper).update(value).digest('hex');
  }
  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
  private tokenTtlDays(): number { return this.config.get<number>('ACTIVATION_TOKEN_TTL_DAYS') ?? 3; }
  private confirmationLink(token: string): string { return `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/confirmar-email?token=${encodeURIComponent(token)}`; }
  private passwordOptions() { return { type: argon2.argon2id, memoryCost: this.config.get<number>('ARGON2_MEMORY_COST') ?? 65536, timeCost: this.config.get<number>('ARGON2_TIME_COST') ?? 3, parallelism: this.config.get<number>('ARGON2_PARALLELISM') ?? 1 } as const; }

  async submit(dto: CreateRegistrationDto, remoteIp?: string): Promise<{ message: string }> {
    await this.turnstile.assertAllowed(dto.turnstileToken, remoteIp);
    const document = normalizeCpfCnpj(dto.document);
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await argon2.hash(dto.password, this.passwordOptions());
    const activationSecret = randomBytes(32).toString('base64url');
    const documentFingerprint = this.fingerprint(document);
    const emailFingerprint = this.fingerprint(email);
    let messageToSend: { to: string; token: string } | undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        // Serialize equal identifiers so retries cannot create two pending accounts.
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${document}:${email}`}, 824631));`;
        const [existingEmail, existingDocument, usedDocument, usedEmail, version] = await Promise.all([
          tx.user.findUnique({ where: { email }, select: { id: true } }),
          tx.organization.findUnique({ where: { document }, select: { id: true } }),
          tx.trialEligibilityRecord.findUnique({ where: { documentFingerprint }, select: { id: true } }),
          tx.trialEligibilityRecord.findUnique({ where: { emailFingerprint }, select: { id: true } }),
          tx.planVersion.findFirst({ where: { plan: { code: BASIC_PLAN_CODE, archivedAt: null }, status: 'PUBLISHED' }, orderBy: [{ publishedAt: 'desc' }, { version: 'desc' }], select: { id: true, price: true, currency: true, interval: true, organizationLimit: true, userLimit: true, workOrderLimit: true, gracePeriodDays: true } }),
        ]);
        if (existingEmail || existingDocument || usedDocument || usedEmail || !version) return;

        const account = await tx.commercialAccount.create({ data: { name: dto.workshopName.trim(), billingEmail: email, billingDocument: document } });
        const organization = await tx.organization.create({ data: { commercialAccountId: account.id, name: dto.workshopName.trim(), document, phone: dto.phone.trim(), email } });
        const user = await tx.user.create({ data: { organizationId: organization.id, name: dto.responsibleName.trim(), email, passwordHash, role: 'ADMIN', status: UserStatus.PENDING_ACTIVATION } });
        await tx.actionToken.create({ data: { userId: user.id, purpose: 'ACTIVATE_ACCOUNT', tokenHash: this.hashToken(activationSecret), expiresAt: new Date(Date.now() + (this.config.get<number>('ACTIVATION_TOKEN_TTL_DAYS') ?? 3) * 86400000) } });
        await tx.commercialAccount.update({ where: { id: account.id }, data: { primaryContactOrganizationId: organization.id, primaryContactUserId: user.id } });
        await tx.subscription.create({ data: { commercialAccountId: account.id, planVersionId: version.id, status: 'SCHEDULED', contractedPrice: version.price, contractedCurrency: version.currency, contractedInterval: version.interval, contractedOrganizationLimit: version.organizationLimit, contractedUserLimit: version.userLimit, contractedWorkOrderLimit: version.workOrderLimit, contractedGracePeriodDays: version.gracePeriodDays, trialEnabled: true } });
        const requestContext = { requestIp: remoteIp?.slice(0, 64), context: 'SELF_SERVICE_REGISTRATION' };
        await tx.consentRecord.createMany({ data: [
          { userId: user.id, organizationId: organization.id, type: 'TERMS_OF_USE', policyVersion: '0.1', ...requestContext },
          { userId: user.id, organizationId: organization.id, type: 'PRIVACY_POLICY', policyVersion: '0.1', ...requestContext },
          ...(dto.marketingConsent ? [{ userId: user.id, organizationId: organization.id, type: 'PROMOTIONAL' as const, policyVersion: '0.1', ...requestContext }] : []),
        ] });
        await tx.auditEvent.create({ data: { actorType: 'SYSTEM', action: 'self_service.registration_submitted', targetType: 'SELF_SERVICE_REGISTRATION', targetId: organization.id, commercialAccountId: account.id, organizationId: organization.id, after: { consented: true } } });
        messageToSend = { to: email, token: activationSecret };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) return { message: REGISTRATION_NEUTRAL_MESSAGE };
      throw error;
    }

    if (messageToSend) {
      const link = this.confirmationLink(messageToSend.token);
      try { await this.email.send({ to: messageToSend.to, subject: 'Confirme seu cadastro no Vekar', text: `Confirme seu e-mail para iniciar seu cadastro: ${link}` }); } catch { /* Delivery is retriable and must not reveal registration state. */ }
    }
    return { message: REGISTRATION_NEUTRAL_MESSAGE };
  }

  async confirm(token: string): Promise<{ success: true; trialStartsAt: string; trialEndsAt: string }> {
    if (typeof token !== 'string' || token.length < 32 || token.length > 512) throw new UnauthorizedException('Activation token is invalid or expired');
    const tokenHash = this.hashToken(token);
    const now = new Date();
    const trialEndsAt = new Date(now.getTime() + TRIAL_DURATION_MS);
    let result: { trialStartsAt: Date; trialEndsAt: Date } | undefined;
    try {
      await this.prisma.$transaction(async (tx) => {
        const action = await tx.actionToken.findFirst({
          where: { tokenHash, purpose: 'ACTIVATE_ACCOUNT', usedAt: null, expiresAt: { gt: now } },
          select: { id: true, userId: true },
        });
        if (!action) throw new UnauthorizedException('Activation token is invalid or expired');
        const claimed = await tx.actionToken.updateMany({ where: { id: action.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
        if (claimed.count !== 1) throw new UnauthorizedException('Activation token is invalid or expired');
        const user = await tx.user.findUnique({ where: { id: action.userId }, select: { id: true, email: true, status: true, organizationId: true, organization: { select: { document: true, operationalStatus: true, commercialAccountId: true } } } });
        if (!user || user.status !== 'PENDING_ACTIVATION' || !user.organization?.commercialAccountId || user.organization.operationalStatus !== 'ACTIVE') throw new UnauthorizedException('Account cannot be activated');
        const subscription = await tx.subscription.findFirst({ where: { commercialAccountId: user.organization.commercialAccountId, status: { not: 'ENDED' }, trialEnabled: true }, orderBy: { createdAt: 'desc' }, select: { id: true, trialStartsAt: true, trialEndsAt: true } });
        if (!subscription || subscription.trialStartsAt || subscription.trialEndsAt || !user.organization.document) throw new UnauthorizedException('Account cannot be activated');
        const documentFingerprint = this.fingerprint(user.organization.document);
        const emailFingerprint = this.fingerprint(user.email);
        await tx.trialEligibilityRecord.create({ data: { documentFingerprint, emailFingerprint, trialStartedAt: now } });
        const activated = await tx.user.updateMany({ where: { id: user.id, status: 'PENDING_ACTIVATION' }, data: { status: 'ACTIVE' } });
        if (activated.count !== 1) throw new UnauthorizedException('Account cannot be activated');
        await tx.subscription.update({ where: { id: subscription.id }, data: { status: 'CURRENT', trialStartsAt: now, trialEndsAt, commercialStartAt: now } });
        await this.trialReminders.scheduleForConfirmation(tx, { subscriptionId: subscription.id, commercialAccountId: user.organization.commercialAccountId, organizationId: user.organizationId!, recipientUserId: user.id, trialEndsAt });
        await tx.auditEvent.create({ data: { actorType: 'SYSTEM', action: 'self_service.registration_confirmed', targetType: 'SELF_SERVICE_REGISTRATION', targetId: user.organizationId!, organizationId: user.organizationId, commercialAccountId: user.organization.commercialAccountId, after: { trialStartsAt: now.toISOString(), trialEndsAt: trialEndsAt.toISOString() } } });
        result = { trialStartsAt: now, trialEndsAt };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 10000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && ['P2002', 'P2034'].includes(error.code)) throw new UnauthorizedException('Activation token is invalid or expired');
      throw error;
    }
    if (!result) throw new UnauthorizedException('Activation token is invalid or expired');
    return { success: true, trialStartsAt: result.trialStartsAt.toISOString(), trialEndsAt: result.trialEndsAt.toISOString() };
  }

  async resendConfirmation(emailInput: string, remoteIp?: string, turnstileToken?: string): Promise<{ message: string }> {
    const email = this.normalizeEmail(emailInput);
    let messageToSend: { to: string; token: string } | undefined;
    await this.turnstile.assertAllowed(turnstileToken, remoteIp);
    const token = randomBytes(32).toString('base64url');
    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { email }, select: { id: true, email: true, status: true, organization: { select: { operationalStatus: true } } } });
      if (!user || user.status !== 'PENDING_ACTIVATION' || user.organization?.operationalStatus !== 'ACTIVE') return;
      await tx.actionToken.updateMany({ where: { userId: user.id, purpose: 'ACTIVATE_ACCOUNT', usedAt: null }, data: { expiresAt: new Date() } });
      await tx.actionToken.create({ data: { userId: user.id, purpose: 'ACTIVATE_ACCOUNT', tokenHash: this.hashToken(token), expiresAt: new Date(Date.now() + this.tokenTtlDays() * 86400000) } });
      messageToSend = { to: user.email, token };
    });
    if (messageToSend) {
      try { await this.email.send({ to: messageToSend.to, subject: 'Confirme seu cadastro no Vekar', text: `Confirme seu e-mail para iniciar seu cadastro: ${this.confirmationLink(messageToSend.token)}` }); } catch { /* neutral and retryable */ }
    }
    return { message: REGISTRATION_NEUTRAL_MESSAGE };
  }
}
