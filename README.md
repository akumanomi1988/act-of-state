# ACT OF STATE

**Every decision shapes a nation.**

Free-to-play, browser-based, persistent political simulation. This codebase is independent from Moncloa-AI.

## Current implementation (AOS-MVP-001)

The React/TypeScript frontend uses Supabase Auth and displays only state returned from PostgreSQL. The database holds owner-bound governments, fictional versioned dossiers, weighted population cohorts, decision events and a deterministic, server-authoritative simulation engine.

**Deployment status:** not deployed. The dedicated ACT OF STATE Supabase project has not been provisioned. Code and SQL are committed; database, browser integration and security tests are not yet verified on a live instance. Do not connect this application to any other product's database.

## Set up

Requires Node.js 22, npm, and a **separate** Supabase project reserved for ACT OF STATE.

1. Clone this repository and run \`npm install\`.
2. In the dedicated ACT OF STATE project, apply \`supabase/migrations/20261022000000_foundation.sql\` using the approved migration workflow. Review the SQL before execution. Do **not** apply it to Anvil Fitness, Moncloa-AI, or production databases of other products.
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
