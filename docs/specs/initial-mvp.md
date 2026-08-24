# Build the initial multi-tenant workshop-management SaaS MVP

## Problem Statement

The SaaS owner needs a secure, maintainable foundation for managing independent mechanical workshops. Each Organization must manage its own Users, Customers, Vehicles, catalog, Quotes, Work Orders, and Payments without ever reading or modifying another Organization’s operational data. The foundation must support the complete workshop flow while remaining small enough for one developer and AI coding agents to understand and evolve safely.

The repository currently contains the agreed architecture, domain glossary, and architectural decisions, but no application implementation. Without a concrete implementation spec, foundational choices such as tenant scoping, authentication, historical prices, state transitions, database constraints, HTTP behavior, and test coverage could be implemented inconsistently across modules.

## Solution

Build a modular NestJS monolith with a versioned REST interface, Prisma, and PostgreSQL. Implement the MVP incrementally from infrastructure and authentication through Organizations, Users, Customers, Vehicles, Service and Product catalogs, Quotes, Work Orders, and Payments.

Every operational request derives identity, role, and Organization from an authenticated server-side session. Services explicitly scope tenant-owned Prisma operations by `organizationId`, and composite database constraints prevent cross-Organization relationships. The highest acceptance-test seam is the `/api/v1` REST interface exercised against the complete NestJS application and a real PostgreSQL database.

## User Stories

