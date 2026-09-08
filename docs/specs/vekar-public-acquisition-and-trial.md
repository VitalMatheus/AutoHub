# Vekar public acquisition and trial

## Problem Statement

The current product presents AutoHub as an authenticated internal tool and requires a Super Admin to provision every workshop with price and billing dates. A curious workshop owner cannot discover the product through a public landing page, create an Organization, or try it without assisted sales. The AutoHub name also conflicts with an existing similar system, so continuing to market it creates brand confusion.

Workshop owners need a trustworthy Vekar entry point that explains concrete benefits, shows the price without surprises, permits independent registration, and provides enough time to evaluate the real product without a card. Vekar also needs a secure path from trial to paid use that preserves tenant isolation, existing customer agreements, and access to customer-owned records.

## Solution

Launch Vekar as the public brand with a responsive acquisition site, a dedicated Self-Service Registration flow, e-mail verification, and one full-featured 14-day Trial Period per CPF/CNPJ and e-mail. After the trial, the workshop can explicitly contract the Basic Plan for BRL 79.00 per month through Asaas using PIX or hosted credit-card checkout. Trial Expiry, Payment Block, and completed cancellation preserve authenticated read and export access while preventing operational mutations.

The change will be delivered without exposing Super Admin provisioning, trusting client-supplied authorization or commercial values, weakening Organization isolation, directly handling card credentials, or rewriting existing subscriptions and historical charges.

## User Stories

