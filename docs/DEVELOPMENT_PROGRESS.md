# ACT OF STATE — Engineering development progress

Updated 2026-10-26. This is the primary development metric going forward.
The old 2/18 = 11.1% is **strict commercial acceptance**, NOT coding progress.

## Rules and denominator

The **18 original MVP-F/T/V requirements** are decomposed into **4 named,
sequential, binary checkpoints each (72 total)**, committed in
`data/development-progress.json`. Completion is **checked milestones / 72**
rounded to one decimal; 1 milestone equals about 1.39 percentage points.
Every line item has descriptive source-file evidence. This is a transparent,
equal-weight *engineering-coverage index*, not a prediction of developer
hours or a guarantee of market readiness. Checkpoints can only move when the
specific capability is verified; incomplete work receives no fractional credit.

Never add speculative new tickets to inflate this metric. Only change its
scope and historical comparisons with a documented product-scope revision.
Maintain separate snapshots for `main` and CI-green but not merged work.

## First defensible baseline

| Snapshot | Git SHA | Completed | Engineering |
| --- | --- | ---: | ---: |
| AOS-049 `main` | `1cb55f26fc5f813a349a146a3bb2df498ceea157` | 52/72 | **72.2%** |
| AOS-052 validated development | `92c626675dc70f6faecd80520e41558784e19edc` | 56/72 | **77.8%** |
| Delta | Same fixed checklist | +4 milestones | **+5.6 pp** |

These numbers compare **two named snapshots**, not all of the previous
thirty iterations. No trustworthy per-commit values have been reconstructed
for earlier work.

## Requirements: original scope and completed checkpoints

| Original ID | Domain | main | AOS-052 branch | Source example |
| --- | --- | ---: | ---: | --- |
| MVP-F001 | Persistent government access | 2/4 | 4/4 | `src/App.tsx` |
| MVP-F002 | Dossiers and policy options | 2/4 | 3/4 | `docs/FOUNDATIONAL_GOVERNMENT_PROGRAMME.md` |
| MVP-F003 | Persistent political decisions | 4/4 | 4/4 | `supabase/tests/decision_flow.sql` |
| MVP-F004 | Population and households | 3/4 | 3/4 | `docs/HOUSEHOLD_SIMULATION.md` |
| MVP-F005 | National social and fiscal state | 3/4 | 3/4 | `docs/NATIONAL_FISCAL_OPERATIONS.md` |
| MVP-F006 | Political calendar | 3/4 | 3/4 | `docs/CALENDAR_OPERATIONS.md` |
| MVP-F007 | Elections and campaigns | 3/4 | 3/4 | `docs/ELECTION_RULES.md` |
| MVP-F008 | Ten-party multiplayer | 3/4 | 3/4 | `docs/MULTIPLAYER_LOBBY.md` |
| MVP-T001 | Transactional persistence | 4/4 | 4/4 | `supabase/tests/disposable_restore.sh` |
| MVP-T002 | Authentication and isolation | 3/4 | 4/4 | `docs/REAL_AUTH_ACCEPTANCE.md` |
| MVP-T003 | Deterministic outcomes | 4/4 | 4/4 | `tests/reference-simulation.test.mjs` |
| MVP-T004 | Concurrency and retries | 4/4 | 4/4 | `supabase/tests/multiplayer_concurrency.sh` |
| MVP-T005 | Automated quality | 3/4 | 3/4 | `.github/workflows/quality.yml` |
| MVP-T006 | Release operations | 3/4 | 3/4 | `docs/PRODUCTION_RELEASE_RUNBOOK.md` |
| MVP-V001 | Visual brand | 1/4 | 1/4 | `src/styles.css` |
| MVP-V002 | Playable interfaces | 3/4 | 3/4 | `src/App.tsx` |
| MVP-V003 | Responsive accessibility | 2/4 | 2/4 | `tests/browser-smoke.mjs` |
| MVP-V004 | Visual QA | 2/4 | 2/4 | `.github/workflows/quality.yml` |

AOS-052 adds two F001 login/recovery milestones, one F002 authored
programme milestone and one T002 real-Auth password lifecycle milestone.
The 18 added fictional dossiers are *one* relevant completion milestone,
not 18 artificial checklist increments.

## Three numbers, not one misleading number

1. **Development engineering coverage: 77.8%** on the green unmerged
   development branch. Recompute using `npm run progress` (or
   `npm run progress -- --json`).
2. **Development merged into `main`: 72.2%** under the same fixed checklist;
   not a claim about current hosted Vercel build/version.
3. **Strict commercial acceptance: 11.1% (2/18)**. External SMTP,
   independent human editorial reporting, real ten-person week, empirical
   balance, production monitoring/recovery and art/accessibility sign-off
   remain unaccepted.

CI evidence for AOS-052:
[Quality](https://github.com/akumanomi1988/act-of-state/actions/runs/40289759998),
[SQL](https://github.com/akumanomi1988/act-of-state/actions/runs/40289760102),
[GoTrue/Auth E2E](https://github.com/akumanomi1988/act-of-state/actions/runs/40289760066).
The AOS-052 migration has NOT been applied to hosted Supabase; production
Vercel has NOT been updated or approved.

## Report every new macroiteration this way

Record the before and after commit SHAs, update only proved named checkpoints,
run `npm run progress` plus the tracked tests, and report
**development before / development after / delta (pp) / accepted gates**.
Call out changes that improve robustness but close no fixed checkpoint.
Keep branch/release status separate. A deployment is never needed solely to
increase this engineering percentage.
