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
| MVP-T005 | Automated quality | PARTIAL | SQL tests pass and new React adapter tests exist; GitHub Actions TypeScript + Vitest + Vite build PASS; browser E2E pending |
| MVP-T006 | Operations and deployment | PARTIAL | 4 applied DB migrations; frontend build verified in CI; hosting and package-lock remain pending |
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
- `src/App.test.tsx`: React adapter-flow tests PASS in GitHub Actions quality run 39913500095; local npm registry DNS remains unavailable.

## Verification and risk notes

- Supabase reports 4 applied migrations in the dedicated project; public game tables have RLS; security advisor flags two intentional authenticated SECURITY DEFINER RPCs; no performance findings.
- All SQL fixtures roll back and leave no committed test governments/users. A separate cross-request committed synthetic-user test was blocked by connection safety controls. Do not bypass those controls or claim browser E2E success.
- Container: `node --test` 6/6 PASS; local `npm ping` EAI_AGAIN. Hosted GitHub Actions verified TypeScript, Vitest (7/7) and Vite production build on 2026-10-23. Lockfile generation, real browser E2E and accessibility screenshots remain unverified.
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
- Local dependency-free Node reference tests remain 6/6 PASS. local npm registry DNS is unresolved, but hosted GitHub Actions verified TypeScript, 7/7 Vitest cases and Vite production build; real browser E2E remains NOT EXECUTED. Missing package-lock and no authorized preview host remain active blockers.
- Next gate: obtain project-create access to a suitable isolated preview host (or connect an authorized account) and run reviewed build/tests, configure Supabase Auth redirect for that preview, exercise real browser session/decision/reload. No production deployment authorized.

## AOS-MVP-001 — Historical integrity improvement (2026-10-23)

- Identified defect: once a dossier expires, its RLS-protected option titles disappear from the catalog, so decision history previously degraded to opaque option identifiers.
- Migration `20261023064252_aos_005_historical_decision_titles.sql` applied to isolated Akumanomi Supabase project. Stores server-derived `dossier_title_snapshot` and `option_title_snapshot` in each immutable decision event, with backfill for existing events.
- SQL rollback regression tested the sequence decide → expire and rename dossier/option → re-read historical event: catalog stays hidden; event titles and economic effects remain unchanged; identical retry stays idempotent. SQL execution PASS.
- React now reads persisted event titles for the outcome and history, not the live catalog. Added a test for an expired dossier returning empty visible catalog; React tests PASS in hosted GitHub CI run 39913500095.
- Global MVP verified requirements remain 1/18; no real authentication-based browser E2E has yet occurred. AOS-MVP-001 remains PARTIAL.

## AOS-MVP-001 — First real GitHub CI diagnosis and fixes

- Pull request #1 triggered the GitHub Actions quality workflow; first run `39913296154` executed npm dependency installation and TypeScript successfully, proving those steps work in hosted CI.
- Vitest found three failures: Spanish `Intl.NumberFormat('es-ES')` did not group four-digit negative deltas by default; React Testing Library retained DOM nodes between tests, producing duplicate matches and misleading authorization-test results.
- Corrected number formatter with explicit `useGrouping: true`, added `src/lib/format.test.ts`, and added explicit `afterEach(cleanup)` to React suite plus a scoped duplicate-label assertion. Third workflow run 39913500095 PASSED all quality steps, including the production build; first run had skipped the build.

## AOS-MVP-001 — Verified GitHub CI and merged PR (2026-10-23)

- PR [#1](https://github.com/akumanomi1988/act-of-state/pull/1) merged via squash into `main` at `36ba475396bb550ab7c963302d22977ffead658c`.
- Successful hosted GitHub Actions run [39913500095](https://github.com/akumanomi1988/act-of-state/actions/runs/39913500095) on PR head `54f5c39b536cbc8296820a8c9e5b9ac646ef1d1c`: npm install PASS; deterministic Node oracle **6/6 PASS**; TypeScript **PASS**; Vitest **7/7 PASS** (3 test files); production Vite build **PASS**.
- The two preceding failed runs are retained as evidence of faults diagnosed and resolved. Formatting regression `-1.400` now passes; tests explicitly clean DOM between cases.
- Supabase migration `aos_005_historical_decision_titles` verified with the exact repository SQL test `supabase/tests/historical_decision.sql`; all assertions PASS in rolled-back isolated database transaction. Post-test state: zero governments, decisions and disposable users, 5 RLS-protected game tables, no anonymous decision RPC execution.
- Supabase security advisor retains 2 authenticated privileged RPC warnings with explicit owner validation. Performance advisor: no findings. See [advisor remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).
- Remaining release blockers: `package-lock.json` not committed, no authorized preview frontend hosting (connected Vercel team returned HTTP 403 for project creation), live Auth email redirect/browser E2E and responsive screenshot validation not executed. **AOS-MVP-001 remains PARTIAL; 1/18 globally accepted (MVP-T003).**

## AOS-MVP-001 — Reproducible frontend dependencies (2026-10-23)

- Discovered canonical `main` at `beba3cdbd3e61f54c709b6ea9eb38a040d229f2f`; dedicated Akumanomi Supabase project holds the same five migrations and 5 RLS-protected tables.
- Local `npm ping` failed `EAI_AGAIN`. An isolated same-repository PR workflow generated and committed `package-lock.json` using `npm install --package-lock-only --ignore-scripts`. The lockfile uses v3 and contains 225 package entries with 224 resolved integrity hashes.
- Removed the **temporary** privileged bootstrapping workflow before merging. Permanent GitHub Actions quality has `contents:read`, npm caching, PR concurrency cancellation, and reproducible `npm ci` instead of `npm install`.
- This validates dependency reproducibility, not real logged-in browser play. The browser login/decision/reload test and approved preview host still block full AOS-MVP-001 acceptance; global MVP verified remains 1/18 (T003); P01 percentage UNKNOWN.
