# AOS-049 — Production release assurance, capacity and recovery

## Scope and guarantees

AOS-049 repairs the AOS-048 Vercel build-rate-limit outage and introduces
automatic public evidence for the exact deployed commit. It also adds a
self-service non-authenticated status screen, repeated ten-JWT read concurrency
under real local PostgREST, and an independent PostgreSQL recovery exercise.

This is **not** a production Auth sign-in check, a seven-day human playtest,
a staffed news-review week, a contracted backup, a production performance
capacity guarantee or proof of real SMTP deliverability.

## Immutable release identity

`npm run build` invokes `node scripts/release-contract.mjs --emit` first.
The script verifies that the committed database migration includes both
`electoral-districts-v2` and `campaign-decay-v2`. It then writes
`public/release.json` (ignored in Git) for Vite to copy to `dist/release.json`.

The static manifest contains **only** product ID, schema, Git SHA, build time,
expected game-model versions and public SPA routes. Never include an API
secret, Auth token, game data or user email. Production Vercel must provide
a concrete `VERCEL_GIT_COMMIT_SHA`; the production build fails closed
rather than inventing a commit. Local builds are deliberately marked
`commit:null` if no verifiable SHA is available.

The `/status` route is accessible without login. It loads the manifest
with no caching and performs one public Auth health request only when the
Supabase URL is valid. It does not send the session, JWT, password, service
key or user data. It distinguishes unavailable health probes from true
confirmed availability, and prominently states it cannot certify SMTP
delivery, database health or a particular saved game.

## Automatic hosted release checks

Every application release to `main` triggers
`.github/workflows/public-release.yml`. A bounded retry loop allows Vercel
to complete deployment, then `scripts/check-public-release.mjs` fetches
`https://act-of-state.vercel.app/release.json` and requires its SHA to
match **exactly** the actual GitHub `main` commit. It verifies:

1. The JSON manifest is not an HTML rewrite or a cached prior version.
2. The declared election/campaign models match the versioned source.
3. Six public entry points (`/`, `/demo`, `/guide`,
   `/multiplayer`, `/editorial`, `/status`) all serve the real app.
4. The referenced fingerprinted Vite JavaScript asset exists and has
   JavaScript MIME, not an HTML fallback.
5. The checker only contacts the approved ACT OF STATE Vercel domains,
   or disposable local test hosts. Redirects and credential-bearing
   target URLs are rejected.

Rerun after any manual deploy with:

```bash
AOS_PUBLIC_BASE_URL=https://act-of-state.vercel.app \
AOS_EXPECT_SHA=<full-reviewed-main-commit> \
node scripts/check-public-release.mjs
```

A passing build or a Vercel `READY` state by itself does not certify that
the **production alias** serves that build. Only the immutable hosted check
can verify parity. Never quietly relax the expected commit to pass the check.

## Build-rate-limit recovery

AOS-048 initially left Supabase at `electoral-districts-v2` while the
frontend remained on AOS-047 due to Vercel Hobby build-rate-limit failures.
The operator restored parity by deploying the exact reviewed AOS-048 merge
commit `572712cb9dab112b62dc4ceee5d5a2fd4f270134` directly through
the authenticated Vercel Git connection, verifying `READY`, `production`
and assignment to `act-of-state.vercel.app`.

If a later push is rate-limited, do not create a succession of empty commits.
Check Vercel's build queue and limits, publish **one** reviewed Git SHA
via Vercel when capacity permits, then confirm `release.json` matches
that SHA. If the backend is incompatible, prevent further schema changes
or restore an approved compatible frontend. Any rollback requires explicit
schema compatibility confirmation; never reverse committed game acts.

## Disaster recovery in disposable CI

`supabase/tests/disposable_restore.sh` only runs if `CI=true`,
`PGHOST=localhost`, `PGPORT=5432` and `PGDATABASE=aos_test`.
It inserts **two synthetic Auth users** and commits one real government
decision. A physical separate PostgreSQL database is then created from
a `pg_dump -Fc` / `pg_restore` snapshot.

Independent restored connections verify immutable event identity,
treasury, idempotent replay, cross-account RLS isolation and closed
privileged table grants. Original synthetic users, the restored database,
and temporary dump are deleted on exit. This never touches the hosted
Supabase database or claims to replace production backups. Restore scripts
must never be pointed at an existing team/project DB.

## Reproducible ten-party load envelope

The existing isolated GoTrue/PostgREST suite starts ten genuinely signed
players, casts binding parliamentary votes and commits one government act.
AOS-049 then launches **80 concurrent player reads** in bounded batches
(60 match-world reads, 20 six-district election reads) and ten extra denied
outsider requests. The snapshot may not lose any vote, player, signed act,
treasury state or election seat. It records actual p50/p95/worst round-trip
times and fails if p95 exceeds 15 seconds or if a response disagrees.

The reported sample is a **CI smoke baseline**, not an SLA for a hosted
commercial population. Measurements are not extrapolated to real-time
thousands of accounts, weeks of player traffic or multi-region access.

## Next operational acceptance

- Human-approved SMTP and multi-account hosted end-to-end browser sign-in.
- A genuine staffed ten-source news cycle; no `example.invalid` fixture
  is a real news article.
- Long-running UTC day/Friday closure observation under production
  traffic, with alarm checks and a documented recovery window.
- Live backup and restore exercise subject to provider controls, an
  independently authorized disposable target and retention requirements.
- Human visual review, manual keyboard/screen-reader sign-off and
  measured long-term game balance.

The strict acceptance numerator cannot increase merely because the new
CI, local restore and public deployment checks pass.

## Verified pre-merge evidence (2026-10-25)

- [Quality workflow](https://github.com/akumanomi1988/act-of-state/actions/runs/40230726583):
  192/192 Vitest, 41 suites, 15 main Chromium E2E cases, 2 guest
  viewports and 2 additional `/status` Chromium/WCAG AA viewports;
  release metadata source and manifest contract checked.
- [Database integrity](https://github.com/akumanomi1988/act-of-state/actions/runs/40230726599):
  AOS_DISPOSABLE_RESTORE_PASS and AOS_CONCURRENCY_PASS. The native
  PostgreSQL 16 client on hosted GitHub runners cannot dump PostgreSQL
  17; the final drill uses `postgres:17-alpine` official Docker
  clients to avoid server/client version mismatch without changing the
  production database.
- [Real signed-JWT acceptance](https://github.com/akumanomi1988/act-of-state/actions/runs/40230726582):
  AOS_MATCH_LOAD_PASS 80 authorized reads / 0 failures / p50 21 ms /
  **p95 105 ms** / worst 119 ms and 10 denied outsider probes in a
  disposable local stack; 138 total real-JWT assertions, 26 local
  Mailpit-email checks and 60 synthetic newsroom checks.
- **Not yet claimed**: the new AOS-049 exact hosted release parity.
  Do not mark it verified until the final merged commit has a Vercel
  production deployment AND the public route/JS SHA checker passes.
