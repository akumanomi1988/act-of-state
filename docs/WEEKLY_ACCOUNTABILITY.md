# AOS-037 — Official weekly governance accountability

This milestone adds a member-scoped weekly ledger using actual government,
parliamentary, electoral and approved-news records already persisted in the
game. No external current-event assertions or simulated results are inserted.

## Invariants and full lifecycle

1. Every weekly dossier is actionable from Monday through Friday UTC,
   inclusive. A trusted database trigger normalizes the deadline when a
   dossier is inserted or modified, and a database check constraint ensures
   it cannot be extended. Historical weekly dossiers are backfilled.
2. Archived news citations, decisions and parliamentary proceedings remain
   durable. Expired dossiers leave the live inbox but remain accessible via
   member-authorized historical RPCs; late decisions or stances are rejected
   by the existing PostgreSQL availability gate.
3. The authorized weekly ledger returns one to twelve bounded weeks, eight
   by default, from the match's own activation date, never future weeks.
   Every week contains approved citations, executive decisions and effects,
   member position totals, parliamentary status and votes, electoral winners
   and the Friday settlement record where one exists.
4. No unpublished editorial draft content appears in the report. The
   Friday act is copied from the immutable server certificate; ongoing
   and awaiting-settlement weeks never manufacture a final financial act.
5. The responsive multiplayer history panel has week selection, each source
   link, explicit missing-publication state, per-dossier decision accounting,
   party participation, parliamentary votes, elections and certified Friday
   balances. It uses a single 60-second refresh with stale-request protection.
6. The population, policy, party, parliamentary and election engines remain
   authoritative. The history is a projection, never a write path.

## Verification and external boundaries

- PostgreSQL 17 and Cloud rollback suites exercise three isolated synthetic
  users, two published weeks, historic decisions and fiscal closure,
  parliamentary ballots, party positions, cross-user authorization, upper
  bound on weeks and server-enforced Friday expiry.
- Vitest checks the typed RPC validation, error containment and the UI's
  historic navigation. A Chromium mock-HTTP browser test covers selected
  week, source link, mobile accessibility and successful reload.
- Real SMTP-backed account sessions, actual verification of ten news items,
  and a complete week of genuine multi-party play remain external acceptance
  gates. The report must never claim these as completed.
