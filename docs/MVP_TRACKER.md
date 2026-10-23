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
| MVP-T006 | Operations and deployment | PARTIAL | 5 applied DB migrations; reproducible `npm ci` and frontend build verified in CI; preview hosting pending |
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

- Supabase reports 5 applied migrations in the dedicated project; public game tables have RLS; security advisor flags two intentional authenticated SECURITY DEFINER RPCs; no performance findings.
- All SQL fixtures roll back and leave no committed test governments/users. A separate cross-request committed synthetic-user test was blocked by connection safety controls. Do not bypass those controls or claim browser E2E success.
- Container: `node --test` 6/6 PASS; local `npm ping` EAI_AGAIN. Hosted GitHub Actions verified `npm ci`, TypeScript, Vitest (7/7) and Vite production build on 2026-10-23. Real browser E2E and accessibility screenshots remain unverified.
- No dedicated Vercel ACT OF STATE project is linked in the connected account. Deployment to production is not authorized.
- Current repository has no verified working local Git checkout; only GitHub remote branch SHA, tree, and write result are verifiable.

## Remaining critical gate for AOS-MVP-001

1. Reuse the committed `package-lock.json` and green GitHub Actions gates (`npm ci`, oracle, TypeScript, Vitest, Vite build); repeat on subsequent code changes.
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

## AOS-MVP-001 — Verified dependency lock milestone

