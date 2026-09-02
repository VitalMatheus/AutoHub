# Build the platform commercial-administration backend

## Problem Statement

The AutoHub operator needs a Super Admin area for running the product as a SaaS business. The platform currently administers Organizations and their initial Organization Admins, but it does not represent the contracting customer, commercial Plans, Subscriptions, SaaS Charges, receipts, commercial access restrictions, platform metrics, or persistent administrative auditing.

The existing `Payment` belongs to a Work Order and represents money received by an Organization. It is not a SaaS billing record and must remain separate. The existing `Organization.active` flag also combines operational availability with no explanation of why access was removed. Commercial delinquency must not overwrite administrative suspension or destroy workshop data.

This specification defines the backend foundation needed by a later Super Admin frontend. It is authoritative together with the root glossary and ADRs 0001–0003 and 0006–0008.

## Outcomes

The completed backend lets a Super Admin:

- administer Organizations without duplicating existing endpoints;
- see each contracting customer, its units, Primary Contact, Plan, Subscription, next billing date, and effective access;
- manage Plan Versions without rewriting existing contracts;
- create, inspect, change, and cancel Subscriptions through explicit actions;
- issue and correct Subscription Charges and record immutable Settlements and reversals;
- identify upcoming, overdue, partially paid, paid, and cancelled Charges;
- view backend-calculated commercial and operational platform metrics and monthly series;
- query an immutable timeline of relevant administrative actions;
- reconcile recurring Charges idempotently without choosing a payment gateway.

Organization Admins receive only the safe commercial-access information needed to warn about an approaching block. All global commercial data and mutations remain exclusive to Super Admins.

## Domain Boundaries

### Commercial customer and operational units

- A Commercial Account is the contracting AutoHub customer.
- An Organization remains one independently isolated workshop unit and owner of its operational data.
- A Commercial Account may contain multiple Organizations. The Basic Plan limits it to one.
- A Subscription belongs to the Commercial Account rather than directly to one Organization.
- A Primary Contact is an active Organization Admin from any Organization in the same Commercial Account. It grants no additional role or permission.
- Transferring an Organization between Commercial Accounts is outside the MVP. There is no delete API for either entity.

### Plans and contracted conditions

- Plan identifies the commercial offering; Plan Version is an immutable published set of conditions.
- The initial published version is `AutoHub Básico`: BRL 79.00 monthly, one Organization, three non-disabled Users, and unlimited Work Orders.
- Known limits are typed. A null Work Order limit means unlimited. Additional feature identifiers are introduced only with real features.
- BRL and monthly are explicit persisted conditions even though they are the only accepted values in the MVP.
- Published Plan Versions cannot be edited or deleted. Plans can be archived, while historical Subscriptions continue resolving their contracted version.
- The only Plan available for new accounts cannot be archived.
- A Subscription snapshots price, currency, billing interval, limits, and payment-grace days from its Plan Version.
- A recurring fixed-value adjustment may change the Contracted Price, never below zero. It requires a reason, becomes effective at a future renewal, and is audited. One-off adjustments belong to a Charge and do not affect MRR.

### Subscription lifecycle

- A Commercial Account retains Subscription history and has at most one non-ended Subscription, enforced in PostgreSQL and in transactional Service rules.
- Persist lifecycle facts and dates rather than one overloaded business-status enum. A small stored lifecycle may distinguish `SCHEDULED`, `CURRENT`, and `ENDED`.
- Trial, Awaiting First Payment, delinquency, scheduled cancellation, and commercial access are derived conditions returned explicitly by the API.
- Plan changes and recurring price adjustments take effect on a future renewal. There is no prorating in the MVP.
- A downgrade can be scheduled while usage exceeds its limits but cannot take effect until usage complies. The system never removes Users or Organizations automatically.
- Cancellation at period end is the default. Immediate cancellation is an explicit alternative.
- Record when cancellation was requested and when it becomes effective. Churn occurs only on Effective Cancellation.
- A not-yet-effective cancellation can be undone. Recontracting after Effective Cancellation creates a new Subscription.
- Cancellation stops future recurring Charges but does not forgive already issued balances.
- A Trial Period is automatically available only on the Commercial Account's first Subscription. A later trial requires an audited Super Admin exception with a reason.

### Trial and first payment

- The default optional Trial Period lasts exactly 14 calendar days and begins when the first Organization Admin activates the account, not when the records are provisioned.
- A Super Admin may override the start date for migration or an explicit commercial agreement.
- The first Charge is issued on trial day 10 and is due at the end of trial day 14.
- Trial access remains available through all of day 14. At 00:00 on day 15 in `America/Recife`, access becomes blocked unless the first Charge is fully settled.
- Paying before trial ends preserves all 14 trial days. The first paid period starts on day 15.
- If full payment occurs after the block, the first paid period and monthly billing anchor start on the settlement date, so blocked days are not sold as paid access.
- After an unpaid trial, the Subscription is Awaiting First Payment. It is outside Trial, MRR, paid Subscription, and cancellation counts and is not automatically cancelled.
- A Subscription created without a trial begins blocked with its first Charge due. Its first paid period starts when that Charge is fully settled.

