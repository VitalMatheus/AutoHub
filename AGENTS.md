## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues. See `docs/agents/issue-tracker.md`.

### Triage labels

Use the five default Matt Pocock triage labels. See `docs/agents/triage-labels.md`.

### Domain docs

Use the single-context domain-document layout. See `docs/agents/domain.md`.

### Subagents

- When implementing code, decompose the work into concrete tasks and create one subagent for each task that can be performed independently.
- Give each subagent a focused scope, the relevant files and constraints, and a clear completion criterion.
- Keep shared sequencing, integration, conflict resolution, and the final decision in the main agent. Do not delegate dependent tasks before their prerequisites are complete.
- Ask subagents to report changed files, assumptions, checks run, and unresolved issues. Inspect their results before incorporating them.
- After all subagents finish, run the relevant checks for the integrated change and verify that the implementation satisfies the original request and repository instructions.

## Working agreement

### Before changing code

- Read the relevant existing modules, tests, `CONTEXT.md`, and applicable ADRs before designing a change.
- Follow established local patterns. Introduce a new pattern only when the task demonstrates a concrete need.
- Keep the change within the requested modules. Treat broad refactors as separate work.
- Read `docs/architecture/mvp-architecture.md` when changing architecture, tenancy, authentication, persistence, API contracts, or module boundaries.

### Architecture

- Keep the application a modular NestJS monolith.
- Use the direct flow Controller → Service → Prisma → PostgreSQL.
- Keep Controllers focused on HTTP concerns and delegation. Put business rules and transaction boundaries in Services or narrowly scoped domain helpers.
- Do not add repositories, CQRS, Event Sourcing, microservices, generic base services, or additional layers without a demonstrated requirement and an approved architectural decision.
- Keep each business capability in its own module. Prefer explicit dependencies and predictable file placement.
- The frontend communicates only with the REST API. It never connects directly to PostgreSQL or Prisma.

### Multi-tenancy and authorization

- Treat tenant isolation as a security boundary, not a UI feature.
- Every tenant-owned entity and operation is scoped by `organizationId` obtained from the authenticated server-side identity.
- Never trust `organizationId`, role, User identity, ownership, or authorization claims supplied by request bodies, query parameters, or arbitrary headers.
- Include `organizationId` explicitly in every Prisma read and mutation of tenant-owned data.
- Validate related records within the same Organization and preserve composite database constraints that prevent cross-tenant links.
- Return the contractually defined not-found response for resources outside the authenticated Organization; do not reveal their existence.
- `SUPER_ADMIN` uses platform endpoints and does not receive implicit access to operational tenant data.
- Add cross-tenant tests whenever a module reads, creates, updates, deletes, or links tenant-owned data.

### Database and financial data

- Access PostgreSQL through Prisma from the backend only.
- Make every structural database change through a reviewed Prisma migration. Never rely on manual production changes or `db push` as migration history.
- Preserve foreign keys, unique constraints, composite tenant constraints, indexes, and deletion behavior unless the task explicitly revises the underlying invariant.
- Use Prisma/PostgreSQL Decimal for money and decimal-safe arithmetic. Never use floating-point arithmetic for financial values.
- Preserve historical snapshots in QuoteItem and WorkOrderItem. Catalog price changes must not rewrite historical documents.
- Preserve WorkOrders and Payments. Represent lifecycle changes with status transitions instead of routine physical deletion.
- Place multi-record rules, counters, conversions, and payment balance checks inside database transactions.

### API and validation

- Version public endpoints under `/api/v1` and treat OpenAPI as a frontend-independent contract.
- Validate all external input with DTOs, `class-validator`, `class-transformer`, and the global ValidationPipe configured to whitelist and reject unexpected properties.
- Use explicit action endpoints for state transitions whose preconditions matter.
- Keep pagination, filtering, sorting, success bodies, and Problem Details errors consistent with the architecture document.
- Do not expose password hashes, token hashes, secrets, stack traces, Prisma errors, SQL details, or unnecessary personal data.
- Normalize e-mail, CPF/CNPJ, and vehicle plates before persistence according to the documented rules.

### Authentication and secrets

- Hash passwords with Argon2id and store only hashed refresh/action tokens.
- Preserve refresh-token rotation, session revocation, expiration checks, and active User/Organization checks.
- Keep secrets in validated environment variables. Commit placeholders only in `.env.example`; never commit real credentials or tokens.
- Apply stricter rate limits to authentication and activation endpoints. Preserve Helmet and environment-specific CORS allowlists.

### Tests and dependencies

- Add or update tests for every relevant behavior change. Important business rules require unit tests; persistence invariants require PostgreSQL integration tests; critical user/security flows require E2E tests.
- Use PostgreSQL, not SQLite, for integration and E2E behavior.
- Never remove, skip, weaken, or rewrite a valid test merely to make a change pass.
- Reproduce tenant isolation tests in more than one module; include both reads and mutations or cross-entity links.
- Add libraries only when the existing stack cannot meet a demonstrated need. Explain the need in the change.

### Change discipline

- Avoid unrelated formatting, renaming, dependency upgrades, and large refactors during a focused feature.
- Do not implement speculative abstractions or features outside the MVP roadmap.
- Keep generated artifacts and secrets out of source control.
- Before declaring completion, run the smallest relevant checks first, then the broader affected test suites; report anything that could not be run.
- Update OpenAPI, tests, domain vocabulary, and ADRs when the corresponding contract, term, or durable decision changes.
