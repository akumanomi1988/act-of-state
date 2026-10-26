# ACT OF STATE — Current product inventory

Updated 2026-10-26. AOS-052 integrates two green source branches; this combined build is not yet released. Implementation is distinguished from final acceptance.
The game is browser-based, free to play, with no paid competitive advantages.

| System | Implemented | Remaining acceptance / development |
|---|---|---|
| Access | Password-first Auth, explicit registration, one-time legacy email link, password recovery/change, session recovery and isolation (AOS-050 feature branch) | CI acceptance, production password/SMTP settings, real hosted signup and human multi-account acceptance |
| Player onboarding | Public /guide manual, contextual solo/multiplayer steps from server state, recovery guidance | Observe first-time human players; adjust based on usability evidence |
| Solo government | Persistent nation, 10 founding decisions + 18 additional authored reform dilemmas (development branch), server-authoritative outcomes and archived acts | Integrated CI and hosted real-Auth acceptance, product balancing |
| Population | 300 persistent synthetic households, age/income/settlement and six districts | Demographic balancing; no empirical demographic claims |
| Daily society | Economic security, services, welfare, bounded political feedback, immutable daily records | Multi-day operational observation and gameplay balancing |
| Fiscal engine | Treasury, debt, GDP index, inflation, unemployment, budget revisions and weekly accounts | Economic calibration, extreme-policy balancing |
| Weekly dossiers | Ten-slot newsroom, source discovery, draft revision control, manual review and atomic publication | Actual reviewed news for every operational week; staff operation |
| Time | One real UTC day per game day, Monday publication windows, Friday closure, autonomous jobs | Sustained live operation across week boundaries |
| Multiplayer | Up to ten parties, private invitations/public discovery, lobby withdrawal and readiness | Ten actual accounts and a human playtest |
| Party positions | Immutable member positions and political affinity | Balance feedback from actual players |
| Parliament | Weighted votes, proposal windows, binding approval before cabinet execution; permanent reform agenda supported | Full human government/opposition flow |
| Elections | Household electorate, six constituencies, 100 D'Hondt seats, immutable certification, cabinet succession | Electoral and campaign balance; human acceptance |
| Campaigns | Weekly party interventions, targeting, caps, pre-election closure, server-owned 2pt/7-day decay and renewed support | Multi-week campaign-voter balance review, empirical coefficients, player feedback |
| Governance | Consensual coalitions and constructive confidence votes | Human coalition/transition acceptance |
| History | Decision analytics, weekly accountability, daily polls and welfare history with explicit gaps | Long-running storage and traffic observation |
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

Primary engineering progress is now **56/72 = 77.8%** on the validated
AOS-052 development snapshot, versus **52/72 = 72.2%** on AOS-049 main
(**+5.6 percentage points**). Checkpoint definitions, pinned SHA evidence
and exclusions: [DEVELOPMENT_PROGRESS.md](DEVELOPMENT_PROGRESS.md). Strict
external commercial acceptance remains independently **2/18 = 11.1%**.
No production release or hosted SQL migration is implied.