### Recurring Charges and payment grace

- Billing periods are monthly and retain their original anchor day. For anchors on days 29–31, a shorter month uses its last day and a later month resumes the original day when possible.
- A recurring Charge is created at the start of its period and due that day.
- The Contracted Payment Grace Period is five calendar days for renewals only. It does not apply to the first payment.
- For a renewal due on day 15, the Charge is overdue on day 16, access remains available through day 20, and `PAYMENT_BLOCKED` begins at 00:00 on day 21 in `America/Recife`.
- Delinquency begins as soon as an unpaid balance passes its due date. The grace period delays blocking, not delinquency.
- Access is restored only when every Charge beyond its grace period is fully settled. A partial payment does not unblock access.
- Correcting a due date recalculates delinquency and access immediately.

### Charges and Settlements

- Subscription Charge is the financial obligation. Charge Settlement is an immutable receipt, reversal, or compensating adjustment against it.
- A Charge records its Commercial Account, Subscription, amount, civil due date, nature, billing period when applicable, and optional neutral external-provider identifiers.
- Charge nature distinguishes first payment, renewal, adjustment, and extraordinary Charge. Only recurring Contracted Price contributes to MRR.
- Charge condition is derived from dates and net Settlements:
  - `PENDING`: no receipt, balance open, and not overdue;
  - `PARTIALLY_PAID`: a receipt exists, balance remains, and not overdue;
  - `PAID`: balance is zero;
  - `OVERDUE`: balance remains after the due date, including partially paid Charges;
  - `CANCELLED`: validly cancelled.
- Return paid and outstanding amounts as decimal strings. Never accept derived status or balance as mutation input.
- A Settlement cannot exceed the open Charge balance. Splitting one receipt across Charges requires an explicit Settlement for each Charge. There is no stored customer credit in the MVP.
- `receivedAt` may be in the past but never in the future. Backdating by more than seven days requires an explicit reason; creation time always preserves when the entry was recorded.
- A reversal is a negative Settlement linked to the original, with reason and effective date. Cumulative reversals cannot exceed the original receipt.
- A reversal can reopen delinquency and commercial blocking immediately.
- Before any Settlement, a Super Admin may change Charge amount or due date with a reason and before/after audit data.
- After a Settlement, amount is immutable. Due date may still be postponed with a reason and audit data.
- A Charge with no settled amount may be cancelled. Otherwise, its receipts must first be fully reversed. Charges and Settlements are never deleted.
- Persist optional provider-neutral external customer, Subscription, Charge, and Settlement identifiers. Provider plus external identifier is unique at its applicable boundary. No provider is selected now.

## Operational Status and Effective Access

- Organization operational status is `ACTIVE`, `INACTIVE`, or `SUSPENDED`.
- Valid explicit transitions are:
  - activate: `INACTIVE → ACTIVE`;
  - deactivate: `ACTIVE|SUSPENDED → INACTIVE`;
  - suspend: `ACTIVE → SUSPENDED`;
  - reactivate: `SUSPENDED → ACTIVE`.
- Repeating an already satisfied action is idempotent and does not append another Audit Event. An incompatible transition returns conflict.
- Suspension and deactivation require a reason and revoke all Organization Sessions. Activation and reactivation do not bypass a commercial block.
- Commercial Access Restriction is derived separately as `ACCESS_ALLOWED`, `PAYMENT_GRACE_PERIOD`, or `PAYMENT_BLOCKED`.
- Effective Access requires operational status `ACTIVE` and commercial access other than `PAYMENT_BLOCKED`.
- A commercial block applies to every Organization and Organization Admin covered by the Subscription but does not revoke Sessions. Paying can therefore restore access immediately.
- Authorization calculates the restriction from the current Subscription and indexed existence queries for blocking Charges. The daily reconciliation job is not the authority for access.
- Protected operational endpoints return `403` Problem Details with stable, distinct types for commercial block and operational suspension.
- An explicit allowlist remains usable during a commercial block: safe access status, logout, necessary refresh, and a future checkout endpoint. No broad path-prefix bypass is allowed.

## Organization Administration

