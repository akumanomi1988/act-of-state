# ACT OF STATE — Deterministic remaining-work checkpoint (AOS-057)

Branch: aos/050-national-reforms-campaign
Repository: akumanomi1988/act-of-state
Last delivered subsystem: AOS-057 local MCP stdio bridge.
Completion scoring file: docs/product-completion.json (100 fixed points).
Unreleased: no Supabase Cloud changes and no new Vercel production deploy.

## Remaining highest-impact integrated work, in execution order

1. AOS-058: Full bilingual ES/EN player-facing navigation, scenario choices,
   onboarding, government cabinet, Parliament, editor, email/password and
   accessible mobile layouts; real browser language persistence tests.
2. AOS-059: Authenticated real-news editorial run: ten independently
   fact-checked sourced articles on Monday, five unique choices each,
   publisher/reviewer accountability, Friday Parliament and signed archival
   consequences. Needs authorized operator + genuine reviewed sources.
3. AOS-060: Multi-week balance and gameplay progression, observer-verified
   non-synthetic players from different accounts, elections and opposition
   turnovers, diplomacy, fiscal/social effects, abusive voting and deadlines.
4. AOS-061: Persistent operational staging: authorized Supabase migrations,
   backups/restores/rollback, mail deliverability, production webhook and
   scheduler verification, load/abuse testing and production release gates.
5. AOS-062: UX/accessibility and localization acceptance from actual users;
   regression closure, commercial release checklist and controlled release.

## Known external dependencies

- Publisher identity and real editorial fact-checking cannot be synthesized.
- Hosted database migrations, credentials, external email and deployment
  require authorized operator roles and explicit production release policy.
- Human playtests cannot be replaced with fake JWT success.

## Resume without guessing

1. Check branch HEAD, clean worktree and latest GitHub actions first.
2. Reconcile the fixed 100-point acceptance baseline; never reweight.
3. Run npm ci, npm run typecheck, npm test, npm run test:oracle, npm run build.
4. Run cd mcp && npm ci && npm test for the separate MCP package.
5. Only then implement AOS-058 from the current branch. Commit/push on
   the branch after verifiable tests. Do not auto-deploy Vercel.
