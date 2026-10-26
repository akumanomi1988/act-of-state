# AOS-052 — National policy portfolio planner

## Gameplay delivered

The read-only portfolio planner is available in the solo government and ten-party Parliamentary game. It covers:
1. Five chapter counters across the permanent founding and national reform programme, excluding weekly news.
2. Cross-dossier option selection and reversible temporary planning without executing any decision.
3. Cumulative direct fiscal comparison against the latest server treasury, plus negative balance warning.
4. Automatic reconciliation against signed events, dossier versions and published availability.
5. Navigation into existing server-authoritative solo and parliamentary legislative workflows.
6. Responsive controls with semantic sections, accessible selects, pressed chapter filters and alert feedback.

## Security and simulation boundary

This planner never submits an act, proposes a bill, casts a vote, persists a plan or changes backend state.
No client estimate of approval, trust, future GDP, household behaviour or public opinion is made.
Only the server's actual signed events certify programme progress, and arithmetic sums of published
direct treasury parameters are explicitly hypothetical. No new privileges or migrations.

## Verification boundary

The local sandbox runs TypeScript/build, Vitest, and independent oracle tests.
Branch CI performs independent Chromium, PostgreSQL and real JWT acceptance checks.
Production Vercel, external SMTP, editorial operations and real-human game balancing are outside this delivery.
The strict full-game acceptance gate remains 2/18 (11.1 percent), unchanged by new code alone.

