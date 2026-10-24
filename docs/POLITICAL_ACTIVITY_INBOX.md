# AOS-038 — Political action center for asynchronous multiplayer

Each party has a personalized, server-owned in-game political inbox.
It provides actionable briefs without requiring users to manually inspect
every parliamentary subsystem on every visit.

## Functional contract

The backend derives events and pending tasks from existing game records:
lobby readiness, host match activation, pending parliamentary votes,
confidence motions, coalition invitations, party positions on live dossiers,
campaign opportunities, cabinet execution of passed mandates, certified
Friday acts and election results. No editorial drafts are exposed.

Task IDs are stable and based on immutable record IDs or calendar dates.
Tasks cease being listed when a vote or stance is completed. Marking a task
read never votes, signs a measure or otherwise completes political actions.

The get_match_action_inbox RPC is member-only. The mark_match_inbox_read
RPC validates a current server-originated task before writing a receipt.
Writes are idempotent; no authenticated role has table-level access to
private read receipts. Composite party-member foreign keys enforce ownership
and receipt cleanup on membership deletion.

The responsive inbox polls every 15 seconds, displays unread counts, filters
read notices, confirms acknowledgments with the server and links directly
to the relevant dossier, parliament, governance, campaign, election, lobby
or historical week.

## Verification and limitations

- SQL rollback regression: three synthetic JWT identities, a complete lobby
  join/ready/start transition, parliament proposal and ballot, member-specific
  unread/read behavior, idempotent receipts and cross-account rejection.
- Vitest: typed RPC response validation, read isolation, error handling,
  contextual navigation and authenticated React interactions.
- Chromium: mobile inbox, server-confirmed read receipt after reload,
  responsive layout and accessibility smoke coverage.
- No push/email notifications are claimed. Users must open the browser.
  SMTP-backed ten-account acceptance and real week-long play remain pending.
