# AOS-025 — Coalitions and Constructive Confidence

## Rules
- Every active match has a single cabinet leader (matches.host_user_id). Each ballot remains open for 24 real hours.
- The current cabinet may invite another elected party to join its coalition. Only the invitee may accept, decline, or leave.
- Coalition support is calculated from the cabinet party plus accepted partners' current legislative mandate weights. Each party keeps its independent parliamentary vote. A coalition never delegates signature authority.
- On a government change (national elections or a constructive confidence vote), previous leader-specific coalition commitments are archived but inactive.
- Any active party with a positive mandate can nominate a different mandate-holding party as alternative premier. A match can have one open confidence motion.
- Each party casts one immutable yes/no/abstain ballot. Votes are weighted by server-captured mandate seats. The alternative becomes premier only after yes seats exceed half of all seats; all remaining motions reject after all eligible ballots or 24 hours.
- A passed motion transfers matches.host_user_id in the same transaction, immediately updating the existing authority checks on legislation and government decisions.
- An election act cannot be inserted while a confidence motion remains open. Motions cannot be proposed on the day before a scheduled election, or afterward.
- The database scheduler closes expired motions before the existing election/Friday workflow, using the same 15-minute pg_cron entrypoint.

## Security and test contract
- Coalition, confidence and vote tables have RLS and zero direct client grants.
- RPCs check Auth identities, seat membership, candidate eligibility, current leadership and match locks. Privileged internals are isolated in game_internal.
- The server owns majority rules, seat weights, vote immutability, cabinet handover and closing time.
- Disposable SQL suite coalitions_confidence.sql covers four-party membership and power transfer, invite/ballot retries, invalid outsider actions, rejection, timeout, calendar idempotency and grants.
- React tests cover UI behavior and read-after-write.
- A real multi-browser, authenticated playtest is still required. No human account or real SMTP test is manufactured.
- The Supabase hosted project has historical migration filename/version drift: apply this SQL deliberately through the existing connector, do not blindly use supabase db push.

## Operating
The AOS-023 pg_cron job aos-calendar-v1 keeps running game_internal.process_calendar() every 15 minutes. It now returns additional confidenceClosures and confidenceErrors counters. An election pending an open confidence motion will wait until that motion closes.
