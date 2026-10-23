# ACT OF STATE — MVP Verification Tracker

**Canonical GitHub:** `akumanomi1988/act-of-state`; branch `main`.
**Iteration:** AOS-MVP-001. **Phase:** P01 foundation.
**Supabase:** Akumanomi / `akumaNoDev` / `Act-of-state` (`nwlxkqwbusrrldveijzb`, eu-central-1).

The user-approved MVP and constraints are recorded in AOS-MVP-001's execution contract. Classification is evidence-based: DONE = implemented and verified; PARTIAL = implemented or verified only at some boundary; TODO = absent; BLOCKED = explicit external dependency; UNKNOWN = no adequate evidence.

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| MVP-F001 | Persistent government session | PARTIAL | `start_government()` + rollback SQL recovery; live email session untested |
| MVP-F002 | Dossiers and options | PARTIAL | Versioned editorial seed, server UTC embargo and UI; user flow untested |
| MVP-F003 | Persistent validated decisions | PARTIAL | `submit_decision()`, unique logical key and SQL rollback assertions; committed browser path pending |
| MVP-F004 | Synthetic households/cohorts | PARTIAL | Two weighted cohorts, deterministic SQL results; broader MVP household model pending |
| MVP-F005 | National state | PARTIAL | Treasury/approval/trust in DB and UI; other political-social dimensions future |
| MVP-F006 | Daily/weekly calendar | PARTIAL | Server UTC game day & Monday publication constraint; Monday 10/Friday engine absent |
| MVP-F007 | Elections | TODO | No voting engine in repository |
| MVP-F008 | Async multiplayer | PARTIAL | RLS isolation SQL-tested; true concurrent multiuser play untested |
| MVP-T001 | Transactional persistence | PARTIAL | SQL atomicity/rollback tested; committed read-after-write not E2E verified |
| MVP-T002 | Auth, isolation | PARTIAL | Owned SECURITY DEFINER RPC, invoker snapshot RPC, RLS; email login untested |
| MVP-T003 | Deterministic versioned outcomes | DONE | SQL golden fixtures and 6/6 offline Node oracle pass |
| MVP-T004 | Safe retries, concurrency | PARTIAL | Row locks & unique index SQL-tested; parallel runtime not load-tested |
| MVP-T005 | Automated quality | PARTIAL | SQL tests pass and new React adapter tests exist; Vitest/build blocked by npm network |
| MVP-T006 | Operations and deployment | PARTIAL | 4 applied DB migrations; no frontend hosting/lockfile/build verification |
| MVP-V001 | Approved identity | PARTIAL | Provisional typography/UI palette; final official art assets not verified |
| MVP-V002 | Core dashboard and dossier | PARTIAL | React UI committed; browser render against real backend not verified |
| MVP-V003 | Responsive accessibility | PARTIAL | Layout, native controls, labels; audit unexecuted |
| MVP-V004 | Visual consistency QA | TODO | No screenshot acceptance available |

## Implemented evidence (AOS-MVP-001)

- `supabase/migrations/20261023050112_aos_001_foundation.sql`: database, RLS, simulated population, server-authoritative atomic decision.
- `supabase/migrations/20261023050305_aos_002_restrict_event_trigger_execute.sql`: remove anonymous invocation of preinstalled privileged event trigger.
- `supabase/migrations/20261023050408_aos_003_index_decision_dossier_fk.sql`: index FK.
- `supabase/migrations/20261023052739_aos_004_consistent_world_snapshot.sql`: one SQL-statement-consistent owned snapshot with SECURITY INVOKER.
- `supabase/tests/decision_flow.sql` and `supabase/tests/world_snapshot.sql`: SQL assertions executed in rollback on Akumanomi project, including owner isolation and persisted-within-transaction results.
- `tests/reference-simulation.test.mjs`: 6/6 locally executed with Node v22; deterministic oracle only, not runtime backend.
- `src/lib/game.ts`: browser data adapter uses one snapshot RPC instead of six independent Data API reads.
- `src/App.test.tsx`: React adapter-flow tests introduced but NOT YET EXECUTED due to npm registry DNS failure.

## Verification and risk notes