1. As a curious workshop owner, I want to understand what Vekar does from a public page, so that I can decide whether it fits my workshop.
2. As a workshop owner, I want benefits described in familiar language, so that I do not need to understand internal software terminology.
3. As a workshop owner, I want to see the Basic Plan price before registration, so that there is no surprise after the trial.
4. As a workshop owner, I want to know that the trial requires no card, so that I can evaluate Vekar without payment risk.
5. As a workshop owner, I want a clear primary trial CTA and a secondary login action, so that I can quickly choose the correct path.
6. As a mobile visitor, I want the public pages and registration form to work well on my phone, so that I can start without a computer.
7. As a visitor using assistive technology, I want semantic, keyboard-accessible pages and forms, so that I can evaluate and register for Vekar.
8. As a prospective customer, I want product visuals and claims to reflect actual capabilities, so that I can trust the offer.
9. As a prospective customer, I want answers about trial, price, cancellation, data, security, and support, so that I can resolve common concerns before registering.
10. As a workshop owner, I want to register using my workshop and responsible-person details, so that I do not depend on a Vekar operator.
11. As a self-employed mechanic, I want to identify the workshop with CPF, so that a CNPJ is not required to evaluate the product.
12. As a formal workshop owner, I want to identify the workshop with CNPJ, so that the contracting account reflects my business.
13. As a registrant, I want the short form to request only essential information, so that setup does not become a barrier.
14. As a registrant, I want to create my password during registration, so that activation requires only e-mail confirmation.
15. As a registrant, I want to review and accept the current Terms of Use and Privacy Policy, so that the agreement is explicit.
16. As a registrant, I want registration to request only operational and legal information, so that unnecessary marketing preferences do not add friction.
17. As a registrant, I want a neutral response after submission, so that account identifiers cannot be enumerated by attackers.
18. As a registrant affected by a retry or network failure, I want registration to be idempotent, so that duplicate workshops are not created.
19. As a legitimate user with an existing record, I want safe routes to resend confirmation, recover my password, log in, or contact support, so that duplicate protection does not lock me out.
20. As a registrant, I want to confirm my e-mail with an expiring one-use link, so that the activated account belongs to me.
21. As a workshop owner, I want the Trial Period to begin only after e-mail confirmation, so that an abandoned form does not consume trial time.
22. As a workshop owner, I want the exact trial end date and time communicated, so that I can evaluate Vekar without ambiguity.
23. As a trial user, I want all Basic Plan capabilities available for 14 days, so that the evaluation represents the paid product.
24. As a trial user, I want reminders before expiry, so that I can decide whether to subscribe without losing momentum.
25. As a first-time Organization Admin, I want the dashboard to show live operational metrics and recent activities, so that I can understand the workshop at a glance.
26. As a new customer, I want to begin with clean production data, so that fictional demonstration records do not contaminate my operation.
27. As an eligible workshop, I want one free trial, so that I can evaluate Vekar before paying.
28. As the Vekar operator, I want repeated trials limited by normalized CPF/CNPJ and e-mail, so that the acquisition offer is not routinely abused.
29. As a Super Admin, I want to grant a justified trial exception with an Audit Event, so that legitimate edge cases can be handled safely.
30. As an expired trial user, I want to read and export my records, so that Vekar does not withhold data I created.
31. As an expired trial user, I want a clear path to subscribe, so that I can restore operational access.
32. As an expired trial user, I want attempted mutations rejected consistently, so that I understand the commercial restriction.
33. As a subscribing workshop, I want to pay BRL 79.00 by PIX, so that I can use a familiar Brazilian payment method.
34. As a subscribing workshop, I want to pay by hosted credit-card checkout, so that I can authorize payment without giving card data directly to Vekar.
35. As a card customer, I want automatic monthly renewal only after explicit authorization, so that recurring charging is consensual.
36. As a PIX customer, I want a new monthly payment request and reminders, so that I can renew without stored payment credentials.
37. As a paying customer, I want access enabled only after authoritative payment confirmation, so that billing state remains correct under redirects and retries.
38. As a customer whose payment failed or expired, I want to retry against the same open charge, so that duplicate debt is not created.
39. As a customer affected by reversal or chargeback, I want the original transaction and correction preserved, so that the commercial history remains explainable.
40. As an existing Vekar customer, I want my current price, Subscription, charges, and history preserved, so that the public launch does not rewrite my agreement.
41. As a Basic Plan customer, I want one Organization, up to three Organization Admins, and unrestricted ordinary records, so that core workshop use is predictable.
42. As a customer, I want price changes represented by new Plan Versions, so that future offers do not silently change my current agreement.
43. As an overdue customer, I want five complete days of tolerance, so that a short payment delay does not immediately interrupt work.
44. As a payment-blocked customer, I want read, export, security, support, and payment access, so that I can regularize without losing control of my records.
45. As a payment-blocked customer, I want full operation restored after settlement, so that support intervention is normally unnecessary.
46. As an authorized Organization Admin, I want to cancel inside Vekar, so that cancellation does not require a sales negotiation.
47. As a cancelling customer, I want normal access through the paid period, so that I receive the service already purchased.
48. As a former customer, I want 90 days to read and export my records, so that I can complete an orderly exit.
49. As a former customer, I want advance notice before eligible data is deleted or anonymized, so that deletion is not surprising.
50. As a data subject, I want retention and trial-eligibility evidence limited and reviewed, so that anti-abuse controls do not justify unnecessary personal-data storage.
51. As a user who forgot a password, I want a safe recovery flow, so that I can regain access without Super Admin assistance.
52. As a user, I want transactional messages for activation, security, trial, and billing, so that important account events reach me.
53. As a prospect or customer, I want e-mail and WhatsApp support during stated hours, so that I can reach a person when self-service is insufficient.
54. As the Vekar operator, I want acquisition and conversion events measured without personal or operational payloads, so that the funnel can improve without leaking sensitive data.
55. As the Vekar operator, I want registration and authentication protected from automation and brute force, so that the public surface is safe to operate.
56. As one Organization, I want every signup-created tenant isolated from every other Organization, so that public registration does not weaken confidentiality.
57. As a Super Admin, I want the existing assisted-provisioning and administration surface preserved, so that exceptional commercial cases remain manageable.
58. As the product owner, I want public branding changed independently from risky internal identifiers, so that Vekar can launch without unnecessary data migrations or session breakage.
59. As the product owner, I want brand and domain availability validated before irreversible migration, so that the replacement name does not create another conflict.
60. As the product owner, I want the launch delivered in independently verifiable phases, so that acquisition, trial, and billing risks can be controlled.

## Implementation Decisions

### Positioning and language

The public brand is **Vekar**. Public copy uses plain Brazilian Portuguese and speaks to the workshop owner as “você”; internal terms such as Organization, Commercial Account, Subscription, and tenant never appear as navigation or marketing language.

Primary message: **“Sua oficina organizada do orçamento ao pagamento.”**

Supporting message: **“Controle clientes, veículos, serviços, estoque e financeiro em um só lugar. Teste grátis por 14 dias, sem cartão.”**

The primary CTA is **“Teste grátis por 14 dias”**. “Entrar” is secondary. Price disclosure near acquisition CTAs reads **“14 dias grátis. Depois, R$ 79/mês.”**, together with “sem cartão”, “sem taxa de implantação”, “sem fidelidade”, and “cancele quando quiser”. Claims, testimonials, customer logos, and performance figures must be demonstrably true and authorized; the initial page invents none.

