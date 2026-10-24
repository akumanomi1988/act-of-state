# Daily living conditions — AOS-040

## Product contract

One real UTC day is one game day. A trusted worker measures each active
multiplayer nation and each solo government once per current UTC day.
An unstarted multiplayer lobby does not evolve. There is no time acceleration,
browser-dependent settlement, paid intervention or LLM requirement.

The 300 persistent synthetic households now retain economic security, access
to services and wellbeing, each on a 0–100 scale. These are fictional gameplay
indices, not forecasts, surveys, real incomes or official economic statistics.

## Version `living-conditions-v1`

The pure SQL function `game_internal.living_conditions` evaluates the same
inputs deterministically:

- Economic security starts at 65. Each GDP-index point above 100 adds 0.25;
  each 50 unemployment basis points above 700 removes one point. Inflation
  above 200 basis points is divided by 20 for low incomes, 35 for middle
  incomes and 60 for high incomes, making low incomes more sensitive.
- Tax-pressure deviation from 25 costs 0.35 points per point for low incomes,
  0.6 for middle incomes and 0.9 for high incomes.
- Services start at 50. Deviations from the initial health/education/
  infrastructure/security allocations are weighted by age and settlement:
  seniors receive a stronger health response, young households education,
  rural households infrastructure. The exact coefficients live in the
  versioned SQL function and its golden fixture.
- Both indices are clamped to 0–100; wellbeing is 60% economic security and
  40% service access. Household scores retain two decimal places.
- Resident-weighted wellbeing is aggregated per existing social cohort.
  Support moves at most one point when wellbeing is at least eight points
  away from current support. Trust loses one below wellbeing 30, gains one
  above 70, otherwise remains unchanged. Both stay within 0–100.
- The established cohort trigger propagates social effects to household
  preferences once. Government approval and trust retain existing cohort
  population weights, while elections retain resident-weighted household votes.

Social inertia is deliberately separate from immediate dossier effects and
weekly fiscal effects. The daily engine **never changes treasury, debt, GDP,
inflation or unemployment**. Existing weekly accounts remain their source of
truth. New decisions after a day's measurement affect the next measurement;
the act displays the exact inputs it used.

The coefficients require playtesting and economic balancing before commercial
acceptance. Automated determinism is not evidence of calibrated gameplay.

## Persistence, authorization and recovery

`daily_social_acts` stores one immutable summary per government/day, source
macro/fiscal inputs, cohort before/after support and nine aggregated income/
district segments. Historical acts are not recalculated after later decisions.
No past days are fabricated from present state; the UI reports recorded and
expected days from the first actual measurement and leaves gaps explicit.

`get_living_conditions(uuid, integer)` accepts only 7/30/90-day windows.
Only the solo owner or a member of the government's match may read it.
Authenticated and anonymous roles cannot directly read or write act or failure
tables, or execute worker functions. The RPC has a fixed empty search path.
Aggregate results contain no emails or real personal data. Government deletion
may cascade through this ledger without weakening ordinary act immutability.

The Supabase advisor's [private-table policy notice](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)
is intentional: browser roles have no direct grants. The member-checked public
read function retains an [authenticated SECURITY DEFINER notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable),
matching the established RPC architecture. Authorization denial and grants are
regression-tested; these notices are not suppressed.

Workers lock match before government, like executive and fiscal operations.
The primary key plus row lock makes concurrent/repeated daily runs idempotent.
A country and its act commit atomically, including household/cohort changes.
Failures roll back that country's changes and are recorded privately with a
15-minute backoff; healthy countries continue. Successfully recovered failures
are removed. A stale read or account switch cannot resurrect another user's
data in the UI, and errors have an explicit retry action.

## Scheduler and operational limits

The existing `aos-calendar-v1` job calls daily social processing **before**
its established Parliament, weekly fiscal and electoral work. When `pg_cron`
is installed, the migration also registers `aos-daily-social-v1` every minute
to drain batches of at most 200 unsettled governments independently. Repeated
runs do not compound a day's effects. PostgreSQL environments without Cron
need a trusted external invocation; clients cannot invoke the worker.

The theoretical budget of 200 governments per minute is not a verified load
capacity. Monitor runtime, statement timeouts, lock contention, failed rows,
unsettled countries and ledger growth before scaling. Older settled countries
are excluded from candidate selection, avoiding starvation within a day's
worklist. Daily history queries use the `(government_id, act_day)` primary key.
Only aggregates are retained in acts, avoiding a daily copy of all 300 agents.

Useful trusted operator queries:

```sql
select jobname, schedule, active from cron.job
where jobname in ('aos-calendar-v1', 'aos-daily-social-v1');
select * from game_internal.daily_social_failures order by attempted_at;
select count(*) from public.governments g
where not exists (select 1 from public.matches m
  where m.government_id=g.id and m.status<>'active')
and not exists (select 1 from public.daily_social_acts a
  where a.government_id=g.id and a.act_day=(now() at time zone 'UTC')::date);
```

## Acceptance and evidence boundaries

1. Deterministic, heterogeneous household scores and bounded social inertia.
2. Atomic, immutable, idempotent daily acts without duplicate fiscal settlement.
3. Member-only bounded readback, solo and multiplayer integration.
4. Automatic batches, isolated failure diagnostics and successful retries.
5. Accessible income/territory detail, history, missing-day and error states.
6. SQL regression, typed adapter tests, component tests, Chromium mobile/desktop
   and existing game regression gates.

`supabase/tests/daily_living_conditions.sql` runs rollback-only synthetic
identities. Browser HTTP fixtures exercise rendering and interactions without
sending email or asserting live Supabase authentication. Real ten-person
playtesting, email delivery, balancing, human accessibility/design acceptance
and sustained production operation remain independent release gates.
