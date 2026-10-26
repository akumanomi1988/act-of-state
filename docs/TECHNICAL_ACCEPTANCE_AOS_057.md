# AOS-057 — Independently reproduced technical acceptance

Acceptance reviewed: 2026-10-26. Target: isolated, writable development
branch akumanomi1988/act-of-state, not main or production.

The original 18 criteria and 100 weighted points have not changed.
Previous accepted score: 10. New accepted score: 23 (+13 pp).
These are engineering acceptance gates only.

## MVP-T002 (5/5) — Authentication and tenant isolation

Verified local GoTrue/PostgREST: 10 real authenticated disposable identities,
separate party JWTs, cross-match read/write denials, owner-scoped government
operations, editorial permission boundaries and persistent password login.
Evidence: https://github.com/akumanomi1988/act-of-state/actions/runs/40374320426
SQL privilege/RLS: https://github.com/akumanomi1988/act-of-state/actions/runs/40374320610
Production SMTP deliverability and manual login UX remain release gates, NOT
part of this technical account-isolation criterion.

## MVP-T004 (4/4) — Idempotency and concurrency

Serializable/locked national signatures, unchanged exact network retries,
conflicting-choice refusal, 10-player parliamentary seat capacity, campaigns
and elections, rollback-only SQL state transitions and synthetic parallel
match HTTP reads passed without race-induced failures.
Evidence: https://github.com/akumanomi1988/act-of-state/actions/runs/40374320610
and https://github.com/akumanomi1988/act-of-state/actions/runs/40374320426
Deployment-scale hosted load is NOT included and remains a release gate.

## MVP-T005 (4/4) — Automated QA toolchain

Node 24 build + TypeScript + 237 Vitest tests + 32 reference oracles,
PostgreSQL migrations/integrity suites, Chromium responsive and WCAG smoke
and authenticated browser/GoTrue acceptance on the immutable AOS-056
commit. New optional MCP integration separately passes six protocol tests.
Evidence: https://github.com/akumanomi1988/act-of-state/actions/runs/40374320579
https://github.com/akumanomi1988/act-of-state/actions/runs/40374320610
https://github.com/akumanomi1988/act-of-state/actions/runs/40374320426
https://github.com/akumanomi1988/act-of-state/actions/runs/40375192373

## Ineligible for automatic acceptance

All MVP-F001..F008 remain NOT_ACCEPTED because the broad product criteria
have not all been observed in human play, complete weekly real-news editing
and published operation. MVP-T006 and all REL gates remain NOT_ACCEPTED.
Do not infer functional completion % by treating 23% as functional coverage.
