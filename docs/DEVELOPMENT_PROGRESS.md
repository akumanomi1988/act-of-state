# ACT OF STATE — Verifiable implementation coverage

> Primary weighted engineering completion: **65.9%**. Equal-checkpoint implementation coverage: **56/72 (77.8%)** on AOS-053. Strict commercial acceptance: **2/18 (11.1%)**.

## Before / after

| Metric | AOS-052 | AOS-053 | Delta |
| --- | ---: | ---: | ---: |
| Complexity-weighted engineering completion | 60.6% (782/1290) | 65.9% (850/1290) | +5.3 pp |
| Equal-checkpoint implemented & evidenced | 75.0% (54/72) | 77.8% (56/72) | +2.8 pp |
| Full commercial acceptance | 11.1% (2/18) | 11.1% (2/18) | 0.0 pp |

## Rules and boundaries

- Scope is the **18 original MVP requirements** (F001–F008, T001–T006, V001–V004).
- Every requirement has **four fixed, individually named, binary technical delivery checkpoints**.
- Primary completion multiplies documented original-area complexity by checkpoint acceptance effort (1, 2, 3, 4), with **no partial credit**.
- Equal-checkpoint coverage keeps exactly **1/72** per proof as a backward-compatible secondary metric; do not mix it with weighted completion.
- A verified checkpoint requires an existing tracked code/test/specification file plus reviewed engineering evidence. Existence of a file alone is insufficient; CI independently validates executable artifacts.
- Pending checkpoints do not count. In particular, hosted operations, real reviewed news, ten human participants and human visual approval are not silently assumed.
- Weights are a documented planning rubric, **not measured engineering hours**; 100% requires all 72 independently accepted checkpoints.
- Neither indicator proves a commercially finished game or replaces external/human product sign-off.
- Current branch AOS-053 is not automatically deployed. The AOS-050 production schema/authentication transition and release remain separate.
- Future milestones should retain the checkpoint IDs, credit new achievements to their milestone and replace prior entries only with an explicit change explanation.

## Capability coverage by original requirement

| Original area | Completed / defined | Percent |
| --- | ---: | ---: |
| Gameplay & simulation | 25/32 | 78.1% |
| Engineering & reliability | 19/24 | 79.2% |
| Visuals & interface | 12/16 | 75.0% |

## Checkpoint-by-checkpoint evidence

### MVP-F001 — Persistent government session (3/4)

- [x] Persistent per-owner nation and account session — file: `src/lib/game.ts` (AOS-052)
- [x] Password-first login and registration across routes — file: `src/AuthGateway.tsx` (AOS-052)
- [x] Authenticated password reset, change and safe logout — file: `src/AccountSecurity.tsx` (AOS-052)
- [ ] Externally verified hosted two-device password/account recovery — pending

### MVP-F002 — Dossiers and policy options (3/4)

- [x] Ten foundational permanent government dossiers — file: `docs/FOUNDATIONAL_GOVERNMENT_PROGRAMME.md` (AOS-052)
- [x] Eighteen reform dossiers and 54 policy options — file: `src/lib/nationalProgramme.ts` (AOS-052)
- [x] Ten-case sourced editorial draft and reviewed publishing workflow — file: `src/EditorialApp.tsx` (AOS-052)
- [ ] One independent real-news reviewed and published editorial week — pending

### MVP-F003 — Persistent validated decisions (3/4)

- [x] Server-authorized fiscal/political decision transaction — file: `supabase/migrations/20261023050112_aos_001_foundation.sql` (AOS-052)
- [x] Immutable signed event ledger and deterministic safe retry — file: `supabase/tests/decision_flow.sql` (AOS-052)
- [x] Real-auth cabinet signature, archived result and reload acceptance — file: `tests/real-auth-acceptance.mjs` (AOS-052)
- [ ] Hosted production browser decision journey with independent identities — pending

### MVP-F004 — Synthetic households and cohorts (3/4)

