# ACT OF STATE — National Decision Analytics (AOS-028)

## Player value

The strategic archive turns immutable cabinet decisions into an interpretable
political timeline in both solo and shared-nation play. Players can inspect
which act moved the treasury, public approval, institutional trust, and the
recorded synthetic cohorts. The original persisted dossier and option titles
remain visible even after editorial publication ends.

## Data and correctness contract

- Source of truth: `DecisionEvent[]` supplied by the existing authorized
  `get_government_world` or `get_match_world` RPC. No direct table access,
  extra privileges, secret keys, or new database schema.
- Each act's delta is `state_after - state_before`. Do **not** calculate one
  act from the previous act's ending balance: autonomous fiscal settlements and
  other game events can occur between decisions.
- Lifetime and period totals sum only signed cabinet-decision effects. They
  are **not** a complete national economic ledger or cumulative electoral
  forecast. Fiscal settlements retain their own authoritative ledger.
- Seven- and thirty-day filters use the server's UTC `gameDay`, never the
  browser clock. The date interval includes the current game day.
- Per-cohort figures sum recorded support/trust percentage-point changes;
  they are not current cohort values or actual election votes.
- Source events are sorted into a deterministic chronology without mutation.
  The chart limits rendering to the most recent 50 events; totals still use
  all events in the selected interval.

## UI and accessibility

The collapsed summary is deliberately visible on the normal game screen
without obscuring the agenda. Expanding the archive reveals native radio
filters, keyboard-operable decision buttons, a labeled impact visualization,
persisted before/after details, and social-group effects. Every bar also has
an explicit numeric value, so color and length are never the sole carriers of
information. The panel is responsive on desktop and mobile.

## Verification

- `src/lib/decisionAnalytics.test.ts`: chronology, server-date filtering,
  signed deltas, independent fiscal gaps, cohort totals, empty archive.
- `src/DecisionAnalyticsPanel.test.tsx`: summary, controlled expansion,
  metric and period switching, historical selection, empty-period message.
- Existing App/Multiplayer integration tests, TypeScript and production build
  remain mandatory GitHub Actions quality gates.
- The repository's Chromium mock-HTTP smoke remains a regression gate. It does
  **not** constitute a real Supabase Auth-backed browser playtest.

## Deliberate exclusions

This increment does not introduce fabricated analytics, forecasting, party
rankings or additional governmental mutations. Historical fiscal acts,
parliamentary ballots, elections and coalition votes may later be unified in
a cross-domain national timeline when their immutable read models are
available through one consistent authorized API.
