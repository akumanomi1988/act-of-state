# ACT OF STATE — Autonomous Calendar Operations (AOS-023)

## Purpose and clock
- Server-authoritative UTC calendar: one civil UTC day equals one game day.
- Approved ten-dossier weekly releases become visible on Monday through the existing database embargo. The scheduler does **not** invent news, approve editorial drafts, or bypass source-review gates.
- A bill remains open until an absolute mandate majority approves it, all mandates have voted, or the 24-hour deadline passes. Expired bills are settled by the server even if nobody opens the browser.
- Elections mature 90 days after match start or the previous certification. After overdue bills settle, the server certifies the election, snapshots its inputs and 100 mandates, and transfers cabinet authority.
- A Friday is final only after the full Friday UTC has elapsed. From Saturday UTC, the server stores an immutable economic/political readout for the completed week, replayed from dated decision events.

## Execution
Migration `aos_023_autonomous_calendar.sql` creates `game_internal.process_calendar()`, private settlement helpers and `public.get_match_calendar(match_id)`. The helpers are not executable by `anon` or `authenticated`; player-facing RPCs retain membership authorization.

On hosted Supabase, the migration installs `pg_cron` if available and creates one named job:

```sql
select jobid, jobname, schedule, command
from cron.job where jobname='aos-calendar-v1';
```

Schedule: `*/15 * * * *` (every 15 minutes). Each call settles up to 500 due bills, 100 due elections and 100 matches needing Friday catch-up. Due work remaining beyond one batch is retried by the next invocation. Each match has a row lock, and immutable keys make retries idempotent. CI's disposable PostgreSQL lacks `pg_cron`; it validates the same calendar engine without scheduling.

## Monitoring and recovery
```sql
select event_kind, entity_id, attempts, last_error, last_attempt_at
from game_internal.calendar_failures
order by last_attempt_at desc limit 30;
```

```sql
select status, count(*) from cron.job_run_details
where start_time > now()-interval '24 hours'
group by status;
```

```sql
select game_internal.process_calendar();
```

The last statement is an administrative recovery command, **not** a browser/RPC operation. Run it with the database owner after fixing the cause. A successful retry clears the matching failure record. Missing Friday acts are backfilled from the match start week, but only for elapsed Fridays.

## Invariants
- Duplicate scheduled invocations cannot duplicate a bill closure, election act or Friday act.
- Elections cannot pass an open Parliamentary vote. If a non-expired bill is still open, the election waits until it closes.
- No automatic action changes editorial content or manufactures news citations.
- Friday readouts are snapshots of the **existing** fiscal and cohort decision engine, not a full macroeconomic simulation.
- Manual `certify_match_election()` remains a safe, authorized fallback; it shares exactly the same election core as Cron.
- Raw Friday act tables and Cron helpers are not granted directly to client roles. Match members read the calendar through `get_match_calendar()`.

## Release gates
1. Disposable PostgreSQL applies all migrations and passes `autonomous_calendar.sql`, elections, ten-party, RLS and concurrency tests.
2. Hosted Supabase migration applies successfully, `pg_cron` job is present, administrative dry run reports zero errors, and security advisors show no newly public private functions.
3. Frontend quality/TypeScript/build pass, deployed multiplayer route renders, and production deployment matches reviewed commit.
4. Real authenticated multi-account E2E remains a separate acceptance gate. Editorial sourcing of ten real weekly news items is also separate.
