# AOS-048 — Campaign relevance, persuasion renewal and election integrity

## Why the economy of attention changes

Under the original campaign-outreach-v1, campaign persuasion accumulated up
to 20 points **forever**. An active party could saturate its favorite cohort
well before the 90-day election and then stop campaigning; the effect stayed
permanent. That removed strategic timing and made long-running matches
politically static.

AOS-048 introduces a **time-bounded electoral persuasion model** without
inventing actual voter data or overriding the server's UTC day.

## Deterministic v2 model

For each match, party and synthetic social cohort, the server retains the
most recently recorded influence amount (0–20) and a trusted `updated_at`
timestamp. The **effective influence** on date `D` is:

```text
elapsed_days = max(0, D_UTC - date(last_campaign_timestamp_UTC))
weeks_elapsed = floor(elapsed_days / 7)
effective = max(0, min(20, stored_influence) - 2 * weeks_elapsed)
```

- On days 0–6, no decay. On days 7–13, minus 2 points; days 14–20,
  minus 4; and so forth. Zero never becomes negative.
- A new authorized campaign adds its **existing ideology/strategy-based**
  bounded gain to the *currently effective* value, still capped at 20.
  Campaign type, 1 action per party/week, retry-idempotency, election
  blackout and seat/ownership restrictions remain server-owned.
- All competing parties and cohorts use identical coefficients. This is
  not monetization, paid boosting, real demographic estimation or a
  human behavioral claim.
- The campaign page displays the effective current value and server-derived
  date when it next loses two points. Already recorded acts retain their
  original `influence_after`, even if their present persuasive effect is 0.
- No cron job or write-on-read: influence naturally changes in projections
  at the next UTC date. Existing stored acts remain append-only evidence.

## Cross-system authority

The **single versioned** PostgreSQL `_calculate_election_projection` produces
both party/constituency electoral forecasts and the projection archived
by the daily opinion polling worker. Both use `campaign_effective_influence`
for synthetic family-level affinity and `campaignInfluenceTotal`.
There is no second voter formula in TypeScript.

- Projection `modelVersion = electoral-districts-v2`.
- New certified election records default to `electoral-districts-v2`.
- New immutable daily opinion samples store `electoral-districts-v2`.
- Past certified election results and past daily poll snapshots keep their
  original `electoral-districts-v1` (or earlier) model version.
- New campaign acts use `campaign-decay-v2`; historical
  `campaign-outreach-v1` acts remain readable.
- The existing 100 total mandates, six districts, electoral deadlines,
  member-only reads and deterministic D'Hondt/tie-breaking rules remain.

The version increment is a **material rule change**. Existing historic
results are never silently recalculated.

## Security and migration

The additive migration creates a single immutable private pure SQL helper,
adjusts two check constraints while allowing their historical versions,
replaces three existing authorized RPCs/projection functions in place,
and changes model-version defaults for future acts. It **never deletes
histories, rewrites old results, opens table privileges or introduces an
administrator endpoint**.

The helper has no public/anonymous/authenticated EXECUTE grant; only the
established `SECURITY DEFINER` functions may call it. `game_internal`
remains a private schema. No client controls reference dates or stored
influence values.

The migration must pass all ordered PostgreSQL CI migrations, all existing
SQL regression suites, a new time-warp **rollback-only** SQL suite for
0/7/14/30-day boundaries, old-act preservation, renewal, real election
projections, opinion snapshots and outsider denials, plus real local
GoTrue/PostgREST/ten-browser acceptance, TypeScript, Vitest, build,
Chromium WCAG and public deployment status.

## Operational and gameplay limitations

This produces a fairer temporal contest **inside the simulated rules**,
but the factor 2/7-days is deliberately a game-design assumption, not a
calibrated persuasion coefficient. It requires multiple weeks of
real-player telemetry, retention/balance tests and independent acceptance
before commercial finalization.

No accelerated days, actual live political stories, historical time travel
or paid persuasion is implemented. The strict full MVP acceptance denominator
remains 18 and must not change merely because new logic is shipped.

## Long-term balance acceptance criteria

1. Influence matches the formula on exact 7/14-day UTC boundaries.
2. New campaigns start from an effective value and respect the cap and
   one-party/one-week quota, with exact-repeat idempotency.
3. Forecast and opinion capture use the same effective value and record v2.
4. V1 elections, polls and campaign acts remain unchanged and interpretable.
5. Ten genuine JWT sessions can play and inspect new campaign effects, while
   outsiders cannot read or write their match.
6. Human playtest documents whether the 2-point weekly decay is useful,
   including a no-action player, a sustained-campaign player, elections
   every 90 days and election blackout weeks.
