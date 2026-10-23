# ACT OF STATE

**Every decision shapes a nation.**

Free-to-play, browser-based, persistent political simulation. This codebase is independent from Moncloa-AI.

## Current implementation (AOS-MVP-001)

The React/TypeScript frontend uses Supabase Auth and displays only state returned from PostgreSQL. The database holds owner-bound governments, fictional introductory dossiers, governed sourced weekly dossiers, weighted population cohorts, decision events and a deterministic, server-authoritative simulation engine.

**Deployment status:** frontend not deployed. The dedicated Akumanomi Supabase project `Act-of-state` (`nwlxkqwbusrrldveijzb`, eu-central-1) now hosts the migrated schema. SQL integration assertions were executed in rolled-back transactions; browser E2E and real email authentication remain unverified. Never connect this application to Anvil Fitness.

## Set up

Requires Node.js 22, npm, and a **separate** Supabase project reserved for ACT OF STATE.

1. Clone this repository and run \`npm ci\` (uses the committed integrity-checked lockfile).
2. The dedicated Akumanomi ACT OF STATE project has the approved game migrations applied. For a **new empty** isolated project, apply all versioned files under \`supabase/migrations/\` in order using the approved migration workflow. Do **not** apply them again to this project, Anvil Fitness, Moncloa-AI, or production databases of other products.
3. Enable Supabase Auth email magic-link sign in and configure the permitted redirect URL for this frontend origin.
4. Copy \`.env.example\` to \`.env.local\`; set \`VITE_SUPABASE_URL\` and \`VITE_SUPABASE_PUBLISHABLE_KEY\` from the dedicated project. These are browser-safe public values, never a service-role/secret key.
5. Run \`npm run dev\` and open the shown local URL.
6. Log in via email link; a government and exactly two representative cohorts are seeded on first successful session. Returning players resume the same government.
7. Open either fictional introductory dossier, select an option, review its authored fiscal commitment, then explicitly sign one decision. Reload: the same choice and calculated state must remain persisted; duplicate RPC execution must not apply twice.

## Verification

- `npm run typecheck` — TypeScript.
- `npm test` — React flow and outcome rendering from persisted event fixtures.
- `npm run test:oracle` — dependency-free deterministic calculation oracle.
- `npm run build` — production frontend bundle.
- `supabase/tests/decision_flow.sql`, `world_snapshot.sql` and `historical_decision.sql` — rollback-only database assertions covering ownership, budget atomicity, retry safety, cross-account isolation, and durable history. Execute only in a dedicated disposable environment where inserting test users is permitted.
- `supabase/tests/access_contract.sql` — explicit table privileges, RPC execution grants, and RLS assertions.
- E2E (manual until provisioned): sign-in, seed, dossier retrieval, decision, reload, retry and account isolation. Verify responsive/mobile and keyboard navigation.

GitHub Actions quality CI runs on pull requests to `main` or manually. A separate path-filtered PostgreSQL 17 integration workflow runs only when SQL migrations/tests or its workflow change (or on manual invocation), limiting extra CI minutes. It creates a disposable database, applies every migration, executes RLS/privilege assertions and the three rollback suites, then verifies that no synthetic users or game state remain. The CI-only `ci_auth_adapter.sql` emulates role/JWT lookup for plain PostgreSQL; it is **not** real Supabase Auth and must never be applied to Supabase Cloud. Authenticated browser E2E and approved preview hosting remain release blockers.

## Boundaries

- One real day = one in-game day, derived from server UTC date.
- A trusted editor can prepare and approve a complete ten-item weekly slate; it becomes visible automatically on Monday UTC. The Friday milestone is an informational persisted-decision readout, not yet a binding closure/settlement.
- Real-news collection, independent editorial verification, electoral calculation and daily economic ticks: **not implemented**.
- Two introductory fictional dossiers are provided; neither represents real-world current events. Weekly fixtures appear only inside rollback tests.
- One government per authenticated owner during MVP.
- All simulation effects are derived from immutable, versioned option parameters in PostgreSQL, never from submitted client-calculated values.
- No LLM on the simulation path; no pay-to-win or gameplay purchase.

## Architecture

\`\`\`
src/App.tsx, src/components       React/TypeScript presentation
src/lib/game.ts                  Authenticated Supabase RPC/read adapter
supabase/migrations/             PostgreSQL domain model, RLS and transactional engine
supabase/tests/                  Disposable database integration assertions
docs/MVP_TRACKER.md              Evidence-based MVP statuses
\`\`\`

The current SQL function encapsulates the simulation transaction. A reusable standalone domain engine package may be extracted only when multiple backend consumers justify it.

Review \`docs/MVP_TRACKER.md\` for status, blockers and subsequent increments.

### Deterministic contract oracle

Run `npm run test:oracle` independently of npm dependencies. These eight tests specify the exact three option outcomes and numeric rounding for `weighted-cohorts-v1`. They ran successfully under Node 22 during source preparation, but **do not replace PostgreSQL integration tests**. Every persisted decision also retains `parameters_snapshot` for reproducibility.

### Editorial embargo invariant

Weekly dossiers require an explicit Monday `available_from` date (UTC). The authenticated Data API cannot read dossiers or option rows before publication; the privileged mutation validates the same window. Week-specific dossiers must use distinct stable IDs to allow new decisions in subsequent weeks. The ten-dossier publication gate and Friday readout now exist; automated real-news ingestion, scheduled release creation and Friday settlement remain unimplemented.

## Backend connection (Akumanomi)

Dedicated Supabase project: `Act-of-state`, reference `nwlxkqwbusrrldveijzb`. The publishable key is obtainable via Supabase Dashboard > Project Settings > API Keys. **Never commit a secret/service-role key.**

Applied migrations (the filenames below match the actual remote migration history):

- `20261023050112_aos_001_foundation.sql` — schema, RLS, deterministic RPC, introductory content.
- `20261023050305_aos_002_restrict_event_trigger_execute.sql` — revoke publicly executable pre-provisioned event-trigger function.
- `20261023050408_aos_003_index_decision_dossier_fk.sql` — FK covering index.
- `20261023052739_aos_004_consistent_world_snapshot.sql` — owner-scoped read-consistent government snapshot.
- `20261023064252_aos_005_historical_decision_titles.sql` — immutable historical decision labels.
- `20261023120307_aos_006_second_intro_dossier.sql` — second fictional policy dossier.
- `20261023123534_aos_007_weekly_schema.sql` — weekly release state, mandatory source metadata, publication RLS.
- `20261023123538_aos_008_weekly_approval.sql` — trusted editorial approval of exactly ten dossiers.
- `20261023123541_aos_009_weekly_freeze.sql` — immutable approved dossiers, options and release state.
- `20261023123543_aos_010_weekly_decision_gate.sql` — transaction-level publication defense.
- `20261023123545_aos_011_weekly_calendar.sql` — owner-scoped weekly calendar and dashboard snapshot.
- `20261023123752_aos_012_weekly_integrity_hardening.sql` — editorial approval serialized against concurrent writes and result-derived fiscal readout.

Security advisors show two intentional authenticated `SECURITY DEFINER` RPC warnings: `start_government()` and `submit_decision()`. Both are explicitly granted only to `authenticated`, inspect `auth.uid()`, and restrict to the owning government; `anon` execute is denied. This is a documented least-privilege exception, not a suppressed warning. [Supabase remediation guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Performance advisors report one informational unused-index finding on the newly empty `weekly_releases` table; reassess after editorial traffic begins.

Observed after weekly DEV deployment: 6 RLS-protected game tables; 2 fictional introductory dossiers; 6 decision options; 0 weekly releases, 0 weekly dossiers, 0 user governments and 0 decision events. The weekly publication pipeline has only been exercised with rollback fixtures.

**Remaining browser setup:** add the selected localhost/preview origin to Supabase Auth URL Configuration; provide project publishable key in `.env.local` or deployment environment; verify real email link and return session flow.

## Consistent government-world retrieval (AOS-MVP-001)

As of migration `20261023052739_aos_004_consistent_world_snapshot.sql`, the authenticated frontend reads the owned government, visible dossiers/options, cohorts, event history and UTC day through a **single** `get_government_world` RPC. The RPC runs as SECURITY INVOKER, retaining owner RLS; it returns `null` for governments outside the caller's authorization. This removes cross-request state skew from the earlier six concurrent HTTP reads. Its behavior was verified against the Akumanomi database using `supabase/tests/world_snapshot.sql` inside a transaction rolled back after execution.

The UI flow tests in `src/App.test.tsx` run successfully in [GitHub Actions quality CI](https://github.com/akumanomi1988/act-of-state/actions/runs/39915400041), alongside TypeScript and the production Vite build. These are mocked-adapter component tests, **not** authenticated browser E2E tests.

## Durable political decision history

Migration `20261023064252_aos_005_historical_decision_titles.sql` records the original dossier and option titles at decision time. Historical outcomes remain understandable after a dossier's publishing window expires or editors revise its catalog entry. Names and parameter snapshots are read from the authoritative `decision_events` table; the frontend does not reconstruct these from the currently accessible dossier catalog. The expiry/rename scenario is regression-tested in `supabase/tests/historical_decision.sql` (transaction rollback). The interface also allows reopening archived decisions to inspect their original persisted national-state changes and cohort effects, even after the dossier leaves the visible catalog.

## Reproducible dependency installation (AOS-MVP-001)

`package-lock.json` is committed (npm lockfile v3; generated on Node 22 with npm). Use `npm ci` for local clean installs and CI; `npm install` is reserved for intentional dependency updates, whose lockfile changes must be reviewed and committed together with `package.json`. The GitHub Actions quality workflow runs from an isolated pull request and gates TypeScript, Node reference fixtures, React tests and Vite build. The temporary lockfile-generation workflow was removed after producing and verifying the lockfile.

## Governed weekly cabinet cycle

A trusted server/editorial operator stages ten distinct `release_kind='weekly'` dossiers for the same Monday UTC date, each with a HTTPS source title/URL/publication timestamp and at least two versioned options. The operator creates a `weekly_releases` row in `draft` state and invokes `approve_weekly_release(monday)` with the **service role**, never from a browser. Approval is atomic and idempotent; incomplete slates fail. Approved content is immutable.

RLS keeps an approved future slate and its options hidden until its Monday. The existing `submit_decision` remains server-authoritative, and a trigger rejects attempts to record a weekly decision against an unapproved slate. No actual news is inserted by this migration: **real editorial sourcing and review are required** before a live weekly release.

The owned world snapshot includes `calendar` with week start, Friday date, real UTC weekday, published dossier count, resolved count and the sum of persisted fiscal effects for the current week. The UI renders this readout and source citation. Friday is presently a reporting milestone only; automatic Friday settlement/cutoff and recurring real-news ingestion remain future requirements.

Migration `aos_007_weekly_cycle` and rollback suite `supabase/tests/weekly_release.sql` define the contract. The PostgreSQL CI role adapter includes a service-role stub solely to exercise the admin function in a disposable database. It must never be deployed to Supabase Cloud.
