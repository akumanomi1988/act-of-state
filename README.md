# ACT OF STATE

**Every decision shapes a nation.**

Free-to-play, browser-based, persistent political simulation. This codebase is independent from Moncloa-AI.

## Current implementation (AOS-MVP-001)

The React/TypeScript frontend uses Supabase Auth and displays only state returned from PostgreSQL. The database holds owner-bound governments, fictional versioned dossiers, weighted population cohorts, decision events and a deterministic, server-authoritative simulation engine.

**Deployment status:** frontend not deployed. The dedicated Akumanomi Supabase project `Act-of-state` (`nwlxkqwbusrrldveijzb`, eu-central-1) now hosts the migrated schema. SQL integration assertions were executed in rolled-back transactions; browser E2E and real email authentication remain unverified. Never connect this application to Anvil Fitness.

## Set up

Requires Node.js 22, npm, and a **separate** Supabase project reserved for ACT OF STATE.

1. Clone this repository and run \`npm install\`.
2. The dedicated Akumanomi ACT OF STATE project already has all three migrations applied. For a **new empty** isolated project, apply the three versioned files under \`supabase/migrations/\` in order using the approved migration workflow. Do **not** apply them again to this project, Anvil Fitness, Moncloa-AI, or production databases of other products.
3. Enable Supabase Auth email magic-link sign in and configure the permitted redirect URL for this frontend origin.
4. Copy \`.env.example\` to \`.env.local\`; set \`VITE_SUPABASE_URL\` and \`VITE_SUPABASE_PUBLISHABLE_KEY\` from the dedicated project. These are browser-safe public values, never a service-role/secret key.
5. Run \`npm run dev\` and open the shown local URL.
6. Log in via email link; a government and exactly two representative cohorts are seeded on first successful session. Returning players resume the same government.
7. Open the fictional energy dossier and sign one decision. Reload: the same choice and calculated state must remain persisted; duplicate RPC execution must not apply twice.

## Verification

- \`npm run typecheck\` — TypeScript.
- \`npm test\` — outcome rendering from persisted event fixtures.
- \`npm run build\` — production frontend bundle.
- \`supabase/tests/decision_flow.sql\` — disposable database integration assertions covering session recovery, ownership, invalid options, one-time effects, and history. The SQL script wraps fixtures in \`BEGIN/ROLLBACK\`. Execute only in a dedicated disposable environment where inserting test users is permitted.
- E2E (manual until provisioned): sign-in, seed, dossier retrieval, decision, reload, retry and account isolation. Verify responsive/mobile and keyboard navigation.

Automated CI is deliberately opt-in through a pull request or manual invocation to avoid unnecessary GitHub Actions consumption. Dependency versions are pinned in \`package.json\`; a lockfile has not yet been generated in this network-restricted environment and is a release blocker.

## Boundaries

- One real day = one in-game day, derived from server UTC date.
- Ten Monday dossiers, Friday weekly cycle, elections and scheduled ticks: **not implemented**.
- An introductory fictional dossier is provided; it does not represent real-world current events.
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

Run `npm run test:oracle` independently of npm dependencies. These six tests specify the exact three option outcomes and numeric rounding for `weighted-cohorts-v1`. They ran successfully under Node 22 during source preparation, but **do not replace PostgreSQL integration tests**. Every persisted decision also retains `parameters_snapshot` for reproducibility.

### Editorial embargo invariant

Weekly dossiers require an explicit Monday `available_from` date (UTC). The authenticated Data API cannot read dossiers or option rows before publication; the privileged mutation validates the same window. Week-specific dossiers must use distinct stable IDs to allow new decisions in subsequent weeks. This still does not implement the ten-dossier Monday scheduler or Friday resolution.

## Backend connection (Akumanomi)

Dedicated Supabase project: `Act-of-state`, reference `nwlxkqwbusrrldveijzb`. The publishable key is obtainable via Supabase Dashboard > Project Settings > API Keys. **Never commit a secret/service-role key.**

Applied migrations (the filenames below match the actual remote migration history):

- `20261023050112_aos_001_foundation.sql` — schema, RLS, deterministic RPC, introductory content.
- `20261023050305_aos_002_restrict_event_trigger_execute.sql` — revoke publicly executable pre-provisioned event-trigger function.
- `20261023050408_aos_003_index_decision_dossier_fk.sql` — FK covering index.

Security advisors show two intentional authenticated `SECURITY DEFINER` RPC warnings: `start_government()` and `submit_decision()`. Both are explicitly granted only to `authenticated`, inspect `auth.uid()`, and restrict to the owning government; `anon` execute is denied. This is a documented least-privilege exception, not a suppressed warning. [Supabase remediation guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable). Performance advisors return no issues.

Last observed: 5 RLS-protected game tables; 1 fictional dossier; 3 decision options; 0 user governments, 0 decision events after test rollback.

**Remaining browser setup:** add the selected localhost/preview origin to Supabase Auth URL Configuration; provide project publishable key in `.env.local` or deployment environment; verify real email link and return session flow.