- Reuse `/api/v1/platform/organizations`; do not create a duplicate Organization CRUD.
- Enrich list and detail responses with Commercial Account, Primary Contact, Plan, derived Subscription conditions, next billing date, and Effective Access.
- Support normalized search, allowlisted filters and sorts, and project-standard pagination.
- Add explicit `suspend` and `reactivate` actions while preserving create, list, detail, update, activate, and deactivate.
- The existing create operation becomes one transaction that provisions Commercial Account, Organization, initial Organization Admin/Primary Contact, Basic Subscription, optional Trial Period, activation token, and Audit Event.
- Defaults are the current Basic Plan Version and a 14-day trial. Inputs can select another published version, disable trial, and supply a recurring adjustment with reason.
- The activation token remains visible only in the immediate create or reissue response until e-mail delivery exists. It never appears in lists, details, logs, or audit metadata.
- A Basic Commercial Account accepts at most one non-inactive Organization and three non-disabled Users. Enforce limits transactionally under concurrent requests.
- Existing over-limit accounts are preserved, flagged, and prevented from adding more usage. No User or Organization is automatically disabled.
- If a Primary Contact becomes invalid, require an explicit replacement or expose a visible missing-contact administrative condition. Never select another User silently.

## API Capabilities

All global endpoints use the existing authenticated-principal resolution, `JwtAuthGuard`, and `SuperAdminGuard` under `/api/v1/platform`.

- `/organizations`: existing management enriched as described above.
- `/commercial-accounts`: list and inspect contracting customers and their units; edit safe commercial contact metadata.
- `/plans`: list/detail, create a draft Plan, publish a new immutable Plan Version, and archive eligible Plans.
- `/subscriptions`: list/detail, create or schedule, regularize migrated records, schedule Plan/price changes, request or undo cancellation, and cancel immediately.
- `/subscription-charges`: list/detail, create a manual recovery or extraordinary Charge, adjust allowed fields, cancel, add Settlement, and add reversal.
- `/audit-events`: read-only cursor-paginated timeline.
- `/dashboard`: one consistent commercial snapshot and requested monthly series.
- `/billing/reconcile`: idempotent Super Admin recovery action for recurring Charge generation.

Lifecycle operations use explicit action endpoints. Simple safe metadata may use PATCH. List endpoints use `{ data, meta }`, server-side pagination, allowlisted sorting, and combinable filters. OpenAPI documents response DTOs, derived enums, Problem Details, and money as decimal strings.

An authenticated Organization Admin can call `/api/v1/account/access-status`. It returns only commercial-access condition, next due date, block date, and remaining days plus a generic instruction. It excludes price, discounts, history, external identifiers, and information about other units. It remains accessible during a commercial block.

## Reconciliation

- Implement one idempotent reconciliation use case that creates missing first-payment and recurring Charges.
- A database constraint permits one recurring Charge per Subscription and billing period.
- Concurrent or repeated runs produce no duplicate Charges.
- Expose the use case through an internal command intended for a daily infrastructure cron and through the protected recovery endpoint.
- Do not execute reconciliation as an application-startup side effect and do not add a queue or distributed scheduler.
- System-created Charges use `SYSTEM` as the Audit Event actor. Detection of a derived overdue/block condition does not append repeated Audit Events.

## Dashboard and Metric Criteria

The dashboard accepts an optional `asOf`, uses one reference instant, states `America/Recife`, and returns money as decimal strings. Commercial and operational axes may overlap and must be named separately.

### Current snapshot

- Organization totals by operational status: total, active, inactive, and administratively suspended.
- Subscription totals by derived condition: Trial, paid/current, Awaiting First Payment, delinquent, effectively cancelled, and pending commercial setup.
- Commercially blocked Organizations are distinct from administratively suspended Organizations.
- New Organization: first operational activation occurred in the selected month.
- New customer account: first Subscription began in the selected month.
- Cancellation: Effective Cancellation occurred in the selected month.
- Operational deactivation is a separate metric and is not churn.
- MRR is the sum of monthly Contracted Price for Subscriptions whose paid period has begun and whose Effective Cancellation has not occurred at `asOf`.
- Trial, scheduled, Awaiting First Payment, and ended Subscriptions do not enter MRR.
- Delinquency, administrative suspension, and Organization inactivity do not remove a commercially current Subscription from MRR. Surface current Subscription with no active Organization as an inconsistency.
- Recurring adjustments affect MRR; one-off and extraordinary Charges do not. Future non-monthly intervals are normalized centrally when they exist.
- Received revenue uses cash basis: positive Settlements received in the month minus reversals effective in the month.
- Upcoming revenue is open balance not yet overdue. Overdue revenue is open balance past due. Total pending revenue is their sum. Cancelled Charges and settled amounts are excluded.

### Monthly series

- Return the previous 12 months by default and accept a bounded custom interval.
- Historical MRR and Organization quantity use the end-of-month civil snapshot in `America/Recife`.
- The current month uses `asOf`, not a forecast.
- Received revenue, new Organizations, new accounts, cancellations, and deactivations use effective events within each month.
- Reconstruct series from preserved dates, contract conditions, Charges, and Settlements. Do not introduce snapshot tables until measured performance requires them.

## Audit Events