- [x] Three hundred generated synthetic households — file: `supabase/migrations/20261024104835_aos_031_synthetic_households.sql` (AOS-052)
- [x] Six constituencies and resident-weighted party support — file: `supabase/migrations/20261024132435_aos_034_constituency_elections.sql` (AOS-052)
- [x] Daily welfare feedback by household and income segment — file: `supabase/migrations/20261024201821_aos_040_daily_living_conditions.sql` (AOS-052)
- [ ] Empirically calibrated population archetypes with documented balance review — pending

### MVP-F005 — National state and economy (4/4)

- [x] Tax/allocation budget and weekly treasury settlement — file: `supabase/migrations/20261023200000_aos_027_national_fiscal_engine.sql` (AOS-052)
- [x] Persistent debt, GDP-index, unemployment and inflation model — file: `src/lib/fiscal.ts` (AOS-052)
- [x] Daily welfare model linked to actual fiscal inputs — file: `src/lib/livingConditions.ts` (AOS-052)
- [x] Cross-system 90-day mandate observatory and 12-week stress regression — file: `src/lib/mandateObservatory.ts` (AOS-053)

### MVP-F006 — Daily and weekly calendar (3/4)

- [x] Trusted server-owned UTC day and cron settlement — file: `supabase/migrations/20261023180000_aos_023_autonomous_calendar.sql` (AOS-052)
- [x] Monday editorial opening and Friday immutable closure — file: `supabase/tests/weekly_release.sql` (AOS-052)
- [x] Due vote, election and fiscal processing with recovery — file: `supabase/tests/autonomous_calendar.sql` (AOS-052)
- [ ] Observed complete multiweek hosted calendar with real source publications — pending

### MVP-F007 — Elections and campaigns (3/4)

- [x] Six-district deterministic 100-seat D'Hondt elections — file: `supabase/tests/districts.sql` (AOS-052)
- [x] Weekly persuasion, explicit blackout and decaying influence — file: `supabase/tests/campaign_decay.sql` (AOS-052)
- [x] Certified election acts and cabinet succession — file: `src/ElectionPanel.tsx` (AOS-052)
- [ ] Human-tested 90-day campaign balance and multiparty election cycle — pending

### MVP-F008 — Asynchronous multiplayer (3/4)

- [x] Ten-party invite/public lobby and readiness — file: `src/MultiplayerApp.tsx` (AOS-052)
- [x] Mandate-weighted Parliament, votes and binding cabinet signature — file: `src/ParliamentPanel.tsx` (AOS-052)
- [x] Coalitions, confidence motions and cabinet handover — file: `src/GovernancePanel.tsx` (AOS-052)
- [ ] Complete seven-day session with ten independent human parties — pending

### MVP-T001 — Transactional persistence (3/4)

- [x] Versioned PostgreSQL schema with scoped access — file: `supabase/migrations/20261023050112_aos_001_foundation.sql` (AOS-052)
- [x] Committed acts persist across independent server connections — file: `supabase/tests/decision_flow.sql` (AOS-052)
- [x] Isolated dump/restore of immutable signed acts and permissions — file: `supabase/tests/disposable_restore.sh` (AOS-052)
- [ ] Provider-backed hosted backup and complete restore acceptance — pending

### MVP-T002 — Authentication and isolation (3/4)

- [x] Owner/member RLS and private privileged read/write contracts — file: `supabase/tests/access_contract.sql` (AOS-052)
- [x] Real local GoTrue password and ten-party authenticated UI — file: `tests/real-auth-acceptance.mjs` (AOS-052)
- [x] Recovery, logout and reused identity across applications — file: `src/AccountSecurity.test.tsx` (AOS-052)
- [ ] Production SMTP, login, recovery and independent security signoff — pending

### MVP-T003 — Deterministic versioned outcomes (4/4)

