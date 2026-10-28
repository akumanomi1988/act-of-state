# ACT OF STATE

> **Development branch AOS-057 (not released):** merges password-first Auth and a 28-case
> permanent fictional national programme (10 founding + 18 reforms, 84 policy
> alternatives), across solo and parliamentary play. The newsroom is separate;
> releases are operator-gated. See [National Reform Programme](docs/NATIONAL_REFORM_PROGRAMME.md),
> [Password Access](docs/PASSWORD_ACCESS.md) and
> [No Vercel Autodeploy](docs/NO_VERCEL_AUTODEPLOY.md).

**Engineering completion (complexity weighted): 68.7%** (886/1290 rubric points), up from
65.9% (850/1290) at the AOS-053 baseline. Historical equal-checkpoint
coverage is **79.2% (57/72)** for comparison. The weighting prioritizes
complex original systems and operational acceptance, not commit or file counts.
**Audited commercial acceptance: 11.1%** (2/18 complete product gates;
the earlier 2/18 erroneously included an outstanding hosted restore). These
measures are deliberately separate and do not claim that the latest development
branch has been published. [Auditable scorecard and method](docs/DEVELOPMENT_PROGRESS.md).

Reproduce with `npm run progress`, validate the committed report with
`npm run progress:check` and regenerate after completing verified scope with
`npm run progress:write`. The 72 checkpoint definitions are stored in
`docs/development-coverage.json`; neither lines of code nor iterations
themselves award progress.

**Mobile usability update (AOS-059, development only):**
[Task-first solo/multiplayer navigation](docs/MOBILE_UX_REDESIGN.md)
shows one area at a time on phones, prioritizes the decision, and
keeps email/password as the normal login (email links are optional recovery).
The public hosted release remains unchanged until an approved deployment.

**New development-branch gameplay (AOS-058):** A read-only
[Electoral Strategy Laboratory](docs/STRATEGY_LAB.md) lets a party
compare national and six-district hypothetical election projections
before publishing its programme. Membership and electoral deadlines
are enforced in PostgreSQL; previews do not alter saved state.

**Every decision shapes a nation.**

Free-to-play, browser-based, persistent political simulation. This codebase is independent from Moncloa-AI.

## Play instantly without an account (AOS-042)

Visit **`/demo`** to try four authored fictional government dossiers with twelve alternatives, review-before-sign decisions, deterministic local consequences, a reversible-by-reset ledger and browser-only progress. This is **not a real game save or the PostgreSQL simulation**: no authentication, backend calls, live news, party multiplayer or promotion of demonstration choices into an actual government. See [guest training sandbox](docs/GUEST_DEMO.md). Pull-request CI verifies its responsive Chromium flow, no-backend boundary, persistence and accessibility.

## The founding government programme (AOS-043)

Authenticated solo governments can now play a permanent **ten-dossier fictional founding programme** with 30 choices: original energy/water policies plus housing, healthcare, education, infrastructure, employment, food security, digital institutions and climate adaptation. All choices use the existing server-authoritative decision RPC and are permanently recorded. The government dashboard tracks decisions signed, the event-derived cumulative fiscal/social signature impacts, and current weekly dossiers with priority filters. The player guide and onboarding explain the difference between this programme and the separately published current-news cycle. See [full programme and acceptance](docs/FOUNDATIONAL_GOVERNMENT_PROGRAMME.md). The separate `/demo` training mode remains browser-local and non-authoritative.

## Multiplayer legislative command center (AOS-044)

The ten-party shared-nation interface prioritizes time-limited verified weekly dossiers over permanent fictional legislation, distinguishes each party's recorded stance from binding national decisions and provides role-aware action filters. Cabinet signatures and parliamentary votes are reconciled against immutable server acts after network loss, and stale polling cannot erase an already confirmed decision. See [multiplayer command and safety contract](docs/MULTIPLAYER_COMMAND_CENTER.md). SQL tests simulate ten authenticated database identities; separate browser sessions exercise governmental/opposition UIs against mock HTTP, **not** real human ten-account acceptance.

## Real JWT acceptance beyond mocked browser HTTP (AOS-045)

The opt-in [real-auth acceptance workflow](.github/workflows/live-auth-acceptance.yml) now runs a fully isolated local GoTrue + PostgREST stack, signs up eleven test-only users with real JWTs, seats ten political parties, records actual positions and ten parliamentary votes, confirms a binding government policy, exercises safe retries and RLS, then checks two separate authenticated Chromium contexts with responsive/axe assertions. See [evidence boundaries and operator guide](docs/REAL_AUTH_ACCEPTANCE.md). This **does not contact the production Supabase project**, test external SMTP deliverability or replace a ten-human-player acceptance review.