### Public routes

- `/`: landing page;
- `/teste-gratis`: Self-Service Registration;
- `/confirmar-email`: confirmation status and safe resend path;
- `/login`: existing authentication entry;
- `/recuperar-senha`: password recovery;
- `/precos`: Basic Plan details and future plan comparison surface;
- `/termos`: versioned Terms of Use;
- `/privacidade`: versioned Privacy Policy;
- `/contato`: e-mail and WhatsApp contact options.

Unknown unauthenticated routes go to the public landing or a public not-found page, not directly to login. `/platform/*` remains internal and is never promoted to workshop customers.

### Landing-page structure

1. Header with Vekar, benefits, price, FAQ, login, and primary CTA.
2. Hero with the primary promise, price disclosure, and a truthful product visual.
3. Concrete workshop problems: scattered records, lost quotes, uncertain stock, and unclear finances.
4. Current capabilities: customers and vehicles, quotes, work orders, products and stock, purchases and suppliers, direct sales, payments, finance, and reports.
5. Product screenshots or illustrations based on the real interface.
6. Three-step explanation: register, organize the workshop, and operate with visibility.
7. One Basic Plan card.
8. FAQ covering browser access, trial, payment, cancellation, data access, security, and support.
9. Final CTA and legal footer.

The visual direction is a sober modern wordmark, deep blue-green or green as the primary color, restrained orange for calls to action, light backgrounds, strong contrast, and mobile-first responsive layouts. Photography must be licensed; fabricated customer imagery must not imply endorsement.

### Self-Service Registration

The short public form collects:

- workshop name;
- normalized CPF or CNPJ;
- phone;
- responsible person's name;
- normalized e-mail;
- password;
- required acceptance of the current Terms of Use and Privacy Policy;
- no promotional consent field during registration.

Address and nonessential profile fields move to post-activation onboarding. The public request never accepts role, Organization identity, price, Plan identity, trial dates, billing day, or authorization claims.

The backend uses a dedicated public endpoint and DTO; the protected Super Admin provisioning endpoint is not exposed or reused as a public contract. Submission is idempotent and returns a neutral response that does not reveal whether an e-mail or document already exists.

E-mail confirmation uses an expiring, single-use token stored only as a hash. Successful confirmation atomically activates the first Organization Admin and Organization and starts the Trial Period. Abandoned unconfirmed registrations expire and do not start trials. Safe recovery paths offer login, password recovery, confirmation resend, or support without disclosing the conflicting identifier.

### Trial and eligibility

- The Trial Period lasts exactly 14 elapsed days from e-mail confirmation.
- It includes every current Basic Plan capability and requires no card or payment method.
- Trial Eligibility is limited to one use per normalized CPF/CNPJ and one per normalized e-mail.
- A Super Admin may grant an exception only with a required reason and Audit Event.
- Confirmation communicates the exact trial end instant.
- Transactional reminders are sent with seven, three, and one day remaining and at expiry; the application displays a restrained status banner.

At Trial Expiry, authentication, reads, CSV/PDF exports, account security, support, and subscription checkout remain available. Tenant-owned operational mutations are rejected consistently with a stable Problem Details code. Data is not deleted.

### Basic Plan and conversion

The initial Basic Plan costs BRL 79.00 monthly, covers one Organization and up to three Organization Admins, and includes all current capabilities without artificial limits on customers, vehicles, Quotes, or Work Orders. Fair-use safeguards address exceptional abuse. Future Plan Versions may vary units, users, automations, advanced reports, and integrations without withholding basic operational records.

Subscription begins only after explicit customer action. Asaas provides PIX and hosted one-installment credit-card checkout. PIX is customer-initiated monthly; card renewal occurs automatically only after explicit authorization. Vekar does not directly collect or store card credentials. Browser redirects are not payment evidence; authenticated, replay-protected, idempotently processed webhooks and server-side verification control settlement and access restoration.

The billing day derives from successful contracting. Existing Organizations preserve their current Subscription, Contracted Price, charges, settlements, and history unless changed through an explicit commercial operation.

### Delinquency, cancellation, and retention

Existing due-soon and five-complete-day Overdue Tolerance rules remain. Payment Block then permits the same read, export, account, support, and payment surface as Trial Expiry while rejecting operational mutations. Full settlement restores access unless Organization operational status independently prevents it. No additional monthly charge accrues while one charge remains open.

