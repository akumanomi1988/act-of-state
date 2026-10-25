# ACT OF STATE — Current product inventory

Updated 2026-10-25. Implementation is distinguished from final acceptance.
The game is browser-based, free to play, with no paid competitive advantages.

| System | Implemented | Remaining acceptance / development |
|---|---|---|
| Access | Email-link Auth, session recovery, account isolation, visible delivery errors | Actual email delivery and multi-account browser acceptance |
| Player onboarding | Public /guide manual, contextual solo/multiplayer steps from server state, recovery guidance | Observe first-time human players; adjust based on usability evidence |
| Solo government | Persistent nation, decisions, authoritative outcomes, archived acts | Full real-Auth browser acceptance |
| Population | 300 persistent synthetic households, age/income/settlement and six districts | Demographic balancing; no empirical demographic claims |
| Daily society | Economic security, services, welfare, bounded political feedback, immutable daily records | Multi-day operational observation and gameplay balancing |
| Fiscal engine | Treasury, debt, GDP index, inflation, unemployment, budget revisions and weekly accounts | Economic calibration, extreme-policy balancing |
| Weekly dossiers | Ten-slot newsroom, source discovery, draft revision control, manual review and atomic publication | Actual reviewed news for every operational week; staff operation |
| Time | One real UTC day per game day, Monday publication windows, Friday closure, autonomous jobs | Sustained live operation across week boundaries |
| Multiplayer | Up to ten parties, private invitations/public discovery, lobby withdrawal and readiness | Ten actual accounts and a human playtest |
| Party positions | Immutable member positions and political affinity | Balance feedback from actual players |
| Parliament | Weighted votes, proposal windows, binding approval before cabinet execution | Full human government/opposition flow |
| Elections | Household electorate, six constituencies, 100 D'Hondt seats, immutable certification, cabinet succession | Electoral and campaign balance; human acceptance |
| Campaigns | Weekly party interventions, targeting, caps, pre-election closure, server-owned 2pt/7-day decay and renewed support | Multi-week campaign-voter balance review, empirical coefficients, player feedback |
| Governance | Consensual coalitions and constructive confidence votes | Human coalition/transition acceptance |
| History | Decision analytics, weekly accountability, daily polls and welfare history with explicit gaps | Long-running storage and traffic observation |
| Activity | Private agenda, contextual tasks, persistent read receipts | External notifications are not implemented or required for in-game delivery |
| Security | RLS, private server-owned tables, owner/member authorization, transactional locking | Independent audit, abuse/load exercises; existing Auth password-protection warning |
| Quality | TypeScript, unit/component/oracle/SQL tests, concurrency and durability CI, responsive Chromium/axe | Real SMTP-backed E2E, manual keyboard/screen-reader acceptance and load testing |
| Visual identity | Consistent responsive dark UI | Final art direction and human visual sign-off |
| Operations | GitHub quality gates, Vercel hosting, Supabase Cron with private failure diagnostics | Monitoring/backup recovery drill and sustained operational acceptance |

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

Strict full-requirement acceptance remains 2/18. A weighted implementation
percentage has not been established, so this inventory does not invent one.