## Complete local email-link and ten-browser acceptance (AOS-046)

The **real protocol CI** now validates the actual user-facing magic-link login form, GoTrue-delivered email captured by local Mailpit, automatic session persistence, private invite-code preservation, UI-created and UI-joined matches, cabinet/opposition privileges, one-use token consumption, logout isolation, and all ten distinct real-JWT Chromium party sessions. This is a disposable local-only stack; no production SMTP traffic or hosted user data is involved. See [email-link and ten-browser acceptance](docs/EMAIL_LINK_TEN_BROWSER_ACCEPTANCE.md).

## Integrated live legislative week (AOS-047)

The real ten-party multiplayer room now includes a **Weekly Operations Room** that prioritizes personal editorial-week actions, tracks votes, party stances, legally enacted decisions, official Friday deadlines and unresolved work. It is a read-only composition of the authoritative government, Parliament and calendar RPCs, never a second simulation. The real-GoTrue CI additionally validates **ten synthetic weekly dossiers through the actual editor-review-publisher transaction**, version invalidation, permissions and next-week embargo; it never publishes fictional news to the hosted game. See [full workflow and acceptance boundaries](docs/LEGISLATIVE_WEEK_COMMAND.md).

## Campaigns that require continued political engagement (AOS-048)

Campaign persuasion now has **server-authoritative time decay**: two points of effective influence expire every seven UTC days after the last intervention in each social cohort. New campaigns restore support from the decayed baseline while retaining the once-a-week quota and election blackout. Both territorial election projections and archived daily opinion polls use the same versioned `electoral-districts-v2` model; old official election, poll and campaign records retain their original values. The campaign page shows current support and its next decrease. See [Campaign Relevance and Electoral Balance](docs/CAMPAIGN_RELEVANCE.md).

## Version-verified hosted releases and operational recovery (AOS-049)

The public **/status** screen shows the verified build revision, expected electoral model and a limited public authentication availability probe without needing a player session. Production builds stamp an immutable `/release.json`; a GitHub Action checks that all six public routes and the actual JavaScript bundle correspond to **the same** production Git commit, detecting the stale Vercel deployments previously caused by Hobby build-rate limits. Disposable PostgreSQL backup/restore and ten-authenticated-party load tests are integrated into CI. See [operational release and recovery handbook](docs/PRODUCTION_RELEASE_RUNBOOK.md). This does **not** replace production Auth, newsroom, real-user or live backup acceptance.

## Current implementation (AOS-MVP-001)

The React/TypeScript frontend uses Supabase Auth and displays only state returned from PostgreSQL. The database holds owner-bound governments, fictional introductory dossiers, governed sourced weekly dossiers, weighted population cohorts, decision events, ten-party shared-nation matches and a deterministic, server-authoritative simulation engine.

**Deployment status:** frontend deployed at https://act-of-state.vercel.app/; authenticated ten-browser end-to-end play remains unverified. The dedicated Akumanomi Supabase project `Act-of-state` (`nwlxkqwbusrrldveijzb`, eu-central-1) now hosts the migrated schema. SQL integration assertions, including a synthetic ten-identity match, were executed in rolled-back transactions; browser E2E and real email authentication remain unverified. Never connect this application to Anvil Fitness.

## Current simulation scope

AOS-040 adds daily household living conditions: economic security, access to
public services and wellbeing, with bounded political feedback and immutable
daily acts. Solo and multiplayer governments can inspect income/territory
differences and 7/30/90-day history. It preserves the existing weekly fiscal
ledger. See [daily living conditions](docs/DAILY_LIVING_CONDITIONS.md).

AOS-031 adds 300 deterministic synthetic family archetypes per government,
with heterogeneous social preferences, cohort-propagated political/fiscal
responses, a member-only demographic explorer and household-weighted national
elections. This is a constructed gameplay electorate, **not** real population
microdata or a scientific election projection. See
[household simulation](docs/HOUSEHOLD_SIMULATION.md).

The complete product is not yet accepted. Current gaps include operational
publication of ten real-news dossiers each week, real multi-browser end-to-end
Auth verification, editorial QA, demographic calibration, economic simulation
depth, and design/art direction acceptance. Automated unit and SQL integration
tests are necessary but not sufficient to certify a finished game.

## Immutable synthetic voter opinion history

Active multiplayer matches record one server-generated, immutable projection
per UTC day through the existing calendar job. Party trends, recorded gaps,
and district comparisons appear in the electoral panel; official election
results stay separate. See [daily opinion observatory](docs/DAILY_OPINION_OBSERVATORY.md).

