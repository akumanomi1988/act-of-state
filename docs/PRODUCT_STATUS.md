# ACT OF STATE — Current product inventory

Updated 2026-10-27. AOS-057 adds calibrated synthetic demographic profiles to the CI-verified AOS-053 branch; this development build is not yet released. Implementation is distinguished from final acceptance.
The game is browser-based, free to play, with no paid competitive advantages.

## Measured development coverage (the game actually implemented)

| Score | AOS-053 (before) | AOS-057 (current) | Change |
| --- | ---: | ---: | ---: |
| **Complexity-weighted engineering completion** | **65.9% (850/1290)** | **68.7% (886/1290)** | **+2.8 pp** |
| Equal-checkpoint evidence coverage | 56/72 = 77.8% | 57/72 = 79.2% | +1.4 pp |
| Audited full commercial acceptance | 1/18 = 5.6% | 2/18 = 11.1% | +5.5 pp |

The **primary weighted completion percentage** assigns each of the 18 original
requirements a published complexity multiplier and weights its four accepted
checkpoints 1/2/3/4 by delivery/operational burden. The earlier 72-point
unweighted measure remains visible for continuity, not as the primary score.
Every credited deliverable has an evidence path in
[the reproducible coverage matrix](DEVELOPMENT_PROGRESS.md). It deliberately
does not award points for unfinished features or mere code volume. New AOS-053
points are cross-system mandate analytics and 12-week economy diagnostics
(F005.4) and the integrated political strategy dashboard (V002.4).

**11.1% (2/18)** is the separate, strict commercial acceptance indicator: it requires
hosted operations, real newsroom publication and external/human signoff where
the original product contract demands them. Neither figure is a measured
estimate of remaining engineering hours. This score covers the isolated
**development branch**; live production is behind until authorized release.

| System | Implemented | Remaining acceptance / development |
|---|---|---|
| Access | Password-first Auth, explicit registration, one-time legacy email link, password recovery/change, session recovery and isolation (AOS-050 feature branch) | CI acceptance, production password/SMTP settings, real hosted signup and human multi-account acceptance |
| Player onboarding | Public /guide manual, contextual solo/multiplayer steps from server state, recovery guidance | Observe first-time human players; adjust based on usability evidence |
| Solo government | Persistent nation, 10 founding decisions + 18 additional authored reform dilemmas (development branch), server-authoritative outcomes and archived acts | Integrated CI and hosted real-Auth acceptance, product balancing |
| Population | 300 households, INE-source demographic proxies for new games, legacy v1/v2 preservation and six districts | Political behaviors remain fictional; F007.4 human election testing is separate |
| Daily society | Economic security, services, welfare, bounded political feedback, immutable daily records | Multi-day operational observation and gameplay balancing |
| Fiscal engine | Treasury, debt, GDP index, inflation, unemployment, budget revisions, immutable weekly acts and isolated 12-week bankruptcy/issuance regression (AOS-053) | Empirical economic calibration, hosted 90-day observation and extreme-policy balancing |
| Weekly dossiers | Ten-slot newsroom, source discovery, draft revision control, manual review and atomic publication | Actual reviewed news for every operational week; staff operation |
| Time | One real UTC day per game day, Monday publication windows, Friday closure, autonomous jobs | Sustained live operation across week boundaries |
| Multiplayer | Up to ten parties, private invitations/public discovery, lobby withdrawal and readiness | Ten actual accounts and a human playtest |
| Party positions | Immutable member positions and political affinity | Balance feedback from actual players |
| Parliament | Weighted votes, proposal windows, binding approval before cabinet execution; permanent reform agenda supported | Full human government/opposition flow |
| Elections | Household electorate, six constituencies, 100 D'Hondt seats, immutable certification, cabinet succession | Electoral and campaign balance; human acceptance |
| Campaigns | Weekly party interventions, targeting, caps, pre-election closure, server-owned 2pt/7-day decay and renewed support | Multi-week campaign-voter balance review, empirical coefficients, player feedback |
| Governance | Consensual coalitions and constructive confidence votes | Human coalition/transition acceptance |
| History | Decision analytics, weekly accountability, daily polls and welfare history, plus 7/30/90-day strategic observatory with observed gaps and guarded fiscal stress (AOS-053 branch) | Human validation of strategic indicators and long-running storage/traffic observation |
| Activity | Private agenda, contextual tasks, persistent read receipts | External notifications are not implemented or required for in-game delivery |
| Security | RLS, private server-owned tables, owner/member authorization, transactional locking | Independent audit, abuse/load exercises; existing Auth password-protection warning |
| Quality | TypeScript, unit/component/oracle/SQL tests, concurrency and durability CI, responsive Chromium/axe, measured 10-JWT local read-load baseline and exact-build hosted smoke | Real SMTP-backed hosted E2E, manual keyboard/screen-reader acceptance and production traffic load/balance testing |
| Visual identity | Consistent responsive dark UI | Final art direction and human visual sign-off |
| Operations | GitHub quality gates, Vercel hosting, Supabase Cron with private failure diagnostics; AOS-049 release-commit manifest/parity checks, disposable Postgres recovery drill and authenticated local load envelope | Hosted long-running monitoring, provider-managed live backup recovery drill and full production Auth/SMTP acceptance |

## What prevents a finished-product claim

1. A complete authenticated human journey has not been certified: access,
   join, posture, vote, execute, reload and second-account isolation.
2. No actual staffed, fact-checked live weekly newsroom cycle is certified.
3. No full real-time multiplayer week and human balance/usability review is certified.
4. Long-term operation, load capacity, recovery and final visual/accessibility
   acceptance remain open.

These gates cannot be replaced by mock authentication, fabricated news or a
claim that seven days elapsed in a single run. No new external accounts,
mail recipients, subscriptions or paid infrastructure are provisioned by the
onboarding increment.

## Release work completed in AOS-041

Public player manual and in-game guidance cover access/recovery, first
signature, weekly timing, budget/welfare, party admission/readiness,
Parliament, elections/campaigns, coalition/confidence, history and fair play.
Guidance derives completion from the current authorized world. Reading a guide
never marks a political action complete or executes a mutation. No new backend
privilege, persistent browser identity store or external dependency is added.

Strict full-requirement acceptance is 2/18, now including audited F004.4 population archetype calibration. The prior 2/18 tally included
transactional persistence despite an unverified hosted restore checkpoint;
it was reclassified on 2026-10-27, not lost functionality. The separately measured
implementation coverage is 56/72 = 77.8% on AOS-053, versus 54/72 = 75.0%
on AOS-052; see [the audited model](DEVELOPMENT_PROGRESS.md).
