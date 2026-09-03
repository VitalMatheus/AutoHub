# Platform commercial administration MVP

## Goal

The Platform gives the AutoHub Super Admin a small operational view of the SaaS business: how many workshops are registered, which ones require attention, and how much subscription revenue was received or remains due.

This specification deliberately narrows the commercial-administration surface. The richer persisted model may remain behind the application boundary, but the MVP exposes one workshop, one contracting account, one current subscription, one basic product, and at most one open monthly charge at a time.

## Product surface

The Super Admin interface has three areas:

1. **Overview**: workshop and subscription-finance indicators plus a short attention list.
2. **Workshops**: registration, search, status, commercial configuration, suspension, reactivation, cancellation, and essential history.
3. **Monthly charges**: upcoming, overdue, blocked, and paid charges, with integral PIX or credit-card payment details and exceptional administrative settlement.

Commercial Accounts, Plans, Subscriptions, global Audit Events, and separate provisioning are not navigation concepts in this MVP. They may remain internal persistence concepts.

## Simple commercial model

- One Commercial Account corresponds to one Organization.
- One current Subscription covers that Organization.
- AutoHub Básico is the only product offered through the MVP.
- The default Contracted Price is BRL 79.00 per month; the Super Admin may agree another price when registering an Organization.
- A price change affects only a future monthly charge and never rewrites an issued charge.
- The billing day is restricted to days 1 through 28.
- Registration requires Organization name and phone, Organization Admin name and e-mail, Contracted Price, and first due date. Document, address, and notes are optional.
- The first due date is explicit. There is no separate Trial Period: access before that date is simply the initial operating period.
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

- The Organization pays inside AutoHub by PIX or one-installment credit card through one selected gateway.
- A new manual payment is initiated each month; recurring card charging and stored cards are outside scope.
- The backend marks a charge paid only after validating an authoritative gateway webhook. A browser redirect is not payment evidence.
- A pending gateway transaction is displayed as `PROCESSING`; it does not stop due dates or commercial blocking.
- Failed or expired attempts may be retried against the same charge.
- A confirmed charge is settled only for its full open amount.
- A gateway reversal or chargeback reopens the same charge and immediately recalculates commercial access.
- The Super Admin may exceptionally record full payment received outside the gateway, with method, received date, and required reason.
- Gateway and administrative settlements both count as received revenue, while retaining their origin and external identifier when applicable.
- Refund initiation is outside the MVP. Refunds and chargebacks performed at the gateway are reflected by webhook.

Gateway selection is a separate researched delivery. Domain, API, and UI simplification may first use a test provider. The integration seam must remain narrow and provider-specific behavior must not leak into commercial rules.

## Access and cancellation

Organization operational status and Commercial Access Restriction remain independent, as established by ADR-0008.

- Commercial delinquency produces `PAYMENT_BLOCKED`; it does not change the Organization operational status to `SUSPENDED`.
- Payment removes only the commercial block. It never reverses an administrative suspension or deactivation.
- A blocked Organization retains its data but cannot use Customers, Vehicles, catalogs, Quotes, Work Orders, operational Payments, or settings.
- Login/session maintenance needed to reach the blocked screen, logout, access status, payment checkout, and payment confirmation remain available through an explicit allowlist.
- Super Admin access is unaffected by a workshop commercial block.
- Paying the only open charge restores access immediately unless operational status independently prevents it.

The Super Admin may cancel the commercial relationship. Cancellation stops future monthly charges and access ends after the already-paid period. An existing open charge remains payable and is not forgiven. Recontracting preserves the Organization and its data but starts a new commercial period.

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
6. research and integrate one Brazilian payment gateway.

Every schema change uses a reviewed Prisma migration. Existing incompatible records are preserved and surfaced for manual regularization rather than guessed or deleted.

## Required tests

- Unit tests for civil-date boundaries, due-soon status, five full overdue days, blocking, restoration, cancellation, and decimal metrics.
- PostgreSQL integration tests for one-open-charge enforcement, reconciliation idempotency and concurrency, full-settlement-only behavior, webhook replay protection, reversal, and atomic history.
- E2E tests for day-of-due access, days 1–5 overdue access, day-6 block, checkout allowlist, webhook restoration, administrative suspension preservation, cancellation, and Pending Commercial Setup.
- Cross-tenant tests for all Organization-owned reads and mutations.
- OpenAPI tests for the reduced contract, money strings, derived statuses, and stable errors.

## Out of scope

- Multiple workshop units per commercial account in the product surface.
- Multiple Plans, Plan management, upgrades, downgrades, and scheduled Plan changes.
- Trial lifecycle, recurring discounts, prorating, and scheduled cancellation workflows.
- Partial payments, instalments, customer credit, advance payments, and multiple open monthly charges.
- Automatic recurring card charging and stored payment credentials.
- Provider selection in the initial simplification delivery.
- E-mail, WhatsApp, SMS, or push reminders; due-soon is visual only.
- Global audit explorer, extended historical series, accounting, fiscal documents, and taxes.
- Access by Super Admins to workshop operational records.