- [x] Independent deterministic simulation oracle — file: `tests/reference-simulation.test.mjs` (AOS-052)
- [x] Golden database scenario and model contract checks — file: `supabase/tests/decision_flow.sql` (AOS-052)
- [x] Versioned campaign/electoral result compatibility — file: `supabase/tests/campaign_decay.sql` (AOS-052)
- [x] Preserved archival policy outcomes across migrations — file: `supabase/tests/historical_decision.sql` (AOS-052)

### MVP-T004 — Safe retries and concurrency (3/4)

- [x] Atomic duplicate decision and contradictory replay safeguards — file: `supabase/tests/decision_flow.sql` (AOS-052)
- [x] Concurrent ten-party admissions and ballot isolation — file: `supabase/tests/multiplayer_concurrency.sh` (AOS-052)
- [x] Front-end uncertain-signature reconciliation against server — file: `src/MultiplayerApp.tsx` (AOS-052)
- [ ] Sustained hosted concurrent-play load/abuse envelope and independent audit — pending

### MVP-T005 — Automated quality and regression (3/4)

- [x] Typed production build and component regression test suite — file: `src/App.test.tsx` (AOS-052)
- [x] Disposable PostgreSQL ordered migration and integration suite — file: `supabase/tests/national_fiscal.sql` (AOS-052)
- [x] Responsive Chromium, axe and authenticated local real-HTTP QA — file: `tests/browser-smoke.mjs` (AOS-052)
- [ ] External hosted end-to-end release QA with independent participants — pending

### MVP-T006 — Operations and deployment (3/4)

- [x] Reproducible GitHub quality/integrity actions — file: `scripts/release-contract.mjs` (AOS-052)
- [x] Server scheduler, retries and private failure diagnostics — file: `docs/CALENDAR_OPERATIONS.md` (AOS-052)
- [x] Immutable release stamp, status page and disposable restore runbook — file: `docs/PRODUCTION_RELEASE_RUNBOOK.md` (AOS-052)
- [ ] Sustained hosted SLO monitoring, backup recovery and alert ownership — pending

### MVP-V001 — Brand identity (2/4)

- [x] Coherent dark visual palette and typography — file: `src/styles.css` (AOS-052)
- [x] Consistent public wordmark and accessible app branding — file: `src/App.tsx` (AOS-052)
- [ ] Approved final artwork and distinctive brand asset family — pending
- [ ] Human-approved commercial visual direction — pending

### MVP-V002 — Core dashboard and dossier UX (4/4)

- [x] Interactive national government dashboard — file: `src/App.tsx` (AOS-052)
- [x] Shared Parliament and ten-party dashboard — file: `src/MultiplayerApp.tsx` (AOS-052)
- [x] Historical decision/fiscal/political detail views — file: `src/DecisionAnalyticsPanel.tsx` (AOS-052)
- [x] Joined 7/30/90-day political, fiscal and social mandate dashboard — file: `src/MandateObservatory.tsx` (AOS-053)

### MVP-V003 — Responsive accessibility (3/4)

- [x] Responsive multi-viewport layouts and mobile controls — file: `src/styles.css` (AOS-052)
- [x] Automated 390px and desktop browser overflow checks — file: `tests/browser-smoke.mjs` (AOS-052)
- [x] Automated serious/critical WCAG violation checks and semantic UI — file: `tests/browser-smoke.mjs` (AOS-052)
- [ ] Human keyboard-only and assistive-technology end-to-end signoff — pending

### MVP-V004 — Visual consistency and QA (3/4)

- [x] Shared UI style system for government and assembly — file: `src/styles.css` (AOS-052)
- [x] Screenshots retained from responsive Chromium flows — file: `tests/browser-smoke.mjs` (AOS-052)
- [x] Automated interactive component regressions for multiple routes — file: `src/MultiplayerApp.test.tsx` (AOS-052)
- [ ] Independent visual QA on real mobile devices and human art signoff — pending

## Reproducible computation