1. As the SaaS operator, I want to bootstrap the first Super Admin securely, so that the platform can be initialized without committed credentials.
2. As a Super Admin, I want to log in with e-mail and password, so that I can administer the platform.
3. As a Super Admin, I want to create an Organization, so that a workshop can join the platform.
4. As a Super Admin, I want to view paginated Organizations, so that I can administer a growing customer base.
5. As a Super Admin, I want to update administrative Organization details, so that platform records remain current.
6. As a Super Admin, I want to deactivate and reactivate an Organization, so that access can be suspended without deleting history.
7. As a Super Admin, I want to create or invite an Organization Admin, so that a workshop can activate its own account.
8. As a Super Admin, I want to deactivate or reactivate a User, so that account access can be controlled.
9. As a Super Admin, I want to revoke a User’s sessions, so that compromised access can be stopped immediately.
10. As an Organization, I want Super Admins excluded from my operational data by default, so that platform administration does not weaken workshop privacy.
11. As an invited Organization Admin, I want to activate my account using a one-time token, so that no temporary password needs to be stored or shared.
12. As a User, I want a securely hashed password, so that a database disclosure does not expose my credential.
13. As a User, I want to log in with a globally unique e-mail and password, so that login is unambiguous.
14. As a User, I want short-lived access tokens and renewable sessions, so that usability does not require long-lived bearer access.
15. As a User, I want refresh-token rotation, so that reuse of old credentials is limited.
16. As a User, I want to use multiple devices, so that each device can maintain an independent session.
17. As a User, I want to log out of my current session, so that its refresh credential is revoked.
18. As an Organization Admin, I want to list Users in my Organization, so that I can administer workshop access.
19. As an Organization Admin, I want to invite another Organization Admin, so that workshop access is not limited to one person.
20. As an Organization Admin, I want to deactivate or reactivate Users in my Organization, so that staffing changes do not delete identity history.
21. As an Organization Admin, I want to be unable to create a Super Admin or move Users between Organizations, so that privilege escalation is impossible.
22. As an Organization Admin, I want to create a Customer, so that the workshop can record who receives service.
23. As an Organization Admin, I want to list, search, filter, and paginate Customers, so that records remain usable as data grows.
24. As an Organization Admin, I want to update a Customer, so that contact and administrative details remain accurate.
25. As an Organization Admin, I want duplicate Customer documents rejected within my Organization, so that the same person or business is not unintentionally duplicated.
26. As an Organization Admin, I want to deactivate a Customer with history, so that historical documents remain intact.
27. As an Organization Admin, I want to delete a Customer with no history, so that accidental unused records can be removed.
28. As an Organization Admin, I want to register a Vehicle for a Customer, so that workshop activity can be associated with the serviced asset.
29. As an Organization Admin, I want plates normalized and unique within my Organization, so that a Vehicle is not duplicated by formatting differences.
30. As an Organization Admin, I want to update Vehicle details and mileage, so that current operational information is available.
31. As an Organization Admin, I want to move a Vehicle to another Customer in the same Organization, so that ownership changes can be represented.
32. As an Organization Admin, I want previous Quotes and Work Orders to retain their historical Customer, so that a Vehicle transfer does not rewrite history.
33. As an Organization Admin, I want to view completed and delivered Work Orders for a Vehicle, so that its service history is available without duplicated history records.
34. As an Organization Admin, I want to create and maintain a Service catalog, so that common labor can be reused in Quotes and Work Orders.
35. As an Organization Admin, I want to activate and deactivate Services, so that obsolete offerings disappear from new work without changing history.
36. As an Organization Admin, I want to create and maintain a Product catalog, so that parts can be reused without implementing inventory control.
37. As an Organization Admin, I want Product SKUs unique within my Organization when supplied, so that catalog lookup is reliable.
38. As an Organization Admin, I want exact decimal catalog prices, so that financial calculations do not use floating-point arithmetic.
39. As an Organization Admin, I want to create a numbered Quote for a Customer and Vehicle, so that proposed work can be tracked.
40. As an Organization Admin, I want to add Service, Product, and manual Quote Items, so that a Quote can represent the actual proposed work.
41. As an Organization Admin, I want Quote Items to copy descriptions and prices, so that catalog changes do not alter an existing Quote.
42. As an Organization Admin, I want to edit items only while a Quote is in draft, so that submitted commercial terms remain stable.
43. As an Organization Admin, I want to submit, approve, reject, or cancel a Quote through valid transitions, so that its lifecycle is explicit.
44. As an Organization Admin, I want invalid Quote transitions rejected, so that contradictory states cannot be stored.
45. As an Organization Admin, I want to convert an approved Quote into one Work Order, so that accepted work can move into execution.
46. As an Organization Admin, I want duplicate conversion prevented under concurrent requests, so that one Quote cannot create multiple Work Orders.
47. As an Organization Admin, I want converted Work Order Items copied independently, so that execution changes do not rewrite the Quote.
48. As an Organization Admin, I want to create a Work Order without a Quote, so that walk-in or directly authorized work is supported.
49. As an Organization Admin, I want Work Orders numbered sequentially within my Organization, so that staff have a readable reference.
50. As an Organization Admin, I want to record the reported problem, diagnosis, mileage, expected completion date, and notes, so that execution context is captured.
51. As an Organization Admin, I want to add Service, Product, and manual Work Order Items with historical prices, so that actual work and charges are preserved.
52. As an Organization Admin, I want Work Order status changes validated, so that operational flow remains coherent.
53. As an Organization Admin, I want to represent open, waiting, in-progress, completed, delivered, and cancelled work, so that the MVP covers normal workshop operations.
54. As an Organization Admin, I want to record one or more Payments against a Work Order, so that partial and full receipts are represented.
55. As an Organization Admin, I want Payment methods and confirmation status recorded, so that basic financial history is useful without a gateway.
56. As an Organization Admin, I want confirmed Payments prevented from exceeding the Work Order total, so that concurrent requests cannot overpay it.
57. As an Organization Admin, I want a Payment cancelled rather than deleted, so that financial corrections remain visible.
58. As an Organization Admin, I want unpaid, partial, and paid state derived from confirmed Payments, so that duplicated financial state cannot drift.
59. As an Organization Admin, I want delivery state independent from payment state, so that credit arrangements do not require an accounts-receivable module.
60. As a User of Organization A, I want resources of Organization B to appear nonexistent, so that identifiers cannot reveal cross-Organization data.
61. As the SaaS operator, I want foreign keys and composite constraints to reject cross-Organization relationships, so that application mistakes cannot silently corrupt tenant isolation.
62. As an API consumer, I want versioned endpoints, consistent pagination, allowlisted filters, and stable errors, so that a frontend can integrate without reading backend code.
63. As an API consumer, I want OpenAPI to document authentication, DTOs, enums, money strings, pagination, and errors, so that an external frontend can be generated safely.
64. As a security maintainer, I want input whitelisting, Helmet, controlled CORS, rate limiting, and secret validation, so that common attack surfaces are addressed from the start.
65. As a developer, I want all structural database changes represented by Prisma migrations, so that environments remain reproducible.
66. As a developer, I want a PostgreSQL-only local Compose dependency, so that the NestJS development loop remains fast while matching production persistence behavior.
67. As a developer, I want structured errors without Prisma, SQL, stack, token, password, or secret leakage, so that clients receive useful failures safely.
68. As a developer, I want tenant-isolation tests across multiple modules, so that the central security invariant cannot regress unnoticed.
69. As an AI coding agent, I want explicit module and security rules, so that incremental implementation remains predictable and scoped.
70. As a solo maintainer, I want an incremental roadmap with completion criteria, so that the MVP can be delivered without turning into a full ERP.

## Implementation Decisions