On 2026-10-23, [PR #2](https://github.com/akumanomi1988/act-of-state/pull/2) generated an npm v3 lockfile and switched GitHub Actions to `npm ci`, with dependency caching, cancellation of superseded PR checks, and read-only repository permissions. The [final reviewed PR build](https://github.com/akumanomi1988/act-of-state/actions/runs/39915400041) passed npm clean install, 6 deterministic reference tests, TypeScript, 7 Vitest cases, and the Vite production build. The temporary privileged bootstrap workflow was removed prior to merge.

This validates a reproducible browser bundle, **not** a real authenticated game session. A preview host, Supabase redirect configuration, browser sign-in, persisted decision readback after reload, accessibility checks and visual design acceptance remain open.

## AOS-MVP-001 — Archived outcome navigation (2026-10-23)

- Reconciled the five applied Akumanomi migrations and committed npm lockfile against stale earlier tracker entries. Re-ran `supabase/tests/decision_flow.sql`, `world_snapshot.sql` and `historical_decision.sql` in rollback transactions: all returned without SQL errors. Post-test readback: 0 governments, 0 cohorts, 0 decision events and 0 synthetic users; 1 fictional dossier and 3 options preserved.
- Frontend improvement merged via [PR #3](https://github.com/akumanomi1988/act-of-state/pull/3) at `12df1745acb99f10de3010b5427ef515bfd8bf14`: the history list reopens the full **persisted** decision outcome (treasury, approval, trust and cohort response) even after dossier expiry, using `decision_events` snapshots without client-side recomputation or extra database writes. The [PR quality run 39928315351](https://github.com/akumanomi1988/act-of-state/actions/runs/39928315351) passed clean `npm ci`, 6/6 Node oracle, TypeScript, 7/7 Vitest cases and Vite build; its React regression covers review and back navigation.
- This enhancement does not satisfy the remaining real authenticated browser E2E gate or final visual acceptance. AOS-MVP-001 stays **PARTIAL**; globally accepted requirements remain **1/18** until those gates are verified.

## AOS-MVP-001 — Decision transport reconciliation (2026-10-23)

- [PR #4](https://github.com/akumanomi1988/act-of-state/pull/4), merged as `084bb7f49b137c1c757d45fb6d922315f841dbdd`, closes the user-visible lost-response gap: after a decision RPC, the app rereads the server-authoritative world even if the RPC reported a transport error. A persisted decision is displayed from its durable event, not from a guessed client result. If readback itself fails, submission controls remain locked behind an explicit **Retry synchronization** action.
- [PR #5](https://github.com/akumanomi1988/act-of-state/pull/5), merged as `f655815230672fb18877da3fd5605bd6aaa00bb0`, keeps that reconciliation barrier even when the first snapshot shows no event after an ambiguous RPC failure, because a server-side commit may still arrive later. It requires a successful fresh read before another submission attempt.
- [PR #4 CI](https://github.com/akumanomi1988/act-of-state/actions/runs/39932440031): 6/6 Node simulation oracle, 10/10 Vitest, TypeScript and Vite build PASS. [PR #5 CI](https://github.com/akumanomi1988/act-of-state/actions/runs/39932591319): 6/6 Node oracle, 11/11 Vitest, TypeScript and Vite build PASS. New UI tests cover committed-but-response-lost, readback failure/recovery, ambiguous no-event response, and explicit rejection. Nonfatal Node deprecation warnings remain.
- Akumanomi Supabase project `nwlxkqwbusrrldveijzb` remains `ACTIVE_HEALTHY` with five applied migrations and RLS on five public tables. This iteration made **no** database writes or migrations; latest inspection found 0 governments, 0 cohorts and 0 decision events, with one fictional dossier and three options. The SQL rollback suites passed in the preceding 2026-10-23 increment; they were **not rerun** for these frontend-only changes.
- Requirement evidence improved for **MVP-F003, MVP-T004, MVP-T005 and MVP-V002**, but none newly accepted in full. **MVP-T003 remains the sole fully accepted requirement (1/18).** Real email-OTP browser E2E, two-account ownership isolation at the UI, responsive/keyboard/visual QA, a usable isolated preview host and recovery of final approved visual assets remain open. AOS-MVP-001 stays **PARTIAL**; P01 accepted-percentage remains **UNKNOWN**.

## AOS-MVP-001 — Account-switch state isolation (2026-10-23)

- Confirmed a client-side confidentiality defect: on an Auth account switch, a failed new-government bootstrap could leave the previous account's in-memory world rendered after loading ended. A prior decision's asynchronous readback could also overwrite the new account's state.
- Fixed via [PR #6](https://github.com/akumanomi1988/act-of-state/pull/6), squash-merged as `89c9905aa136deb8267917e2bba929710b67fc21`: government views are gated by the current authenticated user ID and stored government owner ID; boot clears stale state, validates ownership and offers an explicit retry; late initial getUser responses and previous-account decision readbacks cannot resurrect obsolete session state.
- [GitHub Actions run 39938040611](https://github.com/akumanomi1988/act-of-state/actions/runs/39938040611): reproducible npm install, Node deterministic oracle **6/6 PASS**, TypeScript **PASS**, Vitest **13/13 PASS** across three files, and Vite production build **PASS**. Two new React tests exercise account switch followed by bootstrap failure/retry and an old decision readback arriving after another account signs in. Non-blocking Node/Actions deprecation warnings remain.
- This is frontend mock-adapter security verification, **not** a real second-user Supabase email-OTP browser E2E. Database policies, migrations and project data were unchanged; previously passed SQL transaction suites were not rerun. Strengthens evidence for **MVP-T002, MVP-T005, MVP-F001 and MVP-V002**, without promoting any of these to DONE. **MVP-T003 remains 1/18 fully accepted**, P01 percentage **UNKNOWN**, iteration **PARTIAL**. Preview hosting/real Auth E2E/final visual QA remain the top acceptance blockers.

## AOS-MVP-001 — Cumulative decision and budget atomicity verification (2026-10-23)

- Extended `supabase/tests/decision_flow.sql` with rollback-only editorial options for a second dossier. A costlier choice is rejected as `INSUFFICIENT_TREASURY` with unchanged treasury, approval, trust, cohort rows and event count. A subsequent affordable choice compounds the first event deterministically: **10,300 M€ treasury, 72% approval and 64% trust**, cohort support/trust **78/67** and **60/58**. Repeating the second decision returns the same event and the owned world snapshot contains both events.
- Executed the expanded SQL integration suite against dedicated Akumanomi Supabase project `nwlxkqwbusrrldveijzb` inside `BEGIN`/`ROLLBACK`: **PASS** (no SQL errors). Independent post-run counts: **0** governments, cohorts, decision events and test users; the original one fictional dossier and three editorial options remain. No migration, schema, production or durable game-data changes.
- Mirrored chained effects and insufficient-funds purity in the independent Node specification oracle. [PR #7](https://github.com/akumanomi1988/act-of-state/pull/7) merged as `c6fb8b44c96b0e2c124eece7f8607d46193327e5`; [GitHub Actions 39948459183](https://github.com/akumanomi1988/act-of-state/actions/runs/39948459183) passed reproducible install, **8/8 Node oracle**, **13/13 Vitest**, TypeScript and Vite build. Nonfatal Node/Actions deprecations remain.
- Stronger evidence for **MVP-F003, MVP-F004, MVP-F005, MVP-T001, MVP-T003, MVP-T004 and MVP-T005**; no new full requirement acceptance. The server's authored decision core is still **not verified in a real browser/authenticated cross-request E2E**. Overall accepted requirements **1/18**, phase P01 percentage **UNKNOWN**, iteration **PARTIAL**. Preview project creation permission and final visual QA remain open.