## Asynchronous political action inbox

Every player receives a member-scoped, persistent in-game brief covering
pending ballots, political positions, government decisions, weekly campaign
activity, coalition invitations, election results and Friday acts. Read
receipts are independent of completing actual political actions. See
[political activity inbox](docs/POLITICAL_ACTIVITY_INBOX.md).

## Weekly accountability and historic political acts

Multiplayer assemblies have a member-protected historical ledger of
approved news, executive decisions, party positions, parliamentary votes,
elections and certified Friday balances. Weekly dossiers expire on Friday
but remain available for read-only historical analysis. See the
[weekly accountability operations](docs/WEEKLY_ACCOUNTABILITY.md) guide.

## Multiplayer invitation and ready-check lifecycle

Hosts may require every current party to confirm readiness before beginning
an assembly. Guests can leave open lobbies and vacated seats are reusable.
Shareable invitation links survive email magic-link authentication. See
[lobby participation and invitations](docs/MULTIPLAYER_LOBBY.md).

## Editorial weekly production cycle

Authorized editors can source ten news references, prepare fictional policy
alternatives, save revisioned drafts and hand all ten to the publisher for
source-by-source review. Publishing needs ten current attestations, while
staff administration is protected and audited. See
[newsroom operations and secure bootstrap](docs/EDITORIAL_OPERATIONS.md).

## Territorial representation

Six persistent fictional constituencies now allocate 100 parliamentary seats
through separate D'Hondt tallies derived from the synthetic household
electorate. The population dashboard includes regional political response;
the election dashboard shows detailed forecasts and certified immutable
territorial results. See
[territorial election mechanics](docs/TERRITORIAL_ELECTIONS.md).

## Public multiplayer matchmaking

The multiplayer screen allows users to find opt-in public matches and join
them as distinct political parties without exchanging codes. Private lobbies
remain private by default. The host can enable discovery before starting the
game. All joins are authorized and seat allocations remain atomic.
See [matchmaking operations](docs/PUBLIC_MATCHMAKING.md).

## Weekly editorial sourcing

Authorized staff can open /editorial and use the ten-source preparation
action to populate untouched Monday dossiers from six trusted news feeds.
Human fact-checking, balanced decision authoring, explicit saving and the
independent publication transaction remain mandatory. No unverified story
is automatically published. See
[editorial batch sourcing](docs/EDITORIAL_BATCH_SOURCING.md).

## Set up

Requires Node.js 22, npm, and a **separate** Supabase project reserved for ACT OF STATE.