- Build one modular NestJS application and one PostgreSQL database, following Controller → Service → Prisma → PostgreSQL.
- Use Node.js, TypeScript, NestJS, Prisma, PostgreSQL, REST, Swagger/OpenAPI, Docker Compose, `class-validator`, and `class-transformer`.
- Organize capabilities into Auth, Platform Organizations, Platform Users, Organization Users, Customers, Vehicles, Service Catalog, Products, Quotes, Work Orders, Payments, Common, Config, and Prisma modules.
- Keep Controllers limited to transport concerns; Services own business rules, contextual authorization, tenant scoping, and transaction boundaries.
- Do not introduce repositories or generic application/domain layers unless a later concrete requirement earns the seam.
- Use UUID primary identifiers. Give Quotes and Work Orders sequential per-Organization numbers using atomic Organization counters and composite uniqueness.
- Use a global User identity. E-mail is normalized, globally unique, and associated with at most one Organization. Super Admin has no Organization; Organization Admin must have one.
- The MVP contains only `SUPER_ADMIN` and `ADMIN` roles. Organization Admins may manage ADMIN Users only within their own Organization.
- Keep Super Admin administrative access separate under `/api/v1/platform/*`; it has no implicit access to operational Organization data.
- Bootstrap the first Super Admin through an idempotent command that receives credentials outside source control.
- Create invited Users as pending activation. Use hashed, expiring, one-use action tokens. Recovery uses the same token model later but is not initially exposed.
- Hash passwords with Argon2id. Enforce 12–128 characters and configure cost parameters through validated environment settings.
- Issue 15-minute access JWTs and 30-day refresh sessions. Store only refresh-token hashes, rotate on refresh, permit multiple Sessions, and support current/all-session revocation.
- Reload Session, User, and Organization for every protected request so suspension takes effect immediately.
- Obtain Organization and role from the authenticated principal only. Ignore client-supplied authorization claims.
- Explicitly include `organizationId` in every tenant-owned Service query and mutation. Use role Guards for coarse access and Service rules for contextual access.
- Return `404` for a missing or cross-Organization resource and `403` when the authenticated role lacks the requested platform capability.
- Use composite foreign keys and indexes led by `organizationId` to prevent cross-Organization relationships and support scoped queries.
- Normalize CPF/CNPJ to digits and plates to uppercase without separators. Organization document is globally unique when present; Customer document, Vehicle plate, and Product SKU are unique per Organization when present.
- Allow a Vehicle’s current Customer to change within its Organization. Quotes and Work Orders retain their historical Customer association.
- Derive Vehicle history from completed/delivered Work Orders; do not create a Vehicle History entity.
- Use Prisma Decimal backed by PostgreSQL `decimal(12,2)` for money. Expose monetary values as decimal strings and perform decimal-safe arithmetic.
- Represent Quote Item and Work Order Item with a SERVICE, PRODUCT, or MANUAL discriminator, optional catalog reference, and required description, quantity, and unit-price snapshots.
- Calculate totals from snapshots in one shared, narrow domain calculation. Do not persist a second mutable total source unless a measured query need later requires it.
- Permit Quote Item edits only in DRAFT. Use DRAFT → PENDING → APPROVED or REJECTED, with cancellation from DRAFT/PENDING. Final states are immutable.
- Convert only APPROVED Quotes and allow at most one Work Order per Quote. Copy items transactionally; later Quote and Work Order edits are independent.
- Use OPEN, WAITING_APPROVAL, IN_PROGRESS, WAITING_PARTS, COMPLETED, DELIVERED, and CANCELLED Work Order statuses with Service-enforced transitions.
- Support direct Work Order creation without a Quote.
- Support multiple partial Payments on any non-cancelled Work Order. Derive UNPAID/PARTIAL/PAID from confirmed amounts and keep operational delivery independent.
- Validate Payment balance in a transaction that prevents concurrent confirmed amounts from exceeding the Work Order total.
- Preserve financial and operational history. Cancel rather than delete Quotes after draft, Work Orders, and Payments. Deactivate records where historical links exist.
- Use restrictive deletion for historical roots and cascade only to aggregate items that are still legally deletable and to disposable Session/Action Token records.
- Prefix the REST interface with `/api/v1`. Use direct resource bodies, list responses shaped as `{ data, meta }`, page-based pagination, and allowlisted filters/sorts.
- Use explicit action endpoints for lifecycle transitions and Problem Details responses with stable application error codes.
- Apply a global ValidationPipe that transforms approved values, whitelists properties, and rejects unexpected input to prevent mass assignment.
- Configure Helmet, environment-specific CORS allowlists, sensitive-route rate limits, validated environment variables, structured logging, and production-safe exception mapping.
- Keep Swagger/OpenAPI detailed enough to serve as the sole frontend contract, including security schemes, examples, enums, errors, pagination, and decimal-string formats.
- Use PostgreSQL 17 in local Docker Compose while running NestJS locally. Apply Prisma migrations to real PostgreSQL in development, integration, E2E, and CI environments.
- Implement in phases: bootstrap/infrastructure; Prisma; authentication; Organizations/Users; Customers; Vehicles; catalogs; Quotes; Work Orders; Payments; security/E2E hardening; frontend contract stabilization.