An authorized Organization Admin can cancel inside the product with recent-password and e-mail confirmation; the Super Admin retains an administrative cancellation path. Full access continues through the paid period, followed by read-only access and a 90-day Data Retention Period. Export is presented before deletion. Eligible data is then deleted or anonymized, sessions and tokens are revoked, and legally required records follow a separately validated retention schedule. Legal and accounting review is a launch dependency for retention and fiscal-document obligations.

The deletion design must retain only the minimum evidence needed to enforce Trial Eligibility, using a purpose-specific pseudonymous record rather than an active User or Organization record. Its legal basis, retention period, access controls, and response to data-subject requests require privacy review before release.

### First-use dashboard

After activation, the dashboard shows live counts for active Customers and Vehicles and non-cancelled Quotes and Work Orders. It also lists the latest customer, vehicle, Quote, and Work Order activity with links to the corresponding records. Quick actions open the creation forms for the first Customer, Vehicle, Quote, and Work Order.

Production records are not prefilled with fictional data. A future interactive demonstration must be clearly identified and removable.

### Communication and support

Resend is the initial transactional e-mail provider behind a narrow internal boundary. It sends confirmation, password recovery, trial reminders, security messages, and billing notices. Development can capture messages without sending them externally. Promotional communication is not collected during registration and requires a future, separate consent flow.

Public support offers e-mail and WhatsApp during stated business hours. WhatsApp opens a prepared conversation and does not replace Self-Service Registration. Product guidance points to a small help surface as content becomes available.

### Security and privacy

- Preserve explicit server-derived Organization scoping for every tenant-owned operation.
- Rate-limit registration, confirmation, resend, login, recovery, and checkout attempts.
- Apply Cloudflare Turnstile after suspicious behavior or repeated attempts.
- Normalize and validate CPF/CNPJ and e-mail before uniqueness and eligibility checks.
- Store Consent Records with policy version, actor, instant, and request context; do not place unrestricted personal payloads in Audit Events.
- Never send passwords, action tokens, payment credentials, or operational content to analytics or logs.
- Keep activation and recovery responses neutral against account enumeration.
- Test cross-tenant reads, mutations, links, export, and commercial restriction behavior.

### Analytics, SEO, and accessibility

Measure landing view, CTA click, registration start/completion, e-mail confirmation, first meaningful product action, trial expiry, and subscription conversion using pseudonymous identifiers. Nonessential trackers load only under the applicable consent policy. Analytics never receive CPF/CNPJ, e-mail, tokens, or workshop records.

The public surface is indexable, fast, accessible, and responsive. Initial search intent includes “sistema para oficina mecânica”, “ordem de serviço para oficina”, and “controle financeiro para oficina”. Prefer a few useful pages over generated keyword pages. Keyboard navigation, visible focus, semantic headings, labeled inputs, useful errors, reduced-motion support, and adequate color contrast are release requirements.

### Brand migration

Vekar remains provisional until an INPI similarity search, relevant-class review, desired-domain registration, and social-handle check are complete. After validation:

1. replace public text, metadata, e-mail identity, and product documentation;
2. identify the default Plan by stable ID or code rather than its display name, then rename it;
3. preserve database IDs and all commercial and operational history;
4. migrate cookie and public-domain identifiers with a compatibility window;
5. update Swagger, environment examples, CI, local hostnames, packages, and infrastructure in coordinated steps;
6. avoid table or field renames that are cosmetic and add migration risk.

### Delivery sequence

1. **Brand foundation:** validate name/domain, establish visual identity, and publish reviewed legal content.
2. **Landing page:** public routes, responsive content, pricing, SEO, analytics, and CTAs.
3. **Self-service:** public API, form, consent, e-mail confirmation, password recovery, idempotency, and abuse controls.
4. **Trial and access:** exact dates, reminders, dashboard metrics, recent activities, read-only restriction, and export.
5. **Conversion:** Basic Plan, Asaas sandbox integration, PIX, hosted card checkout, webhooks, renewal, delinquency, and cancellation.

Each delivery updates OpenAPI, tests, glossary, relevant ADRs, and public copy. No phase weakens the existing Super Admin separation or tenant boundary.

## Testing Decisions