- Supabase reports 4 applied migrations in the dedicated project; public game tables have RLS; security advisor flags two intentional authenticated SECURITY DEFINER RPCs; no performance findings.
- All SQL fixtures roll back and leave no committed test governments/users. A separate cross-request committed synthetic-user test was blocked by connection safety controls. Do not bypass those controls or claim browser E2E success.
- Container: `node --test` 6/6 PASS; `npm ping` EAI_AGAIN and GitHub DNS resolution failed; therefore frontend build, Vitest, lockfile generation and real browser accessibility screenshots are unverified.
- No dedicated Vercel ACT OF STATE project is linked in the connected account. Deployment to production is not authorized.
- Current repository has no verified working local Git checkout; only GitHub remote branch SHA, tree, and write result are verifiable.

## Remaining critical gate for AOS-MVP-001

1. Install dependencies and commit `package-lock.json`; execute `npm run typecheck`, `npm test`, `npm run build`.
2. Configure Supabase Auth email-link allowed redirect origin for an authorized test/preview site.
3. Run true browser E2E: sign in, retrieve world, choose action, inspect result and history, reload, repeat request (idempotence), use another account (RLS).
4. Review final brand assets, responsive/keyboard QA and release criteria.

**Evidence-backed MVP completion:** 1/18 requirement fully accepted (MVP-T003). **P01 percentage:** UNKNOWN. **Iteration:** PARTIAL. Never convert backend assertions into a frontend E2E claim.

## AOS-MVP-001 — 2026-10-23 preview deployment attempt

- Attempted to provision an **isolated Vercel preview project** for ACT OF STATE under the currently connected Vercel team, with a Vite build, test/typecheck gates and only the dedicated Akumanomi Supabase project's public URL/publishable-key settings. The Vercel API refused project creation with HTTP **403 forbidden** (insufficient create permissions). No new project or deployment was created, and Anvil Fitness was not modified.
- The mapped Vercel CLI fallback is not installed in this execution environment, so the authorized preview operation cannot be completed here. Do not retry unchanged or present it as deployed.
- Local dependency-free Node reference tests remain 6/6 PASS. npm registry DNS is unresolved, so React/Vitest, TypeScript build and browser E2E remain NOT EXECUTED. Missing package-lock and no authorized preview host remain active blockers.
- Next gate: obtain project-create access to a suitable isolated preview host (or connect an authorized account) and run reviewed build/tests, configure Supabase Auth redirect for that preview, exercise real browser session/decision/reload. No production deployment authorized.

## AOS-MVP-001 — Historical integrity improvement (2026-10-23)

- Identified defect: once a dossier expires, its RLS-protected option titles disappear from the catalog, so decision history previously degraded to opaque option identifiers.
- Migration `20261023064252_aos_005_historical_decision_titles.sql` applied to isolated Akumanomi Supabase project. Stores server-derived `dossier_title_snapshot` and `option_title_snapshot` in each immutable decision event, with backfill for existing events.
- SQL rollback regression tested the sequence decide → expire and rename dossier/option → re-read historical event: catalog stays hidden; event titles and economic effects remain unchanged; identical retry stays idempotent. SQL execution PASS.
- React now reads persisted event titles for the outcome and history, not the live catalog. Added a test for an expired dossier returning empty visible catalog; React test execution remains pending unless CI runs successfully.
- Global MVP verified requirements remain 1/18; no real authentication-based browser E2E has yet occurred. AOS-MVP-001 remains PARTIAL.

## AOS-MVP-001 — First real GitHub CI diagnosis and fixes

- Pull request #1 triggered the GitHub Actions quality workflow; first run `39913296154` executed npm dependency installation and TypeScript successfully, proving those steps work in hosted CI.
- Vitest found three failures: Spanish `Intl.NumberFormat('es-ES')` did not group four-digit negative deltas by default; React Testing Library retained DOM nodes between tests, producing duplicate matches and misleading authorization-test results.
- Corrected number formatter with explicit `useGrouping: true`, added `src/lib/format.test.ts`, and added explicit `afterEach(cleanup)` to React suite plus a scoped duplicate-label assertion. A repeat of quality workflow is required before acceptance; first run had skipped the production build.
