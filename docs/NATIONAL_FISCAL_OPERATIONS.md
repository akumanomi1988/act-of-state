# ACT OF STATE — National Treasury, Budget Policy and Settlement (AOS-027)

## Political and simulation model

This increment turns national finances into an independent, persistent gameplay system rather than a decorative number. All values are **synthetic simulation quantities** (millions of euros or basis points); they are not calibrated forecasts of any real sovereign economy.

A real UTC calendar day is one in-game day. The cabinet can change the allocation once per UTC Monday–Sunday week. A budget is a percentage split across **healthcare, education, infrastructure and public security**, summing to exactly 100. Each sector must receive 10–60%; any one weekly revision may move at most 15 percentage points per sector. The tax rate is 10–45% and may move at most five points per week. Repeating exactly the same revision is idempotent; submitting another distinct revision in that week is rejected by PostgreSQL.

In an active multiplayer nation, **only the incumbent governing party** may edit the shared budget; the remaining member parties can inspect the plan and its historical fiscal acts. In a solo nation, only the owning user may edit. No authenticated or anonymous user may read/write fiscal tables directly.

## Versioned calculations

Rule ID: national-fiscal-v1. For each weekly policy snapshot:

- Revenue (M€) = taxRate × 95.
- Spending (M€) = health × 24 + education × 20 + infrastructure × 30 + security × 22.
- Balance = revenue − spending.
- Default allocation 35/25/25/15 at 25% tax generates 2,375 M€ revenue and 2,420 M€ spending; **−45 M€ per full game week**.
- Positive balance pays down existing debt before increasing treasury. Negative balance reduces treasury, with a debt issue funding any shortfall so treasury never becomes negative.
- GDP index, unemployment and inflation follow deterministic bounded heuristic formulas depending on the budget. The two existing political cohorts receive bounded, policy-specific support/trust changes. Aggregate national approval and trust are recalculated from actual weighted cohorts.
- Dates, receipts, spending, debt issue/repayment, updated macro indicators and the exact policy snapshot form an immutable `fiscal_weekly_acts` record. A primary key makes duplicate settlements harmless.

Each Saturday UTC, the already installed **aos-calendar-v1** Supabase Cron runs the existing Parliamentary → confidence → electoral → Friday pipeline and then settles due fiscal acts. The original scheduler body was renamed to `game_internal.process_calendar_pre_fiscal()` and still runs first. An extended wrapper returns `fiscalClosures` and `fiscalErrors` alongside existing counters. Long outages are reconciled using chronological effective-week policy versions in bounded, restartable batches. Failed fiscal acts are recorded privately in `game_internal.fiscal_failures`, retried after one hour and are not silently lost. The query excludes fully settled governments before selecting a bounded set, preventing starvation as the player base grows.

## Security

- `fiscal_policies`, `fiscal_policy_versions` and `fiscal_weekly_acts` have RLS enabled and zero browser Data API grants.
- `get_fiscal_state(government_id)` returns a member-authorized, validated read model; `set_fiscal_policy` validates an authenticated governing user and takes row locks on the active match, government and policy before any edits.
- The scheduler and seeding functions are available only in `game_internal`. The user cannot alter treasury, debt, macro parameters, individual cohort support or a settled act by passing values to the RPC.
- Policy history preserves prior-week values, so a budget edited this week cannot retroactively rewrite last week's fiscal accounting.
- A change of government immediately changes budget-edit authority, because it is checked against the **current** match leader.

**Scope caveat:** the first fiscal model treats budget redistribution as executive competence. Full Parliamentary budget law, deficit ceiling, fiscal year, regional taxation, debt servicing, GDP calibration and dozens of population archetypes are future simulation requirements. The project should not describe this model as a finished national economy.

## Acceptance evidence

- Disposable PostgreSQL: `supabase/tests/national_fiscal.sql` runs inside BEGIN/ROLLBACK and checks initial values, revisions/limits, idempotence, ownership separation, previous-week historic tax, automated Friday settlement, debt financing, replay, member-only RPC reads and privileges.
- Browser: `tests/browser-smoke.mjs` exercises real Chromium rendering and simulated HTTP behavior for login, email rate-limit failure, signed decisions, budget editing/reload, responsive overflow, WCAG serious/critical errors and screenshot capture. These **mock Supabase API traffic**; they are deliberately not authenticated against the hosted Auth service.
- PostgreSQL migration deployment must preserve historical migration version drift, using the dedicated ACT OF STATE Supabase connector. Do not blindly issue `supabase db push` against an unrelated project.
- A live cross-request Auth-backed playtest, actual SMTP delivery, independent players and long-term live economic settlement remain separate acceptance requirements. No synthetic test can prove successful email delivery.

## Monitoring and recovery

Run with an administrative DB connection:

```sql
select jobname,schedule,command from cron.job where jobname='aos-calendar-v1';
select government_id,week_start,attempts,last_error,last_attempt_at
  from game_internal.fiscal_failures order by last_attempt_at desc limit 30;
select game_internal.process_calendar();
```

The last statement is administrative only. It is safe to retry; it does not recreate settled weeks. A real-world week must fully close before its fiscal effect is posted.

## 40% milestone accounting

The tracked MVP has 18 acceptance criteria. **40% requires at least 8 fully accepted (8/18=44.4%).** AOS-027 can improve the economy, state, dashboard, testing, security and operations but cannot itself establish live SMTP login, independent authenticated multi-browser operation or editorial approval of ten real dossiers. The strict completion tally must be updated only on evidence, not on the number of code changes.