The principal acceptance seam is the versioned `/api/v1` REST interface exercised through the complete NestJS application against real PostgreSQL. Tests assert observable HTTP responses, persisted outcomes, access behavior, and idempotency rather than private methods, Prisma call counts, component internals, or incidental query shapes. This extends the repository's existing E2E approach for authentication, Organizations, subscriptions, charges, and cross-tenant isolation.

The public frontend is the second necessary seam because acquisition quality depends on routing, accessible form behavior, responsive presentation, and integration with the API. React tests cover user-visible states and actions; they do not assert internal hook or component structure. A small browser E2E flow should cover landing CTA through activated trial and the restricted-to-paid transition.

The Asaas webhook boundary is tested through the public webhook contract plus persisted commercial outcomes. Provider payload fixtures may drive authenticated replay, but assertions remain on deduplication, settlement, reversal, access, and safe errors rather than adapter internals.

Testing includes:

- unit tests for exact 14-day boundaries, Trial Eligibility, commercial-access derivation, reminder timing, Plan Version limits, and normalization;
- PostgreSQL integration tests for atomic signup activation, normalized uniqueness, eligibility persistence, Consent Records, concurrent activation, idempotency, one-open-charge enforcement, webhook replay, and retention transitions;
- backend E2E tests for registration, neutral duplicate responses, confirmation, expiry, resend, password recovery, tenant isolation, trial access, Trial Expiry, read/export allowlists, mutation denial, checkout, settlement, Payment Block, restoration, cancellation, and existing-contract preservation;
- frontend tests for public routing, CTA destinations, form validation, confirmation states, login/recovery links, dashboard metrics and quick actions, trial banners, pricing disclosure, read-only presentation, checkout states, keyboard operation, and error recovery;
- OpenAPI assertions for every new public, commercial, export, and webhook contract, including Problem Details responses and the absence of client-controlled tenant, role, price, Plan, or trial fields;
- Asaas sandbox E2E checks for PIX, hosted card checkout, authoritative webhook confirmation, expired attempts, retries, reversal, chargeback, and duplicate delivery;
- security tests for rate limits, Turnstile enforcement after suspicious activity, one-use hashed tokens, account-enumeration resistance, log/analytics redaction, and cross-Organization export denial;
- migration and regression tests proving existing Organizations retain identifiers, users, Contracted Prices, Subscription history, charges, settlements, and operational data.

Prior art includes the existing authentication activation and session tests, Organization provisioning E2E tests, subscription condition tests, subscription-charge reconciliation tests, OpenAPI contract tests, and cross-tenant suites across operational modules.

### Release criteria

- Brand and domain have completed business approval after formal availability checks.
- Public routes and registration work on supported mobile and desktop browsers.
- E-mail confirmation, resend, password recovery, abandoned registration, and duplicate identifiers are tested.
- Trial start, exact expiry, reminders, mutation blocking, reads, and exports are tested.
- Asaas PIX and card flows, idempotent webhooks, retries, reversals, and chargebacks pass sandbox tests.
- Terms of Use and Privacy Policy are published and Consent Records are auditable.
- Cross-tenant E2E tests cover registration-created tenants and restricted access.
- Backups, monitoring, support ownership, and incident paths are defined.
- The acquisition and conversion funnel is measurable without personal or operational data leakage.
- Existing customer agreements and historical records remain unchanged.

## Out of Scope

- Multiple Organizations per Commercial Account in the initial product surface.
- Additional Plans, annual billing, upgrades, downgrades, prorating, discounts, or coupons.
- Direct storage or processing of card credentials by Vekar.
- Invented social proof, automated WhatsApp marketing, mobile applications, or fiscal-document implementation before accounting validation.
- Broad internal renames or database migrations performed solely for visual consistency.

## Further Notes

- The public brand remains provisional until an INPI similarity search, relevant-class review, domain registration, and social-handle review are completed by the business.
- Legal and accounting review is required before release for Terms of Use, Privacy Policy, Consent Record retention, deletion/anonymization, Trial Eligibility evidence, and fiscal-document obligations.
- Resend and Asaas require production accounts, secrets, public URLs, webhook configuration, and operational ownership; only placeholders belong in source control.
- The established ADRs for global User identity, explicit Organization scoping, separate commercial accounts, separate settlements, independent operational/commercial status, one open monthly charge, verified self-service trial, Asaas, and read-only commercial restrictions remain authoritative.
- The implementation should be split into the five delivery phases above and decomposed into independent tasks before code changes begin.
