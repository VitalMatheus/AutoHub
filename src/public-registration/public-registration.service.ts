import { Injectable, ServiceUnavailableException } from '@nestjs/common';
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

export const REGISTRATION_NEUTRAL_MESSAGE = 'Se os dados puderem iniciar um cadastro, enviaremos instruções para o e-mail informado.';

@Injectable()
export class PublicRegistrationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly email: TransactionalEmailService,
    private readonly turnstile: TurnstileService,
  ) {}

  private normalizeEmail(email: string): string { return email.trim().toLowerCase(); }
  private fingerprint(value: string): string {
    const pepper = this.config.get<string>('TRIAL_ELIGIBILITY_PEPPER') ?? this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
    return createHmac('sha256', pepper).update(value).digest('hex');
  }
  private hashToken(token: string): string { return createHash('sha256').update(token).digest('hex'); }
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
      const link = `${this.config.getOrThrow<string>('PUBLIC_APP_URL')}/confirmar-email?token=${encodeURIComponent(messageToSend.token)}`;
      try { await this.email.send({ to: messageToSend.to, subject: 'Confirme seu cadastro no Vekar', text: `Confirme seu e-mail para iniciar seu cadastro: ${link}` }); } catch { /* Delivery is retriable and must not reveal registration state. */ }
    }
    return { message: REGISTRATION_NEUTRAL_MESSAGE };
  }
}
