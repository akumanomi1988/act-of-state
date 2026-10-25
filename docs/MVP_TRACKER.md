# ACT OF STATE — MVP Verification Tracker

**Canonical GitHub:** `akumanomi1988/act-of-state`; branch `main`.
**Latest implementation increment:** AOS-045 real GoTrue/PostgREST CI acceptance epic (validation pending).
**Strict product acceptance:** 2/18 fully accepted requirements (11.1%);
this is an acceptance-gate tally, not a measure of implemented code or effort.
Historical iteration evidence below is retained and may describe superseded blockers.

## AOS-045 — Real signed Auth and legislature acceptance (2026-10-25)

- Implemented a wholly **disposable, unlinked** local Supabase GoTrue/PostgREST acceptance pipeline with genuine signed JWTs. Eleven auto-confirmed test-only local accounts exercise ten concurrent match admissions, rejection of outsiders, immutable stances, ten parliamentary ballots, a signed national decision, identical retry and conflicting retry rejection, cross-account snapshot consistency and RLS.
- Two independent real-auth Chromium sessions assert government-versus-opposition controls, ten visible seats, signed policies, reload, responsive and WCAG. Unlike the previous mock network suite, these browser sessions communicate with genuine local Auth and PostgREST. External SMTP and real participant sessions remain untested.
- **CI acceptance pending** on dedicated [real-auth workflow](.github/workflows/live-auth-acceptance.yml), documentation [REAL_AUTH_ACCEPTANCE.md](REAL_AUTH_ACCEPTANCE.md). No Supabase production SQL changes or credential management changes.
- The original 2/18 strict acceptance tally is **not raised** until the real-protocol workflow and the full independently defined acceptance gates are verified. Local auth E2E is not a production user sign-off.

## AOS-044 — Multiplayer legislative command and reconciliation (2026-10-25)

