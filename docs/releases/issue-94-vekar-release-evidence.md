# Issue #94 — Vekar migration and release evidence

Status: prepared locally; production release approval remains external.

## Scope verified

- Public and application-facing copy changed to **Vekar** where it was still
  visible: HTML title, authenticated navigation, login, unavailable-module
  copy, Swagger metadata, API examples, README, and export filenames.
- The refresh cookie remains `autohub_refresh`. This is intentional: the name
  is a persisted browser credential identifier, not public product copy. The
  existing API path and cookie attributes remain unchanged, so old sessions do
  not require a forced logout.
- `REFRESH_COOKIE_DOMAIN` is optional and unset by default. It can be supplied
  only after an approved shared parent domain exists; local and single-host
  deployments remain host-only. `CORS_ORIGINS` already accepts an explicit
  comma-separated allowlist for old and new approved application origins.
- The Basic Plan is selected by the stable `Plan.code = BASIC`. The hardened
  compatibility migration uses the canonical legacy Plan UUID and fails closed
  when that identifier cannot be verified. It does not rename Plans, alter
  UUIDs, rewrite Contracted Prices, or touch historical commercial/operational
  rows.
- Legacy database, package, Docker, and pre-Vekar migration identifiers remain
  unchanged. They are storage/infrastructure compatibility identifiers, not
  release copy.

## Evidence and checks

The following checks are appropriate for this change and should be run in CI or
an environment with the required services:

| Check | Local result | Notes |
| --- | --- | --- |
| `npm run prisma:validate` | passed | Schema validated locally. |
| `npm run prisma:generate` | passed | Generated client is not committed. |
| `npm run typecheck` | passed | Backend compile check. |
| `npm run build` | passed | Backend production build. |
| `npm test -- --runInBand test/openapi.spec.ts` | passed | Checks Vekar Swagger metadata and API contract without PostgreSQL. |
| `npm test -- --runInBand src/auth/guards/jwt-auth.guard.spec.ts` | passed | Commercial restriction/security boundary. |
| `npm run test` | passed | 33 suites and 220 backend tests passed locally. |
| `npm run typecheck` in `frontend/` | passed | Frontend type check. |
| `npm run build` in `frontend/` | passed | Production frontend build; Vite reports only the existing chunk-size advisory. |
| `npm run test:e2e -- --runInBand test/e2e/auth.e2e-spec.ts test/e2e/bootstrap.e2e-spec.ts` | blocked | Requires PostgreSQL. |
| `npm run test` in `frontend/` | passed | 26 files and 165 tests passed locally. |

## Release gates not executable from this workspace

- PostgreSQL-backed migration, persistence, browser journey, and cross-
  Organization tenant-isolation E2E checks require PostgreSQL; Docker access is
  unavailable in this environment.
- Asaas sandbox checkout, webhook, retry, reversal, chargeback, and hostname/
  DNS cutover checks require approved external accounts, secrets, public URLs,
  and webhook configuration. No credentials or infrastructure changes were
  invented here.
- A real browser journey requires the repository's browser/CI environment;
  the available frontend tests cover UI states but do not replace a supported
  mobile/desktop browser run.
- Production hostname, legal copy, Resend sender/domain, and shared cookie
  domain still require business/operations approval. The repository retains
  local placeholders and does not claim those gates passed.

## Required external release evidence

Before production cutover, attach the CI run and operator evidence for:

1. applying migrations against a copy of the current database and confirming
   unchanged Organization, User, Plan, Subscription, Charge Settlement, and
   operational identifiers/counts;
2. login on the legacy hostname, migration to the approved hostname, refresh,
   logout, and expiry behavior without forced session invalidation;
3. landing-page CTA through e-mail confirmation and Trial Period activation;
4. cross-Organization read, mutation, export, and commercial-restriction
   denial; and
5. Asaas sandbox settlement, replay, retry, reversal, and chargeback outcomes.
