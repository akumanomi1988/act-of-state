# AOS-039 — Daily political opinion observatory

Each active multiplayer match receives one immutable, server-generated
synthetic vote-intention projection per UTC day. The data comes from the
same authoritative 300-household and six-district electoral model that
certifies elections. It is not a real-world survey or election result.

## Automatic capture

The existing game_internal.process_calendar() job runs every 15 minutes.
The new wrapper preserves institutional and fiscal settlement and then
captures any active matches missing a current-day sample. It serializes
capture with match row locks. Primary keys and an immutable trigger prohibit
recalculation of previously stored samples, even after manifesto changes.
Match-level errors are stored and retried without blocking other matches.

One run can capture 200 outstanding matches. The scheduler never fabricates
earlier days by running today's electorate against historical dates.
Gaps appear as missing observations; today's first capture is authoritative
for that day. Model versions, party support and seats, and all six district
results are preserved as calculated at capture time.

## Player experience and privacy

An authenticated member-only get_match_opinion_history RPC allows 7, 30
or 90-day windows. Users cannot query the underlying poll table directly.
The electoral dashboard shows actual samples versus expected days,
historical party vote share and estimated seats, delta relative to the
first available reading, a line chart interrupted by missing samples,
and district leaders in the most recent record.

The panel polls every 60 seconds, never interpolates missing days and
distinguishes historical projections from certified election returns.

## Verification

The SQL rollback suite tests real JWT member identities, match activation,
first capture, deduplication, immutable updates and deletes, six-district
model consistency, cross-user denial, RPC bounds and calendar chaining.
Vitest validates fail-closed typed decoding, no-interpolation chart paths
and React controls. Chromium verifies mobile rendering and persistence of
the selected historical record after page reload.

No real ten-account live play or multi-day production continuity is claimed.