- A single server-ledger command board highlights the weekly deadline ahead of the permanent ten-case founding agenda. Cabinet/opposition roles are shown independently of recorded stances, with filters for party-relevant pending work and nationally signed decisions.
- Government signatures require exact-option reconciliation against persisted decisions, including after a lost HTTP acknowledgement. Ambiguity locks further signing until an explicit fresh snapshot, with the originating dossier preserved across navigation. A conflicting event never becomes a successful local notice.
- Immutable decisions cannot disappear from screen due to an older 15-second polling response. Parliament bill proposals, vote receipts and final tallies are independently revalidated against official RPC reads even if mutation transport fails.
- The technical E2E suite simulates ten seat identities and separate government/opposition Chromium browser sessions on mocked HTTP; original SQL integration remains the security/concurrency authority. Neither replaces a real human-authenticated ten-account playtest.
- **Verified:** [PR #37](https://github.com/akumanomi1988/act-of-state/pull/37) squash-merged at `ef3b6cb745790f80871268dcf3c6202ec575b30f`. [Quality CI #40206808283](https://github.com/akumanomi1988/act-of-state/actions/runs/40206808283) PASS: Node oracle **14/14**, **168/168 Vitest** over 36 suites, TypeScript, production build, **15 Chromium scenarios**, 2 guest-mode viewports, axe WCAG and screenshots. The new browser scenario uses two independent synthetic sessions and a ten-party roster; it does not prove live email Auth or real human multiplayer. Existing 10-party PostgreSQL security integration was not changed or rerun by this no-SQL PR. No migrations or privilege changes.
- **Strict acceptance remains 2/18 (11.1%)** unless new verifiable evidence completes a previously partial gate. This score is not the implementation completion percentage.

## AOS-043 — Full official founding government programme (2026-10-25)

- Added eight original fictional political dossiers with 24 authored choices. Together with the two existing ones this makes **ten permanent intro dossiers, 30 options** in the actual authenticated, PostgreSQL-backed game (not the non-authoritative `/demo`).
- Reused the protected versioned server decision engine: all options produce immutable, player-owned government consequences. Preserved treasury safety, idempotency, cohort responses and historical titles.
- Introduced the official programme progress bar, immutable before/after event-derived treasury/approval/trust contributions, weekly-deadline prioritization, five agenda filters and a continuation action. Updated onboarding and manual.
- Added rollback integration suite covering the complete ten-decision worst-cost combination (8,860 M€), duplicate replay, rival-account RLS denial and 10/30 catalogue in the authoritative world snapshot. Extended React and Chromium browser regressions.
- **Verified regression:** [PostgreSQL CI #40204049283](https://github.com/akumanomi1988/act-of-state/actions/runs/40204049283) PASS (38 existing + founding migration, rollback integration including ten real-engine decisions, permissions, cross-connection persistence and concurrency); [quality CI #40204049325](https://github.com/akumanomi1988/act-of-state/actions/runs/40204049325) PASS (**153/153 Vitest**, oracle, TypeScript, Vite build, 14 browser flows plus guest tests, responsive 390/1440px, WCAG 2.1 A/AA).
- **Verified Cloud data:** dedicated Supabase ACT OF STATE project `nwlxkqwbusrrldveijzb` migration `20261025145152_aos_043_foundational_campaign` applied successfully. Post-migration readback: **10 intro dossiers**, **30 intro options**, **8 new dossier IDs**. Migration file version is identical to remote history. No other project modified.
- **Published:** [PR #36](https://github.com/akumanomi1988/act-of-state/pull/36) squash-merged to `main` at `ff08ab11bb6b05fc50f4607caaf8fc049d61edf6`. GitHub reported **Vercel: success** for this exact merge commit ([deployment details](https://vercel.com/nexttapstudios/act-of-state/FdUbeDznyrdYffGkeicHak5ncvVR)). This does not prove that public HTTP navigation, a real email session or a real ten-player browser game worked; those remain unverified.
- **Still unverified:** production UI smoke against live Auth, real multi-browser participant sessions, an editor-reviewed live weekly publication, balancing and human design acceptance. Never count a successful commit as real human E2E evidence.
- The strict 18-gate tally remains **2/18 (11.1%)** until external acceptance is independently verified. This is *not* an implementation-weighted completion percentage.

## AOS-042 — Guest training sandbox (2026-10-25)

- Adds a standalone publicly reachable `/demo` with four fictitious dossiers,
  twelve authored choices, explicit review/sign, bounded deterministic teaching
  outcomes, a historical ledger, local progress recovery and two-step reset.
- The guest mode is **not** the PostgreSQL simulation and makes no Supabase calls.
  No session, email, user identity or real government data is read or modified.
  Invalid local state is discarded rather than trusted.
- Adds Vitest engine/UI coverage and mobile/desktop Chromium browser QA to the
  opt-in quality workflow, including WCAG checks and assertions forbidding backend
  requests from guest play. See `docs/GUEST_DEMO.md`.
- **Verified:** [PR #35](https://github.com/akumanomi1988/act-of-state/pull/35) squash-merged into `main` at `42355905b23ba3f517bbe9569055e84d2bdd0a1a`. [Quality CI run 40202300839](https://github.com/akumanomi1988/act-of-state/actions/runs/40202300839) passed clean install, Node oracle, TypeScript, **147 Vitest tests**, production Vite build, **13 existing Chromium scenarios**, **2 guest Chromium widths (390/1440px)**, WCAG 2.1 A/AA scan, no Supabase request, review/sign, reload/reset and screenshot uploads. GitHub's Vercel status on the merge commit reported **success**; live public HTTP and real-user login remain unverified.
- The original acceptance tally remains **2/18 (11.1%)**, with **+0 percentage
  points** until real authenticated gameplay and other outstanding gate evidence
  are obtained. This guest acquisition feature lies outside the original
  18 requirement acceptance checklist. CI results must be verified on the PR.

## AOS-040 — Daily living conditions and social consequences (2026-10-24)

- Added resident-weighted daily economic security, service access and wellbeing
  for 300 persistent households. Income, age and settlement drive heterogeneous
  responses to existing macroeconomic indicators and fiscal policy.
- Versioned social inertia changes each cohort's support/trust by at most one
  point per actual UTC day, using the existing household propagation exactly
  once. Treasury, debt, GDP, inflation and unemployment are not settled twice.
- Immutable daily acts retain source inputs, cohort before/after state,
  national summaries and nine income/district segments. Missing days remain
  explicit; no past household conditions are fabricated.
- Solo/member-only 7/30/90-day history RPC and shared responsive UI add social
  feedback, income/territory comparisons, source factors, loading/error/retry
  states and account-switch protection.
- Existing calendar integration plus a private one-minute, 200-country batch
  worker; inactive lobbies do not evolve. Errors isolate a country, roll back
  its partial effects, retry after backoff and retain private diagnostics.
- Migration `20261024201821_aos_040_daily_living_conditions.sql` applied to the
  dedicated Supabase project. Cloud rollback suite PASS; synthetic users left:
  **0**. Observed first automatic act: **1**; failed countries: **0**. Cron job
  `aos-daily-social-v1` confirmed active. These observations are not a sustained
  production or load test.
- Verification: TypeScript and production build PASS; Node oracle **14/14**;
  Vitest **130/130** across 30 files; all **38** production migrations and
  **21** SQL suites passed in disposable embedded PostgreSQL. Hosted PostgreSQL
  concurrency and final browser/release evidence belong to the delivery PR.
- Security advisors retain the established private-table/no-policy pattern and
  intentional member-checked SECURITY DEFINER read RPC warning; no anonymous
  read/write/worker grant added. Existing leaked-password-protection warning
  is unchanged. See the remediation links and model limits in the operator guide.
- MVP-F004/F005/F006/F007/F008 remain PARTIAL pending balancing and actual-player
  acceptance. **Strict global acceptance before/after remains 2/18 = 11.1%,
  +0 percentage points**. This tally does not imply only 11.1% of code exists;
  a reliable weighted implementation percentage has not been defined.
- Next epic: close real onboarding and a complete authenticated multiplayer
  week with reviewed real-news dossiers and real-user feedback. It addresses
  the acceptance gates that additional isolated gameplay panels cannot close.
**Supabase:** Akumanomi / `akumaNoDev` / `Act-of-state` (`nwlxkqwbusrrldveijzb`, eu-central-1).

The user-approved MVP and constraints are recorded in AOS-MVP-001's execution contract. Classification is evidence-based: DONE = implemented and verified; PARTIAL = implemented or verified only at some boundary; TODO = absent; BLOCKED = explicit external dependency; UNKNOWN = no adequate evidence.

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| MVP-F001 | Persistent government session | PARTIAL | `start_government()` + rollback SQL recovery; live email session untested |
| MVP-F002 | Dossiers and options | PARTIAL | Two fictional intro dossiers, weekly release and editorial workbench with secure draft/publish RPCs; actual news and authenticated live workflow untested |
| MVP-F003 | Persistent validated decisions | PARTIAL | `submit_decision()`, unique logical key and SQL rollback assertions; committed browser path pending |
| MVP-F004 | Synthetic households/cohorts | PARTIAL | Two weighted cohorts, deterministic SQL results; broader MVP household model pending |
| MVP-F005 | National state | PARTIAL | Treasury/approval/trust plus AOS-027 versioned budget, debt, GDP index, simulated unemployment/inflation and sector-driven household response. Full macroeconomic calibration and real-user acceptance pending |
| MVP-F006 | Daily/weekly calendar | PARTIAL | AOS-023 adds scheduled settlement of expired ballots, due elections and immutable Friday acts, with member-only shared calendar readout; real-news editorial operation and authenticated live cycle remain untested |
| MVP-F007 | Elections | PARTIAL | AOS-021 adds deterministic cohort forecast, 100-seat D'Hondt elections, manifesto freeze, immutable acts, incumbent transition and seat-weighted Parliament; server-driven certification added in AOS-023; AOS-025 adds cabinet handover through constructive confidence; real-user E2E and richer political systems pending |
| MVP-F008 | Async multiplayer | PARTIAL | Ten-party shared-nation RPCs/UI; binding parliament AOS-019 and seat-weighted mandates AOS-021; synthetic ten-party electoral tests and concurrency CI cover server contracts; AOS-025 adds voluntary coalitions and weighted constructive confidence; ten real browser accounts untested |
| MVP-T001 | Transactional persistence | DONE | AOS-027: committed decision survives a separate database connection; persisted snapshot, retry idempotence, second-user isolation and synthetic-user cleanup verified in disposable CI and dedicated Supabase Cloud. Browser Auth itself is tracked separately under MVP-F001/T002 |
| MVP-T002 | Auth, isolation | PARTIAL | Owned SECURITY DEFINER RPC, invoker snapshot RPC, RLS; email login untested |
| MVP-T003 | Deterministic versioned outcomes | DONE | SQL golden fixtures and 6/6 offline Node oracle pass |
| MVP-T004 | Safe retries, concurrency | PARTIAL | Decision row locks/unique key, editorial CAS, match-capacity row locks, idempotent join/start/stance and immutable approved content; parallel runtime not load-tested |
| MVP-T005 | Automated quality | PARTIAL | Disposable PostgreSQL regression, committed cross-connection smoke, Node/Vitest/TypeScript/build; AOS-027 adds headless Chromium/axe mobile, mocked Auth/error, national decision and fiscal policy browser tests. Hosted real-Auth E2E remains pending |
| MVP-T006 | Operations and deployment | PARTIAL | Reproducible DB/quality CI and Vercel deployment; AOS-023 adds database-native scheduled jobs and failure diagnostics; long-running production and live-session checks pending |
| MVP-V001 | Approved identity | PARTIAL | Provisional typography/UI palette; final official art assets not verified |
| MVP-V002 | Core dashboard and dossier | PARTIAL | Government dashboard, dossiers, Parliament, elections, governance and AOS-027 national fiscal panel; browser HTTP simulation verified, live authenticated end-to-end render pending |
| MVP-V003 | Responsive accessibility | PARTIAL | AOS-027 adds Chromium 375/390/1440px overflow and axe WCAG2A/AA/2.1 checks plus screenshot artifacts. Manual keyboard/screen reader and real authenticated UX acceptance pending |
| MVP-V004 | Visual consistency QA | PARTIAL | AOS-027 captures mobile/desktop government, login and multiplayer screenshots as retained CI artifacts; human visual approval remains pending |

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

- Supabase reports 6 applied migrations in the dedicated project; public game tables have RLS; security advisor flags two intentional authenticated SECURITY DEFINER RPCs; no performance findings.
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
- Re-ran the existing `supabase/tests/world_snapshot.sql` and `supabase/tests/historical_decision.sql` in separate rollback transactions after PR #7: both **PASS** without SQL errors. These cover owned snapshot isolation and immutable history after editorial expiry. They do not replace real Auth/browser E2E.
- Stronger evidence for **MVP-F003, MVP-F004, MVP-F005, MVP-T001, MVP-T003, MVP-T004 and MVP-T005**; no new full requirement acceptance. The server's authored decision core is still **not verified in a real browser/authenticated cross-request E2E**. Overall accepted requirements **1/18**, phase P01 percentage **UNKNOWN**, iteration **PARTIAL**. Preview project creation permission and final visual QA remain open.

## AOS-MVP-001 — Explicit ministerial decision review (2026-10-23)

- [PR #8](https://github.com/akumanomi1988/act-of-state/pull/8) introduces a two-step political signature in `src/App.tsx`: select an option → review the server-authored fiscal commitment and current persisted treasury → explicitly sign. Changing the option or returning to the agenda invalidates the review. A canceled review never invokes `submit_decision`.
- The review deliberately does **not** predict public approval, institutional trust, cohort response or a final treasury balance. Those results remain exclusive to the server-authoritative simulation and are displayed only from the post-RPC persisted world snapshot. Existing lost-RPC-response and reconciliation barriers remain intact.
- `src/styles.css` adds a responsive institutional review panel with labeled native controls. `src/App.test.tsx` adds cancellation and option-change regression tests and updates all signature flows to require review.
- [GitHub Actions 39948953731](https://github.com/akumanomi1988/act-of-state/actions/runs/39948953731): `npm ci` **PASS**, deterministic oracle **8/8 PASS**, TypeScript **PASS**, Vitest **15/15 PASS** across three test files, Vite production build **PASS**. Deprecation warnings in GitHub Actions/Node remain non-blocking.
- No Supabase schema/data changes or production deployment. The earlier SQL rollback suites are still the last database-integration evidence; they were not rerun for this frontend-only update. Manual keyboard/screen-reader audit, screenshots, authenticated real-browser E2E and approved final brand assets remain unverified.
- Improves evidence for **MVP-F002, MVP-F003, MVP-V002, MVP-V003 and MVP-T005**, without promoting them to DONE. Fully accepted: **1/18 requirements (MVP-T003)**; phase P01 percentage **UNKNOWN**; iteration **PARTIAL**.

## AOS-MVP-001 — Repeatable PostgreSQL integrity CI (2026-10-23)

- [PR #9](https://github.com/akumanomi1988/act-of-state/pull/9) adds a **SQL-path-filtered** GitHub Actions workflow using a disposable PostgreSQL 17 service. It builds the schema from all five migrations, checks RLS/explicit Data API grants and RPC privileges, executes the existing `decision_flow.sql`, `world_snapshot.sql`, and `historical_decision.sql` regression suites, and confirms rollback leaves **0** synthetic users/governments/cohorts/decision events.
- The `ci_auth_adapter.sql` shim creates only the minimum role/JWT lookup contract needed for standalone PostgreSQL. This validates SQL transaction and RLS behavior, **not** a complete Supabase Auth browser session, hosted Data API, or production permissions; it must not be applied to the dedicated cloud project.
- [PostgreSQL CI 39949835234](https://github.com/akumanomi1988/act-of-state/actions/runs/39949835234): migration replay **PASS**, grant/RLS contract **PASS**, three rollback SQL suites **PASS**, zero-retained-fixtures **PASS**. [Quality CI 39949835093](https://github.com/akumanomi1988/act-of-state/actions/runs/39949835093): npm install, **8/8 Node oracle**, **15/15 Vitest**, TypeScript and Vite build **PASS**.
- This increment adds only CI/tests/documentation. No game schema or cloud data changed. Supabase's announced October 2026 Data API auto-exposure change does not invalidate the current explicit SQL `GRANT SELECT` / `GRANT EXECUTE` model, as verified by the contract test; cloud behavior still requires separate verification.
- Improves repeatable evidence for **MVP-T001, MVP-T002, MVP-T004 and MVP-T005**; none of them becomes DONE until the remaining real Auth/cross-request E2E gate closes. Globally **1/18 fully accepted requirements**, P01 **UNKNOWN**, AOS-MVP-001 **PARTIAL**.

## AOS-MVP-001 — Second playable dossier (2026-10-23)

- Migration `20261023120307_aos_006_second_intro_dossier.sql` introduces a second explicitly fictional introductory scenario, `water-security`, with three fiscal/policy alternatives. Seed validated in a rollback transaction before applying to the isolated Akumanomi DEV project.
- Existing server-authoritative `submit_decision` and owned snapshot API were reused unchanged. A government can decide `energy-resilience` and then `water-security`; the second operation compounds real treasury, approval, trust and weighted cohort state.
- `supabase/tests/decision_flow.sql` now verifies the seeded second dossier, cumulative state, cohort response, idempotent retry and two-event history. `world_snapshot.sql` checks both seeded dossiers (six options). `src/App.test.tsx` exercises dossier switching, two signatures, fiscal review and persisted readback.
- The second scenario is **not** presented as current news. Automated weekly publication of ten news-linked dossiers remains outside this increment.
- The authenticated real-browser/preview-host gate remains open. Do not classify this as production E2E, and do not advance global verified acceptance beyond 1/18 without closing the relevant full requirement gates.

## AOS-MVP-001 — Governed weekly cabinet cycle (2026-10-23)

- Six DEV-applied migrations (`aos_007`–`aos_012`) add `weekly_releases`, mandatory HTTPS source metadata for weekly dossiers, a trusted-editorial-only `approve_weekly_release` RPC, immutable approved dossier/option content, a decision publication gate, serialized editorial approval and the weekly calendar. The GitHub filenames match the remote migration versions.
- Approval requires **exactly ten distinct dossiers**, with at least two options and non-future source timestamps each. A slate may be approved ahead of time; RLS and the existing decision RPC expose it only from its Monday UTC release date. No synthetic news is published into DEV.
- `get_weekly_calendar` is owner-scoped, derives the real-day/game-day week and Friday milestone from server UTC, and counts weekly resolutions and fiscal impact from persisted decision-event before/after state. `get_government_world` returns this calendar in the same read-consistent snapshot.
- React displays the Monday/Friday dates, weekly completion, actual aggregate fiscal impact, and a link to the dossier's editorial source. The Friday milestone is **informational**, not yet a binding decision cutoff or fully simulated settlement; this rule still requires product acceptance.
- `supabase/tests/weekly_release.sql` exercises incomplete slate rejection, unauthorized approval, publication visibility, future embargo, immutable content, decision idempotency, owner isolation and cumulative calendar readback in rollback. Existing SQL suites and React adapter tests were extended.
- No browser-authenticated E2E, real-news ingestion, or production hosting is claimed. Global MVP acceptance remains evidence-driven.


## AOS-MVP-001 — Editorial workbench macroincrement (2026-10-23)

- Canonical branch: \`aos/editorial-workbench\` (PR and merge tracked separately). Before this increment, \`main\` was at \`2a08ad43122de067d697bcdf75e9a3d66b9be936\`; no unrelated repository was modified.
- Three migrations \`aos_013\`–\`aos_015\` were applied to the dedicated Supabase DEV project and committed as identical numbered SQL files. They add isolated staff roles, revisioned draft storage, and an atomic ten-dossier publishing RPC that reuses the existing weekly approval and immutable release model.
- \`src/EditorialApp.tsx\`, \`src/lib/editorial.ts\` and the \`/editorial\` route provide an editorial agenda, per-dossier source metadata, option authoring, numeric simulation parameters, save/reload, role-based publication controls, and response/error reconciliation. Existing institutional palette and fonts are reused; approved final brand assets remain unverified.
- \`supabase/tests/editorial_workflow.sql\` and the expanded \`access_contract.sql\` cover RBAC, RLS/grants, revision conflicts, atomic publish, duplicate submit, bad-input rollback, and persistence. \`src/EditorialApp.test.tsx\` tests role denial, save, incomplete publication blocking, published UI and conflict handling. These are automated fixture-based tests, not a real authenticated browser E2E.
- No staff membership or real news article was created in DEV. A trusted operator must provision a verified user into \`editorial_members\` before the workbench is operable end-to-end by a human. The real editorial workflow and preview deployment remain **BLOCKED** pending that setup.
- Requirement statuses remain **PARTIAL** for MVP-F002/F006, MVP-T001/T002/T004/T005 and MVP-V002/V003. The entire acceptance contract is not closed. **Global accepted: 1/18 (MVP-T003)**, P01 **UNKNOWN**, iteration **PARTIAL** until end-to-end gates pass.

- `aos_016` adds indexes for editorial user foreign keys after the DEV performance advisor flagged them; this is a database-maintenance refinement of the same macroincrement.


## AOS-MVP-001 — Ten-party shared-nation foundation (2026-10-23)

- Canonical base: `main` at `c156b6a35f92497e4d461cad23c0edd024b788d8` after editorial PR #12 merge. Working branch: `aos/multiplayer-ten-party-foundation`. No Moncloa-AI changes or deployment.
- Dedicated DEV migrations `20261023130040_aos_017_multiplayer_ten_party_foundation.sql` and `20261023130434_aos_018_index_match_stance_option_fk.sql` applied and source-controlled. They add one government-backed match with ten unique party seats, private invitation, host-only start, immutable dossier stances, deterministic cohort policy-affinity score and an authorized, embargo-aware shared-state read model. Existing `submit_decision` remains the sole national political/economic mutation engine.
- `src/lib/multiplayer.ts`, `src/MultiplayerApp.tsx`, the `/multiplayer` route and institutional responsive styles implement authenticated create/join, match list, ten-seat lobby, invitation, host start, shared dossier/party stance, cabinet signature, real persisted treasury/approval/trust and political history. Fifteen-second polling is used; no Realtime claim.
- `supabase/tests/multiplayer_ten_party.sql` executed in rollback on dedicated Supabase DEV: **PASS**. Ten synthetic identities filled all ten seats; eleventh denied; outsider denied; duplicate create/join/start/stance safe; conflicting stance rejected; guest could not submit a national decision; the host's one decision changed treasury from **12,000 to 10,600 M€ exactly once**, and seat 10 read that state. These were transient fixtures, not human accounts.
- Expanded `supabase/tests/access_contract.sql` passed on DEV: match tables have RLS with no direct browser grants, while only authorized-user RPC invocation is possible. Zero retained matches/players/stances after rollback. Security advisor: 11 intentionally authenticated SECURITY DEFINER RPCs, all under explicit identity checks; three no-policy notices on private RPC-only tables. Performance advisor's one new missing FK index was addressed by migration `aos_018`; unused-index infos may remain.
- `src/MultiplayerApp.test.tsx` and PostgreSQL CI gating added. CI results and ten-browser test are tracked separately; no claim of production end-to-end play.
- Status impact: **MVP-F008 PARTIAL**, stronger evidence for **MVP-F001/F002/F003/F004/F005, T001/T002/T003/T004/T005/T006 and V002/V003**. No new requirement is fully accepted until real Auth/preview/browser verification. Global **1/18 DONE**, P01 percentage **UNKNOWN**, current iteration **PARTIAL**.
- Explicit next gates: green quality/PostgreSQL CI, real ten-account preview smoke test, authenticated cross-match isolation, concurrent join/retry load, responsive/keyboard screenshots, scheduler and election mechanics. A synthetic ten-identity SQL suite is not an actual multiplayer playtest.


## AOS-MVP-001 — Concurrent ten-player integrity gate (2026-10-23)

- Branch `aos/concurrent-ten-player-integrity`, PR #14, based on `main` at `1426e104fd2388ab790a7b3e3ef3d22b426c9dd9`. No schema or production change.
- `supabase/tests/multiplayer_concurrency.sh` uses distinct PostgreSQL connections with the CI-only Auth role adapter. Eleven accounts race for nine remaining seats: exactly **nine joins succeed** and **two return MATCH_FULL**, with ten unique members and ten distinct seats.
- The host then issues ten simultaneous, identical calls to the server-authoritative decision RPC. Exactly **one event** survives and treasury changes **once** from 12,000 to 10,600 M€. The disposable fixture is deleted and the zero-residue check includes accounts, governments, matches, players, stances and events.
- The PostgreSQL CI workflow executes this gate after replaying all 18 migrations and the existing rollback suites. This validates database-level concurrency and transaction ordering, not real simultaneous browsers, user Auth refresh/reconnection, web hosting or load at scale.
- Preview E2E blocker: the connected Vercel account exposes only the `nexttapstudios` team labeled `Anvil-fitness`, and no ACT OF STATE project. To avoid crossing product ownership and deployment scope, no project was created there. A dedicated authorized Vercel destination or alternative approved preview host is needed before browser E2E.
- Requirement impact: stronger evidence for **MVP-F008**, **MVP-T001**, **MVP-T002**, **MVP-T004**, **MVP-T005**; statuses remain **PARTIAL** pending real authenticated browser E2E. Global full acceptance remains **1/18**, phase P01 percentage **UNKNOWN**.

## AOS-MVP-001 — Binding parliamentary legislation macroincrement (2026-10-23)

- PR [#16](https://github.com/akumanomi1988/act-of-state/pull/16) introduces `aos_019`, `src/lib/parliament.ts` and `src/ParliamentPanel.tsx`. It turns opposition into a material gameplay actor: government proposal, immutable per-party yes/no/abstain ballots, automatic absolute-majority approval, final quorum/majority after all ballots or 24 hours, rejection and new proposal, and a mandate tied to the exact dossier version and option.
- PostgreSQL is authoritative: authentication and match-membership checks, host-only proposals, serialized row-locked tally and approval, RLS and revoked direct table grants. A `decision_events` trigger prevents any active multiplayer government's original decision RPC from bypassing Parliament; rejected attempts leave no fiscal/state mutation.
- The assembly UI shows the proposed option, live tally, participation, deadline, personal recorded ballot and approved mandate. The host can sign only the approved measure. Fresh RPC reads reconcile mutations and polling refreshes every 15 seconds.
- The rollback-only ten-identity integration suite now checks the mandate gate, outsider denial, immutable ballots, all ten participants, rejected/reproposed measures, idempotency and durable shared state. The cross-connection stress script first passes a bill, then races ten identical cabinet requests. Foreign keys cascade during synthetic account cleanup.
- Deployment/acceptance boundary: real browser magic-link login and ten independent authenticated sessions are still not verified, nor are full elections, real-news ingestion, Friday settlement, responsive screenshot QA or completed launch readiness. **MVP-F008 remains PARTIAL; global fully accepted requirements remain 1/18.**

## AOS-021 — National elections macroiteration (2026-10-23)

- Scope: a complete first electoral loop for an existing ten-party match: policy declaration, live cohort forecast, 90-day election scheduling, seven-day campaign freeze, 100 D'Hondt mandates, immutable certification act, peaceful handover of executive power, and mandate-weighted parliamentary voting.
- Architecture: server-authoritative versioned electoral math and match-scoped SECURITY DEFINER RPCs. Direct public Data API access remains revoked. The outgoing leader's cabinet authority is serialized against election certification using match row locks.
- Source: migration `20261023170000_aos_021_national_elections.sql`, `src/ElectionPanel.tsx`, election client adapter, styling, React tests, SQL integration suite, and `docs/ELECTION_RULES.md`.
- Acceptance: **PARTIAL** until current PR checks, deployment and real authenticated browser sessions pass. Synthetic ten-party SQL does not prove ten real browser clients. No invented 100% completion estimate.
- Blocking release gaps: scheduled election processor, cabinet coalition/confidence mechanics, multidimensional electorate, real ten-client E2E, operated current-news pipeline, Friday close, and visual/accessibility QA.

## AOS-023 — Autonomous calendar macro-iteration (2026-10-23)

- **Scope:** One server-driven political calendar engine: expired parliamentary votes, due national elections, immutable Friday settlement, catch-up and member-only read model. The production scheduler is a single named Supabase Cron job every 15 minutes; no browser participation or third-party scheduling secrets required.
- **Architecture:** `game_internal` functions contain the shared settlement logic. Public member-authorized parliamentary/election RPCs delegate to them; scheduler uses the same functions. `match_weekly_closures` is a no-direct-access ledger. The UI reads `get_match_calendar()`.
- **Quality contract:** Transactional suite `supabase/tests/autonomous_calendar.sql` verifies expiry, election, 100 mandates, Friday backfill, retries, outsider denial and client privilege boundaries. Existing CI suites run unchanged alongside it.
- **Operational manual:** `docs/CALENDAR_OPERATIONS.md`.
- **Open product gaps:** automated sourcing/editorial approval of ten real-news dossiers is deliberately **not** synthesized; real multi-account browser testing, richer economy, coalition diplomacy and responsive/visual acceptance remain.
- **Completion accounting:** still only MVP-T003 is fully accepted (1/18; 5.6%). New backend contracts do not by themselves close the release gates.

## AOS-024 — Editorial news sourcing macroiteration (2026-10-23)

- Implementation branch: `feat/aos-024-editorial-news-discovery`.
- Introduced a staff-authenticated Supabase Edge Function `news-discovery` for an allowlisted six-source RSS catalog. It validates the end-user Auth token plus existing editorial RLS, constrains upstream host and protocol, rejects upstream redirects, caps feed size and time, filters dated headlines, and returns source citation metadata without article text.
- Integrated an editor-initiated source picker into `/editorial`. Linking a candidate updates **only** source title, HTTPS URL and publication time in the **unsaved** draft slot. The existing 10-slot CAS draft/publisher approval and Monday publication embargo remain unchanged.
- Regression coverage: parser security/date/duplicate tests and source-picker interaction/error tests; integrated into existing quality CI paths.
- Deployment and testing results belong to the associated PR and Edge deployment checks. Real authorized editor-browser E2E and independently checked political dossiers remain **PARTIAL**, and SMTP exhaustion remains an Auth/operations release blocker.
- No evidence supports promoting additional 18-point MVP acceptance criteria to DONE without actual live editorial publication and real-browser E2E. Strict completion remains **1/18 = 5.6%** pending those gates. Refer to `docs/NEWS_DISCOVERY_OPERATIONS.md`.

## AOS-025 — Coalition negotiations and constructive confidence (2026-10-23)

- PR #20: one large integrated nation-governance increment (SQL authority, React UI, calendar scheduling, audit, permission and regression coverage).
- The cabinet leader can invite other elected parties to a coalition. Coalition partners independently accept/decline or leave. Coalition support is calculated from persisted mandate weights; partner acceptance does not transfer unilateral national decision rights. On a government change previous leader-specific agreements are inactive.
- Parties with positive mandates can initiate one 24h constructive confidence motion per match. All seated parties cast immutable, seat-weighted votes; more than half of total mandates immediately installs the proposed new leader in a row-locked transaction. Full participation or expiry otherwise rejects.
- The existing Supabase Cron worker now closes expired motions before due national elections; election-act insertion is blocked while a motion remains open. Original Parliamentary mandate and executive owner checks continue to protect national decisions.
- New server-only tables have RLS and no direct Auth browser table grants. The integration suite uses four synthetic accounts and rolls back every mutation. UI tests verify invitations, responses, votes, handover notifications, and error handling. Existing SQL concurrency and electoral suites remain release gates.
- Hard acceptance baseline is unchanged: **1/18 fully accepted = 5.6%**. AOS-025 strengthens MVP-F007, F008, T002, T004, T005 and V002 but cannot promote them to DONE without real multi-account Auth browser play and visual/security operations signoff. The user's aspirational 20% milestone (at least 4/18 accepted requirements) is NOT yet verified. Do not count components or passing synthetic tests as three fully accepted requirements.
- Real-user access is blocked by the free Supabase SMTP quota until the sender/provider configuration is completed. Source code cannot provision a third-party Gmail app password or modify Auth SMTP settings through database SQL. Avoid insecure login bypass.
- Detailed rules: docs/GOVERNANCE_RULES.md.

## AOS-027 — National fiscal engine + real browser quality gates (2026-10-23)

- Production-ready source lives in PR #21, branch `feat/aos-027-fiscal-world-and-browser-qa`; the release record must link to the final green CI and Vercel deployment commit before closing.
- New authoritative budget: four allocations always sum to 100%, one bounded revision per UTC week, validated/locked with cabinet-only authorization; partner and opposition have read access without edit rights. Immutable effective-week policy snapshots.
- Autonomous national fiscal close after each fully elapsed Friday. Version `national-fiscal-v1`: projected/settled revenues, expenses, balances, debt issuance/paydown, treasury, bounded GDP/unemployment/inflation indicators and distinct cohort responses. The existing 15-minute Cron wraps the established Parliament/election/Friday scheduler, with idempotent close and private retry failures.
- Gameplay UI: a responsive national budget screen on solo and multiplayer, reviewing budget transfers before server authorization, forecast, historical ledgers, policy audit and active cabinet authority.
- Tests: rollback-only Cloud fiscal SQL suite, full PostgreSQL CI integration, **committed** read-after-write under real separate DB calls in dedicated Supabase DEV, idempotent re-execution, outsider isolation and verified complete synthetic cleanup. Simulated Chromium HTTP E2E probes startup/login limits, national decisions and fiscal budget across page reload, responsive width and WCAG accessibility; this is explicitly **not** real SMTP/Auth E2E.
- **Strict accepted-requirements baseline:** MVP-T003 and MVP-T001 = **2/18 = 11.1%**. AOS-027 materially raises implementation maturity but does not prove 40% accepted. Crossing 40% requires at least 8/18 accepted. T002 and F001 still require working email/Auth flow; ten real editorial dossiers, distinct-account multiplayer E2E, live national decision UX and human visual review remain open.
- No authenticated users were created through the browser test; Cloud checks used controlled synthetic Postgres Auth identities without email sending, removed after verified checks.
- Economics deliberately represents invented game rules, **not factual GDP, CPI or official unemployment**. Live economic balancing and institutional approval of tax policy remain pending.
- Operating handbook: `docs/NATIONAL_FISCAL_OPERATIONS.md`.

## AOS-028 — National decision analytics (2026-10-23)

- Source increment: shared solo/multiplayer strategic archive, persisted before/after inspection, 7/30-day server-UTC filters, signed treasury/approval/trust attribution, social-cohort changes, responsive visual timeline and keyboard-operable controls.
- No new Supabase migrations, direct table grants, external services, simulated forecasts or invented game effects. Uses the existing authorized immutable decision events and keeps autonomous fiscal settlements out of cabinet-impact totals.
- Verification contract: dedicated deterministic TypeScript unit tests, React component tests, existing solo/multiplayer regression, production typecheck/build and the headless Chromium quality workflow. Hosted real-Auth/browser acceptance remains separate.
- Requirement influence: MVP-F005, MVP-V002, MVP-V003 and MVP-V004. None becomes DONE solely from this frontend increment. Strict global requirement acceptance remains **2/18 = 11.1%** pending full release gates.
- Design and evidence boundaries: `docs/DECISION_ANALYTICS.md`.


## AOS-029 — Weekly political campaigning and electoral persuasion (2026-10-24)

- Introduces immutable, once-per-UTC-week actions for every active party. Campaign strategy, cohort, and ideological fit determine a bounded, versioned, server-side influence increment; election projections consume that influence before D'Hondt apportionment.
- Safe replay and conflicting-call rejection are serialized through the match row lock. Distinct parties campaign independently. Outsiders cannot read/write; the last seven pre-election days disallow new interventions. No direct browser table grants, real-money costs or LLM-dependent simulations.
- New CampaignPanel in multiplayer, typed campaign.ts adapter, migration 029, SQL rollback suite campaigns.sql, read-grant checks, React component coverage and CI PostgreSQL gate. The campaign register and readback use real database events, not client estimates.
- Targeted evidence: automated unit/test oracle/typecheck/build and PostgreSQL CI after PR. Release does not claim real-party browser authentication, political donations, news editorial operation or complete market calibration. Requirement MVP-F007/MVP-F008 remain PARTIAL; completed MVP acceptance remains 2/18 pending full product gates.


## AOS-031 — Persistent household micro-simulation and per-family elections (2026-10-24)

- Each government has 300 deterministic household archetypes, generated without external data or RNG, each with weighted residents, age, household income, settlement, parent cohort, policy preference, support and trust. They are synthetic and cannot be mistaken for personal data or an empirical national demographic survey.
- Government policies and fiscal settlement already modify population_cohorts; an atomic database trigger propagates changes to household microstates with stable heterogeneous multipliers. Unique composite keys prevent duplicate agents on re-login.
- Election model electoral-households-v1 aggregates family voter affinity and party campaign influence, weights shares by simulated residents, and retains 100-seat D'Hondt. Previously certified election acts remain immutable under their original version.
- Solo and multiplayer views provide accessible demographic exploration with generational, income, territory and cohort breakdowns. Only aggregated statistics are returned to authorized members.
- Includes rollback-only SQL integration and React/browser regressions. MVP-F004/MVP-F005/MVP-F007 remain PARTIAL until calibration and real authenticated acceptance tests.


## AOS-032 — High-throughput weekly sourcing (2026-10-24)

- The authorized editorial workbench can source up to ten distinct recent
  references in one click through six JWT-protected news feeds.
  Independent feed failures are tolerated, tracking URLs deduplicated,
  coverage diversified and manually authored slots preserved.
- Metadata and provisional headlines are imported without automatically
  completing political decisions, saving drafts or publishing sources.
  Separate editorial fact-checking and publisher authorization remain.
- The publication RPC now rejects duplicate news source URLs transactionally.
  SQL rollback tests include a duplicate-source rejection and subsequent
  successful ten-source publication.
- Unit, integration and mobile Chromium acceptance apply. Operational
  unattended publication and real publisher/news-source acceptance remain
  outstanding, so MVP-F002 and MVP-F006 are PARTIAL.


## AOS-034 — Territorial electorate and district seats (2026-10-24)

- Stable territorial assignments for 300 synthetic households per government
  across six fictional districts, 100 fixed seat mandates and a migration
  that preserves preexisting household states.
- Five-dimensional population readout now includes authorized geographic
  support, trust, citizen counts and district seat capacities.
- Replaced national at-large allocation with resident-weighted D'Hondt by
  district, adding together exactly 100 seats per election. Original campaign
  and incumbency weights remain incorporated in each household's preferences.
- Versioned new election model electoral-districts-v1, persisted immutable
  territorial snapshots and retained backwards-compatible historic acts.
- React regional views, SQL mass-conservation/authz/determinism suite and
  national election/campaign/parliament regressions. Real ten-user acceptance
  and external electoral calibration remain open. MVP-F004/F007 PARTIAL.


## AOS-035 — Operator-controlled weekly newsroom (2026-10-24)

- Publisher-managed editorial grants/revocations by confirmed email, with
  transactional last-publisher protection and role-change audit. The first
  publisher still needs explicit trusted operator authorization.
- Category-specific deterministic fictional policy drafting for ten sourced
  dossiers; three distinct options per dossier without overwriting authored
  texts or generating fictitious current events.
- Publisher verification is logged per source with saved draft revision.
  Resaving invalidates all prior reviews. The backend requires all ten
  current reviews before atomic publication.
- React newsroom has authoring, source inspection, approval and staff controls
  plus typed helpers and integration tests. Weekly real news verification,
  actual staff and real-account end-to-end checks are still outstanding.
  MVP-F002 and MVP-F006 remain PARTIAL.


## AOS-036 — Lobby preparation and direct invitations (2026-10-24)

- Added authoritative readiness per party plus a host-controlled strict
  ready-check option. Existing matches preserve their preexisting admission
  and activation behavior until a host explicitly opts in.
- Withdrawal of invited parties and safely reusable lobby seats now have
  frontend support. Match-row locking serializes ready, policy, join,
  withdrawal and start, and forbids modifications after activation.
- Sanitized shared invitation links prefill the invited lobby through
  first-time email OTP authentication and reloading the web application.
- SQL ten-party regression, typed RPC contracts, Vitest interactions and
  Chromium mobile/WCAG checks validate the integrated lobby lifecycle.
- Ten actual human accounts, external email delivery and a sustained
  production week remain unvalidated. MVP-F001/F008 are still PARTIAL.


## AOS-037 — Weekly accountability and political history (2026-10-24)

- Server-enforced Monday-through-Friday action windows for all weekly
  dossiers, including existing records, insertion/update guard and check.
  Prior cabinet decisions, party positions, votes and source citations
  remain historically retrievable but cannot be changed after Friday.
- New member-only bounded multi-week RPC combines approved-source dossiers,
  nation decisions, party participation, parliamentary votes, election
  winners and immutable certified Friday balances in one server snapshot.
- Player-facing multiplayer weekly history includes selectable weeks,
  independently verified sources, closed vs waiting settlement states,
  fiscal/electoral act display and mobile-friendly accountable parties.
- PostgreSQL 17 synthetic multiplayer test, Chromium historical UI smoke,
  typed Vitest and Cloud rollback checks added. Live human 10-account
  multi-day play, verified news and real email remain externally blocked.
  MVP-F002/F003/F006/F008 remain PARTIAL, not prematurely DONE.


## AOS-038 — Political activity inbox for asynchronous multiplayer (2026-10-24)

- Server-derived, party-specific agenda covers lobby readiness, eligible host
  launch, current parliamentary and confidence votes, coalition invitations,
  live dossier stances, campaign activity, cabinet mandate execution,
  certified Friday summaries and elections.
- Member-only inbox RPC and persistent per-party read receipts; out-of-match
  access and fabricated task keys fail closed. Reading an item never executes
  a vote or a decision. No browser account can query receipt rows directly.
- Responsive, keyboard-operable activity panel with unread counts, filters,
  contextual links and server-confirmed acknowledgment at 15-second refresh.
- Added PostgreSQL three-identity rollback regression, typed API tests,
  React interaction tests and Chromium authenticated reload verification.
- Real SMTP, push delivery, ten-account public play and sustained political
  week still unverified. MVP-F008 remains PARTIAL, without invented progress.


## AOS-039 — Immutable daily electoral observatory (2026-10-24)

- Append-only daily polling for active multiplayer sessions, derived from
  the identical versioned national/territorial electoral certification model.
  Missing days are not reconstructed from current voters.
- The calendar scheduler captures each current UTC day under match locking,
  de-duplicates repeat runs, stores failure diagnostics and preserves
  existing fiscal/Parliament/election settlements.
- Member-only bounded history RPC, private poll storage under RLS.
- Electoral interface adds 7/30/90-day windows, completeness, party
  voting trends, exact date/seat data and recorded district leaders.
- SQL rollback, Vitest and Chromium mobile coverage. Real player acceptance
  remains outstanding; MVP-F007 and F008 stay PARTIAL.

## AOS-041 — Player onboarding and reconciled product inventory

- Public `/guide` manual covers all implemented political systems and access recovery.
- Solo and multiplayer onboarding derive their next steps from authorized world snapshots;
  another party's action does not complete the current player's task. Guide reads never
  execute decisions, votes or other mutations.
- Added guide links across government, assembly and editorial entry points and mobile/
  accessibility browser coverage. No new dependency, Auth grant or schema change.
- `docs/PRODUCT_STATUS.md` is the current system-by-system implementation and remaining
  acceptance inventory. Earlier historical tracker entries may be superseded by it.
- Real email delivery, ten human accounts, reviewed current-news operation, a real-time
  week, balancing, recovery/load exercises and final human visual acceptance remain open.
  Strict accepted requirements remain 2/18, without invented completion percentages.