## Testing Decisions

- The primary seam is the versioned REST interface. Acceptance tests call `/api/v1` through the complete NestJS application with a real PostgreSQL database and assert only observable HTTP behavior and persisted outcomes.
- Good tests describe externally meaningful rules: status, response body, visible state, allowed follow-up behavior, and absence of forbidden state. They do not assert private methods, Prisma call counts, internal class wiring, or incidental query shapes.
- Because the repository has no application code or tests yet, there is no existing test prior art. Establish one E2E harness and reuse it across modules instead of creating module-specific harnesses.
- Unit-test pure or narrowly scoped business rules for decimal totals, Quote transitions, Work Order transitions, payment state, deletion eligibility, token rotation, and Quote conversion preconditions.
- Integration-test Prisma against real PostgreSQL for composite tenancy constraints, nullable uniqueness, normalization persistence, deletion rules, atomic counters, unique Quote conversion, and concurrent Payment balance checks.
- E2E-test bootstrap, activation, login, refresh rotation, logout, revocation, Organization suspension, role separation, and the complete Customer-to-Payment flow.
- In Customers, prove that Organization A cannot read, update, or delete Organization B’s Customer and receives `404`.
- In Vehicles, prove that Organization A cannot create or update a Vehicle using Organization B’s Customer and that no row is created or changed.
- In Quotes and Work Orders, prove that cross-Organization Customer, Vehicle, Service, Product, Quote, and item identifiers cannot be linked.
- In Payments, prove that Organization A cannot read, create, or cancel Organization B’s Payment and that concurrent requests cannot exceed the balance.
- Assert `403` for Organization Admin access to platform endpoints and `404` for tenant-owned resource enumeration.
- Assert that deactivated Users and Organizations lose access on their next request even when an access token has not expired.
- Assert that historical Item descriptions and prices remain unchanged after catalog updates.
- Assert that moving a Vehicle to a different Customer does not rewrite old Quotes or Work Orders.
- Assert that Vehicle service history contains completed/delivered Work Orders and does not require a duplicated history table.
- Validate the generated OpenAPI document and smoke-test a generated or schema-driven client before declaring the frontend contract stable.
- A module is complete only when happy paths, input validation, authorization, tenant isolation, business-state rules, persistence constraints, and relevant failure responses are covered.

## Out of Scope

- Microservices, CQRS, Event Sourcing, full Clean Architecture, DDD layering, and speculative Repository Pattern abstractions.
- Multiple Organization memberships per User and workshop roles beyond ADMIN.
- Routine Super Admin access to operational Organization data or a support-impersonation mode.
- Advanced inventory, purchasing, suppliers, stock movement, minimum stock, or warehouse management.
- Fiscal-document issuance, tax engines, accounting, commissions, payroll, or a general ERP.
- Payment gateway integration, refunds, chargebacks, reconciliation, installments, or a complete accounts-receivable module.
- Automated password recovery in the first delivery; only the reusable one-time token foundation is included.
- Automated e-mail delivery until a provider and public activation URL are selected.
- WhatsApp, SMS, push notifications, mobile applications, and direct frontend database access.
- Redis, queues, asynchronous workers, distributed caching, and premature performance infrastructure.
- PostgreSQL Row-Level Security in the MVP.
- Persistent generic Audit Log until a concrete operational or regulatory requirement exists.
- Production container/deployment design until the target platform and secret-management mechanism are selected.
- Advanced fiscal validation or exhaustive Brazilian address modeling.
- Discounts, taxes, fees, and complex price formulas in the first MVP.

## Further Notes

- The domain glossary and accepted ADRs are authoritative. In particular, preserve the distinction between Super Admin and Organization Admin and keep explicit Service-level tenant scoping.
- The architecture document contains the reviewed preliminary Prisma model, endpoint inventory, error contract, Docker proposal, environment variables, and phased completion criteria. The implementation must review the relevant phase before producing each migration rather than treating the preliminary schema as immutable code.
- Before implementation begins, select the public activation URL, e-mail provider, final measured Argon2id parameters, production CORS origins, Swagger exposure policy, and deployment platform.
- The GitHub issue produced from this spec must receive only the `ready-for-agent` triage label.