1. Clone this repository and run \`npm ci\` (uses the committed integrity-checked lockfile).
2. The dedicated Akumanomi ACT OF STATE project has the approved game migrations applied. For a **new empty** isolated project, apply all versioned files under \`supabase/migrations/\` in order using the approved migration workflow. Do **not** apply them again to this project, Anvil Fitness, Moncloa-AI, or production databases of other products.
3. Enable the Supabase Auth email provider with password sign-in; allowlist the frontend origin, the multiplayer/editorial redirect routes and approved invitation URLs. Email confirmation/recovery still needs SMTP. See `docs/PASSWORD_ACCESS.md`.
4. Copy \`.env.example\` to \`.env.local\`; set \`VITE_SUPABASE_URL\` and \`VITE_SUPABASE_PUBLISHABLE_KEY\` from the dedicated project. These are browser-safe public values, never a service-role/secret key.
5. Run \`npm run dev\` and open the shown local URL.
6. Register once with an email and password (confirm the email if the provider requires it); return with the same password. Existing link-only accounts can use the optional access link once to set a password. A government is seeded on the first authenticated solo session and persists for the same account.
7. Open either fictional introductory dossier, select an option, review its authored fiscal commitment, then explicitly sign one decision. Reload: the same choice and calculated state must remain persisted; duplicate RPC execution must not apply twice.

## Verification

- `npm run typecheck` — TypeScript.
- `npm test` — React flow and outcome rendering from persisted event fixtures.
- `npm run test:oracle` — dependency-free deterministic calculation oracle.
- `npm run build` — production frontend bundle.
- `supabase/tests/decision_flow.sql`, `world_snapshot.sql`, `historical_decision.sql`, `weekly_release.sql`, `editorial_workflow.sql` and `multiplayer_ten_party.sql` — rollback-only database assertions covering ownership, budget atomicity, retry safety, cross-account isolation, and durable history. Execute only in a dedicated disposable environment where inserting test users is permitted.
- `supabase/tests/access_contract.sql` — explicit table privileges, RPC execution grants, and RLS assertions.
- E2E (manual until provisioned): sign-in, seed, dossier retrieval, decision, reload, retry and account isolation. Verify responsive/mobile and keyboard navigation.

GitHub Actions quality CI runs on pull requests to `main` or manually. A separate path-filtered PostgreSQL 17 integration workflow runs only when SQL migrations/tests or its workflow change (or on manual invocation), limiting extra CI minutes. It creates a disposable database, applies every migration, executes RLS/privilege assertions and the rollback integration suites, then verifies that no synthetic users or game state remain. The CI-only `ci_auth_adapter.sql` emulates role/JWT lookup for plain PostgreSQL; it is **not** real Supabase Auth and must never be applied to Supabase Cloud. Authenticated browser E2E and approved preview hosting remain release blockers.

## Ten-party shared-nation multiplayer

Open `/multiplayer` after configuring Supabase Auth's magic-link redirect for that origin. One authenticated account hosts a match, receiving a 32-character invite code and government seat 1. Up to nine different authenticated accounts join with unique party names. The host starts the match when at least two parties have joined; the ten seats remain visible to all members. Each member can record a single immutable dossier stance with a deterministic `policy-affinity-v1` cohort score. This is **policy affinity, not an election forecast or vote share**. The government proposes one dossier option to Parliament. Every seated party casts one immutable yes/no/abstain ballot. A six-of-ten absolute majority approves immediately; otherwise, after all ballots or a 24-hour deadline, quorum of at least five and more yes than no are required. A rejected measure may be replaced. Only an approved option can be signed by the host: a database trigger rejects any attempt to bypass the parliamentary mandate, including direct calls to the original decision RPC. Every member reads the same persisted votes, result, national state and history. The shared world refreshes every 15 seconds and on demand.

All match mutations/readbacks go through authenticated PostgreSQL RPCs. The private match tables have RLS and no direct browser Data API table grants. A match is bound to one host-owned government; in this foundation each account can host only one government and therefore one match. There is no matchmaking, live push transport, campaigning, negotiation, AI-controlled party, or automated electoral outcome yet.

### Honest ten-user test gate

The `supabase/tests/multiplayer_ten_party.sql` rollback-only suite creates ten synthetic Auth identities and verifies create/join/start, ten-seat cap, eleventh-user rejection, outsider denial, duplicate retries, stance affinity, binding ten-party ballots, prohibited cabinet bypass, host-only execution after approval, and the shared post-decision national state. CI also checks RLS and RPC grants. **This is an integration simulation, not ten human browsers online.**

To accept real ten-user play, provision ten distinct authorized test email accounts, allow the preview domain as an Auth redirect, open ten independent browser sessions, join by code, exercise both host and opposition actions, reload, and confirm identical persisted national data with no cross-match leakage. Run this against the dedicated ACT OF STATE DEV/preview environment only. Until this succeeds, multiplayer is `PARTIAL`.

## Boundaries

- One real day = one in-game day, derived from server UTC date.
- A trusted editor can prepare and approve a complete ten-item weekly slate; it becomes visible automatically on Monday UTC. The Friday milestone is an informational persisted-decision readout, not yet a binding closure/settlement.
- Real-news collection, independent editorial verification, electoral calculation and daily economic ticks: **not implemented**.
- Two introductory fictional dossiers are provided; neither represents real-world current events. Weekly fixtures appear only inside rollback tests.
- One government per authenticated owner during MVP; one match per hosted government, up to ten parties.
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


## Editorial control room (AOS-MVP-001, editorial macroincrement)

The independent staff workbench is served at **\`/editorial\`** by the same React application, without a new frontend dependency. It supports ten stable dossier slots for a Monday UTC publication, source provenance, 2–4 political options per dossier, versioned simulation inputs, draft autosafety through explicit save, revision conflict reporting, final two-step review and published read-only state. It does **not** ingest or assert that any source is true. The journalist/editor must verify the news externally.

Database migrations \`aos_013\`–\`aos_015\` add:

- \`editorial_members\` with explicit \`editor\`/\`publisher\` membership; only an operator using trusted database privileges may provision staff.
- \`editorial_weeks\` with durable JSONB drafts, optimistic revision compare-and-swap, row-level security and 150 KB bounded payloads.
- \`save_editorial_week\` for staff-only draft persistence.
- \`publish_editorial_week\` for publisher-only atomic materialization of exactly ten dossiers and options, followed by the existing release approval gate. Retrying a completed publication does not reapply effects.

**Provisioning:** first, the staff member must sign in using their own legitimate email magic link. An authorized operator then looks up their verified \`auth.users.id\` in the dedicated ACT OF STATE DEV project and inserts their UUID and designated role into \`public.editorial_members\`. The browser cannot grant itself editorial permission. At least one \`publisher\` must be provisioned for an actual publication; this has **not** been done in DEV.

Configure the frontend origin and \`<origin>/editorial\` as permitted Supabase Auth redirect URLs. The browser needs only the project URL and publishable key, **never** a service-role secret.

\`supabase/tests/editorial_workflow.sql\` is rollback-only: it checks denied nonmember writes, editor/publisher separation, partial draft save, stale revision refusal, atomic publication, a safe repeated request, immutable published weeks, and invalid option rollback. \`supabase/tests/access_contract.sql\` extends RLS/grant assertions to both new tables and RPCs.

There is no live news, no seeded staff user, no deployment and no authenticated browser E2E claim. The next gate is an authorized preview environment plus real email/role verification across a clean user session.

Migration `aos_016` indexes the three Auth-user foreign keys on the editorial audit rows. Supabase performance advisors were rechecked after this change.

## Parliamentary legislation macroincrement (AOS-019)

Migration `20261023150000_aos_019_parliamentary_mandate.sql` adds persistent bills and immutable per-party votes. Migration `20261023150100_aos_020_parliament_fk_indexes.sql` covers the new foreign keys for efficient joins and cascading cleanup. A host-only proposal creates a 24-hour ballot; match members vote via authenticated RPCs. The tally is serialized under a PostgreSQL row lock, and a mandatory `decision_events` trigger prevents the government from signing a non-approved option in an active match. Reads and mutations require membership; bills and votes have RLS and no direct browser table grants. Rejected legislation may be reproposed, while approved legislation cannot be replaced.

The `/multiplayer` screen now renders the proposal, counts, deadline, recorded vote, result and signing authorization. Browser state is refreshed from the server after every mutation and every 15 seconds. The PostgreSQL integration suite exercises ten identities, outsider denial, immutable retries, proposal replay, rejection/reproposal and decision atomicity; its concurrent runner first passes a bill and then races ten identical cabinet decisions. These tests do not substitute for ten real authenticated browsers.

**Still outside MVP acceptance:** real ten-user browser playtest, full electoral simulation and campaigning, real-news ingestion/editorial operation, Friday settlement/daily economic ticks and visual/accessibility sign-off. The game must not be described as feature-complete until those gates pass.


## AOS-027 — National treasury and fiscal policy

The government and multiplayer views now include a read-only macroeconomic dashboard and an incumbent-only budget control. Cabinet policy assigns percentages to healthcare, education, infrastructure and security, with one bounded weekly revision and a synthetic tax-pressure setting. The calendar closes each full Friday on Saturday UTC, posting versioned receipts, expenditure, debt financing, macro indicators and cohort responses without requiring a browser session. The model explicitly does not represent calibrated real-world economic forecasts.

- Backend migration: `supabase/migrations/20261023200000_aos_027_national_fiscal_engine.sql`.
- RPCs: `get_fiscal_state(uuid)` and `set_fiscal_policy(uuid,int,int,int,int,int)`; never access the underlying private tables from frontend code.
- Playability/security: solo owner or current elected multiplayer cabinet can modify a policy; opposition can inspect it but cannot edit. One policy revision per UTC week; retries and Cron settlements are idempotent.
- Regression coverage: `supabase/tests/national_fiscal.sql` and `supabase/tests/persistent_cross_session.sh` run in the SQL integration job; `src/FiscalPanel.test.tsx` and `tests/browser-smoke.mjs` cover React and actual headless Chromium with intercepted HTTP. The browser tests do **not** authenticate real players or send real email.
- UX regression artifacts: the PR Quality workflow captures screenshot evidence in GitHub Actions artifacts, with a seven-day retention.
- Operator manual: `docs/NATIONAL_FISCAL_OPERATIONS.md`. Strict requirements tally: `docs/MVP_TRACKER.md`.

The custom SMTP/Auth free-tier quota remains a real onboarding blocker. No secret, fake token or privileged credential used in testing is embedded in the deployed frontend.

## National decision analytics (AOS-028)

Solo and multiplayer governments now share an expandable strategic archive of server-persisted cabinet acts. It shows signed fiscal, approval and institutional-trust deltas, before/after state, group-specific support changes and 7/30-day UTC filters. This is **decision attribution**, not an economic forecast or a full ledger: autonomous fiscal settlement is intentionally excluded. The UI uses only the existing authorized world snapshot. See [decision analytics rules](docs/DECISION_ANALYTICS.md).
