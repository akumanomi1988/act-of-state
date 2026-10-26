# AOS-053 — Strategic Mandate Observatory and Twelve-Week Regression

## Scope

ACT OF STATE uses one real UTC day per game day. This observatory supplies
authenticated cabinet and opposition members with 7/30/90-day retrospective
evidence without a second policy engine, fake calendar days or mutable acts.

The observatory works in solo and active shared nations. Only the explicit
Analyze mandate action requests the existing member-authorized fiscal,
living conditions, election and opinion-history RPCs. Closed panels make no
extra requests. An expanded panel refreshes every 60 seconds or on demand.

## Five connected read workflows

1. National treasury: real current treasury/debt, arithmetic projected weekly
   balance, immutable recorded fiscal settlements, deficit incidence and debt
   issuance.
2. Fiscal stress: current policy, 10% lower revenue and 10% higher expenditure.
   The estimated treasury buffer divides actual treasury by the hypothetical
   weekly deficit and rounds down. It is NOT a prediction, policy action or
   long-term solvency measure.
3. Society: actual wellbeing, minimum and first/latest change, longest
   consecutive sampled streak, daily record coverage and explicit gaps.
4. Party momentum: party-specific synthetic poll samples, derived change,
   estimated seats and separately reported certified election acts.
5. Operational diagnostics: independent read failures, accessible refresh,
   account/match-switch isolation, history rows and 7/30/90-day selectors.

The existing fiscal RPC provides at most 12 closed weekly acts, so a 90-day
view NEVER claims 13 complete weeks of fiscal archive. Historical wellbeing
and polling show expected and observed dates as supplied by their respective
servers. Source dates differing by more than one day are not merged.

The UI uses semantic headings, labelled regions, responsive tables, keyboard
access, touch-sized controls and no new client political mutations.

## Synthetic 12-week regression (not a real 90-day clock)

The disposable SQL suite supabase/tests/mandate_longrun_balance.sql runs
12 distinct fiscal settlements covering 84 historical dates INSIDE ONE
ROLLBACK-ONLY TEST TRANSACTION. It validates:
- 12 persisted weekly fiscal acts and 12 safe duplicate retries;
- default -45 M EUR per week, depletion of 300 M EUR treasury reserve,
  exactly 240 M EUR new debt and no negative cash balance;
- the daily society worker still captures only the real UTC date, without
  fabricating 84 welfare snapshots or double-settling the national budget;
- owner read of all 12 acts, bounded social read, second-owner denials;
- a fresh weekly budget revision not rewriting certified older acts.

This is a historical fixture exercise; it CANNOT prove 84 or 90 real days of
production operation, legitimate news publication, actual human behavior,
externally delivered mail, game balance or backup reliability.

## Security, checks and deployment

Pure calculations: src/lib/mandateObservatory.ts.
Player UI: src/MandateObservatory.tsx.
No new table, elevated function, RLS grant, schema migration or dependency.
Vitest validates calculus and identity, Chromium validates mobile/desktop
WCAG and errors, PostgreSQL validates signed historical acts. Real GoTrue
tests cover the existing access and Parliament end-to-end.

Do not merge to main or deploy via Vercel without separate authorization.
The AOS-050 reform migration is still waiting for coordinated production
release. Strict completed commercial acceptance stays at 2/18 until genuine
human and long-running hosted requirements pass.
