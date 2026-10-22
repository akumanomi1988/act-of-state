# ACT OF STATE — MVP EXECUTION TRACKER

Canonical repository: \`akumanomi1988/act-of-state\` | Branch: \`main\` | Iteration: AOS-MVP-001 | Phase: P01 Foundation

Criteria are marked DONE only if implementation **and appropriate runtime verification** exist. Repository code alone = PARTIAL. UNKNOWN is used when evidence is absent.

| ID | Scope | Status | Evidence and remaining verification |
| --- | --- | --- | --- |
| MVP-F001 | Government session recovery | PARTIAL | \`start_government\`; isolated Supabase integration pending |
| MVP-F002 | Structured dossier choices | PARTIAL | Versioned fictional \`energy-resilience\` seed and UI |
| MVP-F003 | Authorized, idempotent persistent decisions | PARTIAL | Transaction RPC + unique constraint; DB testing pending |
| MVP-F004 | Synthetic cohort population model | PARTIAL | 65/35 weighted model; DB verification pending |
| MVP-F005 | National state variables | PARTIAL | Persisted treasury, approval and trust snapshots |
| MVP-F006 | Daily/weekly game calendar | PARTIAL | UTC server day implemented; Monday/Friday scheduler TODO |
| MVP-F007 | Election calculations | TODO | Future increment |
| MVP-F008 | Async multiplayer isolation | PARTIAL | Owner isolation designed; parallel-user testing pending |
| MVP-T001 | Transactional persistence | PARTIAL | PostgreSQL function + atomic event; no live test |
| MVP-T002 | Authentication and authorization | PARTIAL | Email OTP, RLS, narrow RPC grants; penetration testing pending |
| MVP-T003 | Versioned deterministic rules | PARTIAL | \`weighted-cohorts-v1\` and persisted params |
| MVP-T004 | Concurrency, retry safety | PARTIAL | Per-government FOR UPDATE + unique event; concurrent calls not load-tested |
| MVP-T005 | Automated quality | PARTIAL | React component and SQL integration fixtures; tests not run |
| MVP-T006 | Operations/deployment | TODO | Separate Supabase project, lockfile, CI and release setup |
| MVP-V001 | Approved identity | PARTIAL | Provisional institutional tokens; approved art not recovered |
| MVP-V002 | Dashboard, dossier and outcome | PARTIAL | React components committed; runtime validation pending |
| MVP-V003 | Responsive/accessibility | PARTIAL | Responsive CSS, semantics, focus, errors; audit pending |
| MVP-V004 | Visual acceptance | TODO | Manual screenshot comparison with approved assets pending |

## Confirmed product boundaries

Free-to-play browser game. 1 real day = 1 in-game day. Ten Monday dossiers and a Friday weekly milestone in future increments. Deterministic synthetic population; no LLM on outcome calculation; no purchasable advantages. Serious cinematic institutional visual direction. Moncloa-AI is excluded.

## Implementation evidence

- SQL schema and policy design: \`supabase/migrations/20261022000000_foundation.sql\`.
- Database assertions ready to execute: \`supabase/tests/decision_flow.sql\`.
- Browser flow: \`src/App.tsx\`, \`src/lib/game.ts\`, \`src/components/Outcome.tsx\`.
- Rendering fixture test: \`src/components/Outcome.test.tsx\`.
- Approved complete design source files unavailable; tokens provisional.

## Open blockers and next action

1. Create/select a dedicated ACT OF STATE Supabase project (never reuse Anvil Fitness).
2. Install dependencies and generate/commit \`package-lock.json\`, then run TypeScript, unit and build verification.
3. Apply SQL migration only to dedicated project; execute SQL regression tests in disposable test context, review RLS and grants.
4. Configure Auth redirects and execute real browser E2E including duplicate and unauthorized access.
5. Review responsive/accessibility and design assets; capture acceptance screenshots.
6. Add weekly calendar, publication and Friday settlement as later increments.

Progress: GLOBAL MVP UNKNOWN; P01 UNKNOWN; AOS-MVP-001 PARTIAL. No speculative percentages.

## AOS-MVP-001 verification hardening

- Every decision now stores the exact chosen option parameters in `parameters_snapshot` alongside `engine_version` and historical before/after snapshots. Enables defensible retrospective audits even if the editorial catalog later changes.
- SQL integration assertions include golden national/cohort values, exact parameter snapshot, direct-write denial and missing-JWT denial; NOT YET EXECUTED against PostgreSQL.
- `tests/reference-simulation.test.mjs` is a pure offline specification oracle and is NOT the authoritative backend. Six tests pass locally using Node 22; database parity still requires integration execution.

- **Logical decision integrity:** uniqueness is now `(government_id, dossier_id)` regardless of dossier editorial version. A different version/option cannot reapply effects. SQL regression covers replay on version 2. Frontend reflects decision history across versions.
- **Auth resiliency:** login/logout request rejection now releases UI pending state in `finally` and surfaces an error.
