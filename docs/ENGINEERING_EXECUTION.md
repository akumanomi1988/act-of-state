# ACT OF STATE — Engineering execution checkpoint

Updated: 2026-10-27. Working branch: `feature/aos-053-mandate-observatory`.
This is a development branch. No Vercel deployment, production migration or
merge to `main` is authorized by routine development work.

## Current verified baseline

- AOS-053 HEAD before this increment: `89960e4ac12838e2448aa0c03076501adb712f39`.
- Existing green checks for that SHA: Quality 40300708247,
  PostgreSQL 40300707983, local real Auth 40300708167.
- Complexity-weighted engineering completion (primary): 65.9% (850/1290) according to a documented original-scope rubric.
- Implementation evidence coverage (secondary): 56/72 explicit checkpoints (77.8%).
- Audited full commercial acceptance: 1/18 original requirements (5.6%).
  The earlier 2/18 figure incorrectly credited T001 despite its open hosted
  backup restore checkpoint; no implemented functionality was removed.
- The two figures are **not equivalent**. Do not advance either without
  corresponding executable/operational evidence.
- Release remains behind the development branch; changes here do not imply
  rollout. Follow `docs/NO_VERCEL_AUTODEPLOY.md`.

## Current engineering increment — authoritative report consistency

- [x] Reject even adjacent distinct UTC dates in combined mandate sources.
- [x] Reject invalid calendar days and cross-government fiscal/welfare joins.
- [x] Ignore superseded overlapping background reads in the mandate UI.
- [x] Add pure aggregate and React regression cases.
- [x] Prior observatory concurrency/date increment verified at `ed3cb8f`:
      Quality #40470913528, PostgreSQL #40470913572, local real Auth #40470913546.
- [ ] Current evidence-boundary increment: reject malformed fiscal and polling
      responses (cross-government acts, impossible dates, negative seats,
      invalid reconciliation metrics, time-window violations).
- [ ] Validate the final new SHA with Quality, PostgreSQL and local real Auth;
      preserve immutable event/seat acceptance invariants.

## Current engineering increment — election and accountability isolation (2026-10-27)

- [x] Reject invalid certified election acts, district/party seat divergence,
      forged dates and cross-match electoral history at the API boundary.
- [x] Reject inconsistent legislative Friday reports, duplicate parties or
      dossiers and future/backdated political acts.
- [x] Order election polling and action reconciliation by route generation and
      request revision so a superseded response never overwrites a new party.
- [x] Include independently executable contract and React race regressions.
- [ ] Verify the new commit via Quality, PostgreSQL integrity and isolated
      GoTrue/PostgREST; no live nation, mail or production deployment.

## Current engineering increment — scoped shared-nation snapshots (2026-10-27)

- [x] Verify multiplayer government ID, authenticated participant membership,
      host identity, unique seats, dossier-option relations and immutable event scopes.
- [x] Preserve archived historical stances while rejecting foreign-match users.
- [x] Verify UTC calendar week, Friday closure and noncontradictory official counts.
- [x] Add direct client-contract regressions for mismatched identities and acts.
- [ ] Confirm final Quality, isolated GoTrue and PostgreSQL results for this SHA.

## AOS-054 — versioned synthetic demographic balance correction

- [x] Diagnose v1 joint age/income structural bias (three empty cells).
- [x] Define v2 independent full-cycle demographic rank permutations and
      decoupled district/political-cohort allocation; preserve 300 family
      identities, synthetic cohort/district mass, and election seat invariants.
- [x] Detect and prevent structurally single-cohort districts in new worlds,
      with all six territories containing both synthetic political cohorts.
- [x] Migrate only **future** seeds; v1 households and signed historical
      election results remain untouched and identifiable.
- [x] Add rollback-only PostgreSQL contingency, backward-compatibility
      and electoral test matrix, plus client contract tests.
- [ ] Verify the **exact** final GitHub commit against all three CI
      workflows and record receipts. Do not credit F004.4 from synthetic
      validation alone: empirical balance review remains outstanding.

## AOS-055 — independent editorial sign-off integrity (2026-10-27)

- [x] Fail-closed SQL review/publish authorization when the latest revision
      was saved by the same person attempting to certify or publish it.
- [x] Preserve optimistic revision invalidation, immutable prior weekly
      releases and privilege-isolated reader identity.
- [x] Add same-author denial plus different-person acceptance to transactional
      publication tests; update real local GoTrue inter-account flow and UI.
- [x] PostgreSQL #40563951804 PASS, Quality #40563951681 PASS,
      isolated GoTrue #40563951715 PASS at 138429dc.
- [x] Surface the same independence rule in the final confirmation control,
      including the case of ten historically saved self-attestations.
- [ ] Reverify the final UI guard commit in all exact-commit CI workflows.
      Staffed fact-checking against actual independent news citations remains
      an external acceptance gate.

## Remaining original-product acceptance gates

The pending technical evidence is in `docs/development-coverage.json`.
Do not count the following as implemented merely because a plan or local
simulation exists.

| Gate | Outstanding independent evidence |
| --- | --- |
| F001.4 | Hosted password/recovery on two actual devices |
| F002.4 | One fact-checked, real sourced editorial publishing week |
| F003.4 | Hosted identity-isolated browser decision and reload journey |
| F004.4 | Calibrated population archetypes with explicit balance evidence |
| F006.4 | Observed full hosted multiple-week calendar and publications |
| F007.4 | Human campaign/90-day election balance acceptance |
| F008.4 | Seven-day ten-human-party multiplayer session |
| T001.4 | Provider-backed live backup and tested authorized restore |
| T002.4 | Hosted SMTP/password recovery and independent security review |
| T004.4 | Hosted concurrent-play abuse/load and independent assessment |
| T005.4 | External hosted complete cross-account end-to-end release QA |
| T006.4 | Hosted SLO monitoring, alert ownership and backup drill |
| V001.3 | Distinctive final artwork accepted for release |
| V001.4 | Human commercial visual direction sign-off |
| V003.4 | Keyboard/assistive-technology end-to-end human acceptance |
| V004.4 | Independent real-mobile visual QA and art sign-off |

## Release-independent work and constraints

1. Preserve existing RLS, authoritative Postgres decisions, immutable electoral
   acts and calendar UTC settlement invariants.
2. Run quality, database and GoTrue workflows only for coherent development
   milestones. Never force Vercel builds; no direct production writes.
3. For each failed check, repair cause and rerun on the **new** commit; record
   real CI run IDs. Do not label a feature verified from tests on an older SHA.
4. Hosted and human gates require genuine evidence; placeholders, fake news,
   synthetic ten-player replay and no-op SMTP cannot satisfy them.
5. Before any release: review migrations/auth compatibility, protect identity
   and fiscal event history, verify backup restoration, run independent
   acceptance and obtain explicit deployment authorization.

## Known external test limitations in this execution environment

- The temporary shell has no GitHub DNS route; repository mutation uses
  authenticated GitHub connector and disposable validation uses GitHub Actions.
- Hosted private Supabase/Vercel credentials, live SMTP, provider-managed
  backup restoration and physical human sign-offs cannot be certified by local
  mocked or isolated CI tests.
- A passing GitHub workflow demonstrates only its actual recorded scope.
