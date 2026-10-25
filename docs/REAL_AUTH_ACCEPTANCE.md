# AOS-045 — Real Auth + shared-legislature acceptance (disposable)

## Why this milestone exists

AOS-044 and earlier releases exercised SQL role adapters and mocked browser HTTP.
Those are useful unit and security tests but do **not** test a real GoTrue JWT
through the real Kong/PostgREST gateway. AOS-045 introduces an **entire new
integration boundary** without connecting to or mutating the hosted game.

## Complete real-protocol scenario

The GitHub Actions job `.github/workflows/live-auth-acceptance.yml` starts an
**unlinked local Supabase stack** using `supabase/config.toml`. The config is
deliberately local-only, with email/password signup auto-confirmed to avoid
sending emails to third parties, a loopback API and a loopback game origin.
It applies the tracked game migrations in their original order.

The script `tests/real-auth-acceptance.mjs` refuses any HTTP target other
than `http://127.0.0.1:54321` and refuses runs outside CI. It never accepts
or uses a service-role or hosted project secret. Eleven fake local identities
are registered through **real GoTrue signup** and get real signed Auth JWTs,
which must validate against `auth.getUser()`.

The workflow then verifies through **real authenticated HTTP/PostgREST**:

1. One genuine account creates the persistent match and obtains the protected
   invite code; nine other JWT accounts join concurrently. The game is exactly
   ten unique seats, while the eleventh account is rejected. A non-host cannot
   activate the legislature or read its private state.
2. The host starts the match; a repeat start preserves its original timestamp.
3. Ten distinct accounts sign a policy stance and another account retrieves
   the same immutable shared records. No application-side fake server state.
4. Only the host proposes the binding parliamentary measure. Four 'no' and six
   'yes' votes are committed by distinct real-JWT accounts, followed by
   persisted tally inspection and the actual parliamentary mandate.
5. The host signs the endorsed policy. Treasury changes **once** and the exact
   immutable event is visible to another JWT account. Repeating the same
   submission returns the original act; attempting a different option is
   refused. Unauthorized accounts cannot fetch or alter the government.
6. Two **separate Chromium browser contexts** use real validated GoTrue
   sessions, load the real Vite frontend against the local API and demonstrate
   cabinet/opposition privilege-aware panels, ten populated seats, a signed
   national act, reload persistence, responsive widths and axe WCAG A/AA
   (critical/serious violations blocked). The screenshots are retained by CI.

## Verified release evidence — 25 October 2026

- [Merged implementation PR #38](https://github.com/akumanomi1988/act-of-state/pull/38), commit `52af59fb7855baa111c146b9cbc5b3215e40d839`.
- [Real protocol CI #40209127443](https://github.com/akumanomi1988/act-of-state/actions/runs/40209127443) **green**. Runner reported `AOS_LIVE_AUTH_PASS` with **11 genuine disposable signed-up Auth accounts, 10 distinct party participants, real HTTP/PostgREST, 1 immutable cabinet act, 2 genuine JWT browser contexts and 92 passed assertions**.
- [Existing quality regression #40209127442](https://github.com/akumanomi1988/act-of-state/actions/runs/40209127442) **green**, including TypeScript, build, Vitest, Chromium mock-HTTP smoke and demo accessibility.
- All tracked migrations applied to a local database. Job destroyed its local Supabase containers and records. **The hosted Cloud project was not accessed.**
- **Unverified:** actual email-link delivery/production OAuth redirect, human use by ten independently consenting participants, editorial review of ten sourced real weekly stories, real hosted HTTP navigation and final product/visual acceptance. Strict acceptance remains **2/18**, despite stronger protocol E2E evidence.

## Scope boundaries

- All users and data live only inside ephemeral local containers. Closing the
  job destroys the containers and data; nothing is migrated to production.
- Auth is **real signed JWT** with GoTrue and PostgREST. Email addresses end in
  `@example.invalid` and signups are autoconfirmed locally. This does not
  test external SMTP delivery, email provider settings in production or real
  user consent.
- Chromium actually contacts local Supabase HTTP, not intercepted mocks.
  However, only **two** of the ten live JWT identities are exercised through
  browser UI; the other eight use the HTTP client library. That is not a
  ten-human usability/operational acceptance test.
- No real weekly news is published. The scenario uses the original immutable
  fictional intro dossier, never fabricated current-events material.
- The new workflow may require a warm Docker image cache / more than the
  lighter PostgreSQL jobs. Explicit timeouts and failure diagnostics are kept.
- The strict MVP completion tally must change **only after the new end-to-end
  job is green and the acceptance gate's documented independent requirements
  are fully met**. A code commit or mock-run alone has no acceptance value.

## Running manually in an isolated local workstation

Use the tracked `supabase/config.toml`; do not link it to any hosted project.

```bash
npm ci
supabase start -x studio,analytics,vector,imgproxy,storage,realtime,edge-runtime,inbucket
supabase status -o env  # copy API_URL and ANON_KEY into the local shell only
npm install --no-save --package-lock=false playwright@1.56.1 axe-core@4.10.3
CI=true VITE_SUPABASE_URL="$API_URL" VITE_SUPABASE_PUBLISHABLE_KEY="$ANON_KEY" npm run dev -- --host 127.0.0.1 --port 4173
# In another shell: CI=true API_URL="$API_URL" ANON_KEY="$ANON_KEY" node tests/real-auth-acceptance.mjs
supabase stop --no-backup
```

Do not set `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD` or any linked
project ref in this workflow. The separate disposable PostgreSQL CI remains
the canonical deep row-lock and migration regression gate.
