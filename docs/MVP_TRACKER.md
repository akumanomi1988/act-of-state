# ACT OF STATE — MVP EXECUTION TRACKER

Canonical repository: \`akumanomi1988/act-of-state\` | Branch: \`main\` | Iteration: AOS-MVP-001 | Phase: P01 Foundation

Criteria are marked DONE only if implementation **and appropriate runtime verification** exist. Repository code alone = PARTIAL. UNKNOWN is used when evidence is absent.

| ID | Scope | Status | Evidence and remaining verification |
| --- | --- | --- | --- |
| MVP-F001 | Government session recovery | PARTIAL | \`start_government\`; isolated Supabase integration pending |
| MVP-F002 | Structured dossier choices | PARTIAL | Versioned fictional \`energy-resilience\` seed and UI |
| MVP-F003 | Authorized, idempotent persistent decisions | PARTIAL | Transaction RPC + unique constraint SQL checks PASS; browser E2E pending |
| MVP-F004 | Synthetic cohort population model | PARTIAL | 65/35 weighted model verified via SQL golden fixtures; household-detail expansion future |
| MVP-F005 | National state variables | PARTIAL | Persisted treasury, approval and trust snapshots |
| MVP-F006 | Daily/weekly game calendar | PARTIAL | UTC server day implemented; Monday/Friday scheduler TODO |
| MVP-F007 | Election calculations | TODO | Future increment |
| MVP-F008 | Async multiplayer isolation | PARTIAL | Owner isolation designed; parallel-user testing pending |
| MVP-T001 | Transactional persistence | PARTIAL | PostgreSQL transaction and durable event tests PASS on isolated DB |
| MVP-T002 | Authentication and authorization | PARTIAL | Email OTP, RLS, narrow RPC grants; penetration testing pending |
| MVP-T003 | Versioned deterministic rules | DONE | \`weighted-cohorts-v1\` and persisted params |
| MVP-T004 | Concurrency, retry safety | PARTIAL | Per-government FOR UPDATE + unique event; concurrent calls not load-tested |
| MVP-T005 | Automated quality | PARTIAL | SQL integration tests executed; frontend build/component tests remain unexecuted |
| MVP-T006 | Operations/deployment | TODO | Isolated Supabase ACTIVE; lockfile, CI build, browser deployment still pending |
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

1. Dedicated ACT OF STATE Supabase project provisioned in Akumanomi and migrations applied (never reused Anvil Fitness).
2. Install dependencies and generate/commit \`package-lock.json\`, then run TypeScript, unit and build verification.
3. Apply SQL migration only to dedicated project; execute SQL regression tests in disposable test context, review RLS and grants.
4. Configure Auth redirects and execute real browser E2E including duplicate and unauthorized access.
5. Review responsive/accessibility and design assets; capture acceptance screenshots.
6. Add weekly calendar, publication and Friday settlement as later increments.

Progress: GLOBAL MVP 1/18 verified; P01 percentage UNKNOWN; AOS-MVP-001 PARTIAL. No speculative percentages.

## AOS-MVP-001 verification hardening

- Every decision now stores the exact chosen option parameters in `parameters_snapshot` alongside `engine_version` and historical before/after snapshots. Enables defensible retrospective audits even if the editorial catalog later changes.
- SQL integration assertions include golden national/cohort values, exact parameter snapshot, direct-write denial and missing-JWT denial; NOT YET EXECUTED against PostgreSQL.
- `tests/reference-simulation.test.mjs` is a pure offline specification oracle and is NOT the authoritative backend. Six tests pass locally using Node 22; database parity still requires integration execution.

- **Logical decision integrity:** uniqueness is now `(government_id, dossier_id)` regardless of dossier editorial version. A different version/option cannot reapply effects. SQL regression covers replay on version 2. Frontend reflects decision history across versions.
- **Auth resiliency:** login/logout request rejection now releases UI pending state in `finally` and surfaces an error.

## AOS-MVP-001 — Publication privacy gate

- Authenticated Data API RLS now limits dossier visibility to the server-controlled UTC publication interval.
- Dossier options cannot be read until their parent dossier is visible.
- The SECURITY DEFINER decision RPC enforces the same date boundary itself.
- Weekly dossiers must have an explicit Monday publication date; they cannot be silently exposed before scheduling.
- Added disposable SQL fixtures for future, published and unpublished decision rejection.
- **Verification status: PARTIAL**. SQL changes committed but not applied to a dedicated ACT OF STATE database. No real integration PASS asserted.

## AOS-MVP-001 — Live backend integration on 2026-10-23

- Authorized organization: `akumaNoDev` (Supabase `mtzspolfhqqsrwvmmqol`); project `Act-of-state`, reference `nwlxkqwbusrrldveijzb`, eu-central-1. This project already existed and required no new project creation.
- Applied via Supabase migration API: `20261023050112_aos_001_foundation`, `20261023050305_aos_002_restrict_event_trigger_execute`, `20261023050408_aos_003_index_decision_dossier_fk`.
- Executed `supabase/tests/decision_flow.sql` on the project in a rollback transaction; returned without SQL errors. Assertions cover recovery, ownership/RLS, invalid choices, idempotent retries, version replay, synthetic cohort results, golden values and embargo visibility.
- Post-test state checked: zero governments/cohorts/events, 1 fictional dossier, 3 options, all five tables RLS enabled.
- Access control independently inspected: `anon` cannot execute `start_government`, `submit_decision`, or `rls_auto_enable`; `authenticated` can execute intended game functions.
- Supabase performance linter: no findings after covering index. Security linter: 2 documented intentional `authenticated` SECURITY DEFINER RPC WARN notices; no anonymous privileged RPCs.
- Static/backend integration supports the server side, but frontend compilation, live email login, visual QA and E2E remain open. **No full iteration acceptance yet.**
- MVP-T001 (backend transactions): PARTIAL — SQL transaction and rollback assertions verified; committed read-across-sessions persistence could not be exercised.
- MVP-T003 (deterministic/versioned backend): DONE — offline reference fixtures and SQL golden comparisons verified.
- Global MVP: 1/18 acceptance criteria currently verified (MVP-T003). Overall phase percentage UNKNOWN; AOS-MVP-001 PARTIAL.

## Post-deployment verification limitation

A targeted attempt on 2026-10-23 to create a **committed** disposable synthetic Auth user and test read-after-write persistence across SQL calls was blocked by connector safety controls; it was **not executed**. Cleanup and count verification returned zero synthetic users, governments and decision events. Do not interpret the earlier rolled-back SQL integration script as a persisted login/browser E2E success.

Current next acceptance gate: use the normal Supabase Auth email-link flow with an explicitly approved non-production test account and correctly configured redirect origins, then verify persisted government/decision state across browser reloads. No security bypass or direct Auth user insertion is authorized to substitute for this gate.
