# AOS-029 — Campaign operations and invariants

## Runtime

- Public RPCs get_campaign_state(match_id) and launch_campaign(match_id,cohort,strategy) are the only permitted player access boundary. Both authorize Auth match membership. Only active matches permit intervention.
- UTC weeks start on Monday; the server timestamp, not browser time, selects the quota key. Unique (match_id,user_id,week_start) and FOR UPDATE on the parent match prevent concurrent duplicate influence. Exact retries return the existing immutable event.
- No refresh job or third-party service is required for quota reset; the week changes automatically. The same voters are weighted by declared party policy plus bounded, persisted campaign influence in electoral model v2. Each election act snapshots model version, electoral percentages and party aggregate campaign boost.
- An operation's base gain is 3 for dialogue, 4 for field visit, 5 for policy forum. Reduce by integer ideological mismatch / 25; clamp to at least 1. Influence is capped at 20 per party per cohort. Repeat elections retain accumulated influence; rebalancing/decay is future design work, not silently applied today.

## Verification

- Run npm run typecheck, npm test, npm run test:oracle and npm run build.
- PostgreSQL 17 CI applies all migrations in order and runs supabase/tests/campaigns.sql inside rollback, proving real election-score movement, exact retries, weekly quota, model version, scope protection, invalid input rejection, freeze and seat conservation.
- supabase/tests/access_contract.sql asserts the absence of direct browser table grants and anonymous privileged RPC execution.
- Real multi-account Auth and mobile touch/keyboard acceptance remain outstanding; mocked component tests do not substitute for those gates.

## Safety

- Never run the synthetic Auth SQL fixture without a surrounding transaction; it explicitly rolls back and uses .invalid mailboxes.
- No client-provided score or money input is accepted by launch_campaign; campaign-outreach-v1 is deterministic and independent of LLMs.
- The read-only projection is not a poll of actual citizens. Do not present these numbers as political predictions.