- Audit Events are append-only, have no update/delete API, and are written in the same PostgreSQL transaction as the business mutation.
- Record actor User or `SYSTEM`, occurred-at timestamp, canonical action, target type/id, related Commercial Account/Organization where applicable, reason where required, and allowlisted before/after field values.
- Preserve minimal actor name/e-mail snapshots for historical readability. Exclude passwords, hashes, tokens, secrets, unrestricted request payloads, and unnecessary personal data.
- Audit Super Admin creation/editing/transitions for Organizations, Commercial Accounts, Plans, Subscriptions, Charges, and Settlements; initial invitation and invitation reissue; and relevant system reconciliation actions.
- User self-activation may be represented as a system/self-service event. Derived delinquency and access checks are facts, not repeated audit actions.
- Access is Super Admin only. Paginate the timeline by stable `occurredAt + id` cursor and support filters for period, actor, action, target type, and target.
- Retention is indefinite for the MVP.

## Existing-Data Migration

- Map existing `active=true` Organizations to `ACTIVE` and `active=false` to `INACTIVE` without changing current access.
- Create one Commercial Account for every existing Organization.
- Select the first active Organization Admin as Primary Contact when available; otherwise expose missing contact.
- Attach a Basic Subscription in `SCHEDULED` / Pending Commercial Setup condition.
- Do not grant an automatic trial, invent historical start dates, create retroactive debt, or include migrated accounts in MRR/delinquency before regularization.
- Preserve all existing Users. If usage exceeds Basic limits, mark the violation and prevent additions until regularized or moved to a compatible future Plan.
- Super Admin regularization supplies the commercial start and first Charge/payment facts explicitly.

## Security and Privacy

- Super Admins have no new access to Customers, Vehicles, Quotes, Work Orders, or operational Payments.
- Commercial metrics query platform-owned commercial records. Usage analytics against workshop data remain outside this delivery and require a later privacy/architecture decision.
- Never trust Organization, Commercial Account, role, actor, status, balance, or ownership claims supplied by clients.
- Use explicit Service authorization and scope, relational constraints, decimal-safe arithmetic, validated DTOs, and Problem Details consistent with the existing architecture.
- External identifiers are neutral optional integration seams, never authorization inputs.

## Testing and Completion Criteria

- Unit-test date boundaries, Trial conversion, month anchoring, grace period, derived conditions, access decisions, cancellation, MRR, cash revenue, pending revenue, and decimal Settlement/reversal arithmetic.
- PostgreSQL integration-test one-current-Subscription uniqueness, one-Charge-per-period idempotency, external-identifier uniqueness, transactional Plan limits, concurrent reconciliation, overpayment prevention, reversal limits, and atomic Audit Events.
- E2E-test every new Super Admin capability with `401` and Organization Admin `403` coverage, as well as happy paths and invalid transitions.
- E2E-test day 14 access, day 15 first-payment block, renewal days 1–5 grace, day 6 block, partial payment remaining blocked, full settlement restoration, and preservation of manual suspension.
- E2E-test enriched Organization search/filter/detail, first-account provisioning/activation, migrated-account regularization, cancellation, Charge correction, Settlement/reversal history, dashboard criteria, and audit filters.
- Prove that global commercial endpoints do not expose operational workshop records and that Organization Admin access status excludes commercial financial details.
- Validate the generated OpenAPI contract, including derived enums, decimal strings, action endpoints, filters, and stable Problem Details types.
- Run focused checks first, then Prisma validation, type checking, lint, affected unit/integration/E2E suites, OpenAPI tests, and the broader affected suite.

## Out of Scope

- Super Admin frontend or any other UI implementation.
- Payment gateway selection or integration, checkout, customer wallet/credit, invoices, boletos, receipts, fiscal documents, taxes, or accounting.
- E-mail, WhatsApp, SMS, push, or notification-delivery tracking. The backend exposes dates needed by a later notification system.
- Customer, Vehicle, Work Order, recent-activity, last-access, or engagement analytics. Last access and activity scoring require a later design and privacy decision.
- Roles beyond `SUPER_ADMIN` and `ADMIN`, including mechanic, attendant, financial, and read-only roles.
- Organization transfer between Commercial Accounts, self-service subscription management, support impersonation, and tenant-visible financial history.
- Queues, distributed workers, application-startup billing jobs, caching, or precomputed dashboard snapshots without measured need.
- Automatic deletion, debt forgiveness, User removal, or unit removal as a side effect of Plan, cancellation, delinquency, or migration.

## Delivery Guidance

Implement as tracer-bullet slices that leave the repository green and expose one verifiable capability at a time. Every structural change uses a reviewed Prisma migration. Reuse the existing Organization, authentication, authorization, pagination, Problem Details, OpenAPI, and PostgreSQL E2E patterns. Each slice updates the contract and tests for the behavior it introduces.