- Score source of truth: `docs/development-coverage.json`.
- Calculation and evidence existence guard: `node scripts/development-progress.mjs`.
- Regenerate: `node scripts/development-progress.mjs --write`.
- CI drift check: `node scripts/development-progress.mjs --check`.
- Independent regression: `node --test tests/development-progress.test.mjs`.
- Baseline: AOS-052; new checkpoints in AOS-053 are explicitly labeled in the scorecard.
- Current CI receipts: https://github.com/akumanomi1988/act-of-state/actions/runs/40293220246 · https://github.com/akumanomi1988/act-of-state/actions/runs/40293220248 · https://github.com/akumanomi1988/act-of-state/actions/runs/40293220228.

## Complexity-weighted engineering completion

- **Primary weighted progress:** 850/1290 = **65.9%**.
- Earlier AOS-052 baseline: 782/1290 = 60.6%; AOS-053 genuine delta: +5.3 percentage points.
- Every area has a stable complexity multiplier (4–12) and a written rationale below; stages 1–4 earn **1 / 2 / 3 / 4 effort units** respectively once evidence is verified.
- Stage 1 covers the core foundation, stage 2 feature behavior, stage 3 cross-system integration, and stage 4 full operational/external acceptance. The original checkpoint descriptions are authoritative.
- An unverified stage contributes zero. The rubric is an explicit comparative planning judgement, not logged work hours, a performance benchmark or an independently audited cost model.
- Equal-checkpoint historical coverage stays 56/72 = 77.8% for comparison; strict commercial signoff remains 2/18. Changing weights alone does not credit any new requirement.

| Original requirement | Complexity multiplier | Verified weighted points | Total weighted points | Completion | Rationale |
| --- | ---: | ---: | ---: | ---: | --- |
| MVP-F001 | 6 | 36 | 60 | 60.0% | Persistence and password identity across authenticated user journeys |
| MVP-F002 | 9 | 54 | 90 | 60.0% | Foundational content, authored reforms and reviewed weekly editorial operations |
| MVP-F003 | 9 | 54 | 90 | 60.0% | Authoritative transactions, audit history, retries and cross-account acceptance |
| MVP-F004 | 9 | 54 | 90 | 60.0% | Population cohorts, six districts and calibrated daily reactions |
| MVP-F005 | 10 | 100 | 100 | 100.0% | Integrated fiscal engine, economic state, daily impact and long-run diagnostics |
| MVP-F006 | 8 | 48 | 80 | 60.0% | UTC scheduling, deadlines, recovery and real elapsed calendar operation |
| MVP-F007 | 10 | 60 | 100 | 60.0% | District election certification, campaigning, cabinet succession and balance |
| MVP-F008 | 12 | 72 | 120 | 60.0% | Ten-party asynchronous membership, legislation, voting and human week |
| MVP-T001 | 6 | 36 | 60 | 60.0% | Transactional versioning, immutable persistence and disaster recovery |
| MVP-T002 | 7 | 42 | 70 | 60.0% | Identity isolation, credential lifecycle, transport and independent security audit |
| MVP-T003 | 5 | 50 | 50 | 100.0% | Deterministic simulation, compatibility and archival invariants |
| MVP-T004 | 6 | 36 | 60 | 60.0% | Concurrent decisions, race conditions, idempotency and hosted abuse envelope |
| MVP-T005 | 5 | 30 | 50 | 60.0% | Build gates, independent database and end-to-end coverage |
| MVP-T006 | 7 | 42 | 70 | 60.0% | Scheduled operations, release parity, SLOs and disaster readiness |
| MVP-V001 | 4 | 12 | 40 | 30.0% | Visual language, unique assets and external art approval |
| MVP-V002 | 7 | 70 | 70 | 100.0% | Core solo/multiplayer experience and joined retrospective dashboards |
| MVP-V003 | 5 | 30 | 50 | 60.0% | Responsive access, assistive technology and keyboard-only acceptance |
| MVP-V004 | 4 | 24 | 40 | 60.0% | Cross-device design consistency, regression evidence and external visual review |

Weights are kept in `docs/development-coverage.json`, checked by CI, and must be explicitly re-baselined if the approved product scope changes.
