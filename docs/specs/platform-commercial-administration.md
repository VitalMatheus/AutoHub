# Platform commercial administration MVP

## Goal

The Platform gives the Vekar Super Admin a small operational view of the SaaS business: how many workshops are registered, which ones require attention, and how much subscription revenue was received or remains due.

This specification deliberately narrows the commercial-administration surface. The richer persisted model may remain behind the application boundary, but the MVP exposes one workshop, one contracting account, one current subscription, one basic product, and at most one open monthly charge at a time.

## Product surface

The Super Admin interface has three areas, while customer acquisition remains on the separate public surface:

1. **Overview**: workshop and subscription-finance indicators plus a short attention list.
2. **Workshops**: search, assisted registration, status, commercial configuration, suspension, reactivation, cancellation, trial exceptions, and essential history.
3. **Monthly charges**: upcoming, overdue, blocked, and paid charges, with integral PIX or credit-card payment details and exceptional administrative settlement.

Commercial Accounts, Plans, Subscriptions, global Audit Events, and separate provisioning are not navigation concepts in this MVP. They may remain internal persistence concepts.

## Simple commercial model

- One Commercial Account corresponds to one Organization.
- One current Subscription covers that Organization.
- The Basic Plan is the only product offered through the MVP, at BRL 79.00 per month for one Organization and up to three Organization Admins.
- Existing Contracted Prices remain unchanged. New public registrations use the current published Basic Plan Version; a Super Admin may preserve or explicitly negotiate a different price only through assisted administration.
- A price change affects only a future monthly charge and never rewrites an issued charge.
- The billing day is restricted to days 1 through 28.
- Self-Service Registration requires Organization name, phone, CPF/CNPJ, Organization Admin name and e-mail, password, and versioned acceptance of Terms of Use and Privacy Policy. Address and other profile details are completed during onboarding.
- E-mail confirmation atomically activates the first Organization Admin and Organization and starts one 14-day Trial Period. No card or other payment method is required.
- Trial Eligibility is limited to one Trial Period per normalized CPF/CNPJ and e-mail. Manual exceptions require a Super Admin reason and Audit Event.
- The first billing day is derived when the customer explicitly contracts the Basic Plan. Self-Service Registration does not require Contracted Price, first due date, or billing day input.
- Existing Organizations without trustworthy commercial dates remain in Pending Commercial Setup. They accrue no retroactive debt and are not commercially blocked until regularized.

## Monthly charge lifecycle

The system creates the monthly Subscription Charge five calendar days before its due date. It never creates another charge while the current one remains open.

For a charge due on day 10, using `America/Recife` civil time:

- days 5 through 9: `DUE_SOON`;
- all of day 10: `CURRENT`, displayed as due today;
- days 11 through 15: `OVERDUE`, with operational access preserved;
- from 00:00 on day 16: `PAYMENT_BLOCKED`.

The five overdue days are complete calendar days. While payment-blocked, the Organization accrues no additional monthly charges. Paying the single open charge restores commercial access and preserves the contracted billing day for the next cycle. The blocked interval is not billed later.

Only integral settlement exists in the MVP. A charge is either open or fully paid; partial payment, instalments, stored credit, and multiple concurrent open charges are unsupported.

## Payment

- The Organization pays inside Vekar through Asaas by PIX or one-installment credit card.
- PIX uses a new customer-initiated charge each month. Card renewal is automatic only after explicit customer authorization; Vekar does not directly store card credentials.
- The backend marks a charge paid only after validating an authoritative gateway webhook. A browser redirect is not payment evidence.
- A pending gateway transaction is displayed as `PROCESSING`; it does not stop due dates or commercial blocking.
- Failed or expired attempts may be retried against the same charge.
- A confirmed charge is settled only for its full open amount.
- A gateway reversal or chargeback reopens the same charge and immediately recalculates commercial access.
- The Super Admin may exceptionally record full payment received outside the gateway, with method, received date, and required reason.
- Gateway and administrative settlements both count as received revenue, while retaining their origin and external identifier when applicable.
- Refund initiation is outside the MVP. Refunds and chargebacks performed at the gateway are reflected by webhook.

Asaas is the initial provider under ADR-0013. The integration seam remains narrow and provider-specific behavior does not leak into commercial rules.

## Access and cancellation

Organization operational status and Commercial Access Restriction remain independent, as established by ADR-0008.

- Commercial delinquency produces `PAYMENT_BLOCKED`; it does not change the Organization operational status to `SUSPENDED`.
- Payment removes only the commercial block. It never reverses an administrative suspension or deactivation.
- Trial Expiry and Payment Block preserve authenticated reads, CSV/PDF export, account security, access status, checkout, and payment confirmation, but reject tenant-owned operational mutations through an explicit policy.
- Administrative suspension remains independent and may deny broader access according to its reason and platform policy.
- Super Admin access is unaffected by a workshop commercial block.
- Paying the only open charge restores access immediately unless operational status independently prevents it.

An authorized Organization Admin may cancel inside the product; the Super Admin may also cancel administratively. Cancellation stops future monthly charges and full operational access ends after the already-paid period. Read and export access continue for the 90-day Data Retention Period. An existing open charge remains payable and is not forgiven. Recontracting preserves the Organization and its data but starts a new commercial period.

## Overview metrics

Every overview response uses one reference instant and `America/Recife`. Money is returned as decimal strings.

The overview presents:

- total registered Organizations;
- financially current Organizations;
- Organizations due soon;
- overdue Organizations still in tolerance;
- Organizations blocked for payment;
- administratively suspended Organizations;
- revenue received in the current month;
- open amount not yet overdue;
- overdue open amount;
- a short list of Organizations requiring attention.

Operational and financial axes may overlap and must not be presented as mutually exclusive partitions. For example, an Organization may be both administratively suspended and payment-blocked.

MRR history, churn, multi-account analytics, and long monthly series are outside the primary MVP screen.

## History and audit

The Organization detail shows an essential history of monthly-charge creation, payment, reversal, commercial block and restoration, administrative suspension and reactivation, and cancellation.

Security-relevant Audit Events remain append-only internally. The advanced global audit explorer is removed from MVP navigation. Tokens, hashes, secrets, unrestricted payloads, and unnecessary personal data never enter history metadata.

## Reconciliation

Reuse one idempotent reconciliation use case, executed daily by infrastructure cron and callable by a protected Super Admin recovery action. It:

- creates a charge five days before the due date;
- creates nothing when an open charge already exists;
- creates nothing for cancelled or Pending Commercial Setup records;
- creates no charge during a Trial Period or after Trial Expiry until the customer explicitly contracts;
- tolerates concurrent and repeated execution without duplication.

Do not run reconciliation as an application-startup side effect and do not add a queue or distributed scheduler.

## Security boundaries

- Super Admins do not gain access to Customers, Vehicles, Quotes, Work Orders, or operational Payments.
- Tenant-owned operations remain explicitly scoped by server-derived `organizationId`.
- Commercial blocking never deletes or mutates operational workshop data.
- Money uses Prisma/PostgreSQL Decimal and decimal strings at the API boundary.
- Gateway webhooks require authenticity validation, replay protection, and idempotent processing.
- Client-supplied Organization, actor, role, status, balance, or ownership claims are never trusted.
- Protected endpoints remain under `/api/v1`, use DTO validation, and document stable Problem Details responses in OpenAPI.

## Delivery strategy

Do not reset or force-push the main branch to the pre-platform commit. Existing migrations and valid records must be preserved.

Deliver the reduction incrementally:

1. constrain the existing commercial model to the simple invariants;
2. expose the three-area MVP over the existing persistence core;
3. adapt existing records without deleting Organizations, charges, settlements, or operational data;
4. remove advanced routes from the public contract and application composition;
5. remove internal code only after it has no consumers;
6. integrate Asaas behind the approved payment-provider boundary;
7. add Self-Service Registration, Trial Period, read-only restriction, and conversion without rewriting existing commercial agreements.

Every schema change uses a reviewed Prisma migration. Existing incompatible records are preserved and surfaced for manual regularization rather than guessed or deleted.

## Required tests

- Unit tests for exact Trial Period boundaries, eligibility, due-soon status, five full overdue days, read-only restriction, restoration, cancellation, and decimal metrics.
- PostgreSQL integration tests for one-open-charge enforcement, reconciliation idempotency and concurrency, full-settlement-only behavior, webhook replay protection, reversal, and atomic history.
- E2E tests for registration, e-mail confirmation, duplicate and expired activation, Trial Expiry, read/export access, mutation blocking, day-of-due access, days 1–5 overdue access, day-6 Payment Block, checkout allowlist, webhook restoration, administrative suspension preservation, cancellation, and Pending Commercial Setup.
- Cross-tenant tests for all Organization-owned reads and mutations.
- OpenAPI tests for the reduced contract, money strings, derived statuses, and stable errors.

## Out of scope

- Multiple workshop units per commercial account in the product surface.
- Multiple Plans, Plan management, upgrades, downgrades, and scheduled Plan changes.
- Recurring discounts, prorating, scheduled cancellation workflows, and repeated automatic trials.
- Partial payments, instalments, customer credit, advance payments, and multiple open monthly charges.
- Card credentials stored or processed directly by Vekar.
- WhatsApp, SMS, or push reminders; transactional e-mail reminders are included.
- Global audit explorer, extended historical series, accounting, fiscal documents, and taxes.
- Access by Super Admins to workshop operational records.
