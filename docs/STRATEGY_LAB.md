# AOS-058 — Electoral Strategy Laboratory

## Delivered gameplay

The player-facing **Electoral Strategy Laboratory** is a collapsible section
inside the national election panel. Before the campaign freeze, an active
participant can test their currently selected manifesto position (0–100)
and request a complete six-district electoral calculation **without saving**.

It compares their live national vote estimate, projected seats, percentage
point difference and the party's before/after seats in each constituency.
The existing **Publish programme** action is still the only way to commit
an actual manifesto. Neither a preview nor opening/closing the laboratory
creates or changes a campaign act, parliamentary vote, election certificate,
household, fiscal act or saved manifesto.

The laboratory is unavailable in the lobby or after the campaign freeze;
it resets on government, user, manifesto, competitor/campaign, UTC day or
active-state change. Results cannot be reused across accounts or matches.
Historical certified results remain immutable.

## Security and mathematical authority

Migration `20261028213000_aos_058_electoral_strategy_preview.sql` factors the
existing server-owned 300-household, six-district D'Hondt election calculation
into **one** private calculator. The original
`public._calculate_election_projection(uuid)` continues to invoke that
same shared calculator with no override. All pre-existing campaign, poll
and certification routines therefore share the exact same scoring formula.

New RPC `public.preview_election_strategy(uuid,integer)` requires a real
`auth.uid()`, current match membership, active match status, an in-range
program and server-side UTC campaign openness. It overrides only the caller's
manifesto *inside the SELECT*, never through DML. Player roles have no direct
execute access to the internal shared calculator. The browser verifies
result identity, both independent 100-seat projections, all six territorial
seat counts, opponent manifesto invariance and `committed:false`.

## Verification

- `supabase/tests/electoral_strategy_preview.sql`: transactional 0/25/50/75/100
  programme scenarios, six districts and exactly 100 seats in each
  scenario, no game-table writes, replay stability, rival/outsider denial,
  invalid arguments and server-UTC election freeze.
- `tests/real-auth-acceptance.mjs`: real local GoTrue + PostgREST ten-party
  match, one actor's hypothetical forecast, forbidden outsider,
  out-of-range denial, and identical authoritative election state after
  the preview.
- `src/lib/electionsEvidence.test.ts`: invalid network response,
  identity spoofing, rival programme modification, forged `committed`
  flag and impossible seat reconciliation are rejected.
- `src/ElectionStrategyLab.test.tsx`: read-only Spanish UX,
  before/after six-district comparison, cutoff/lobby gating, stale
  route results and network-rejection behavior.
- Quality workflow also exercises existing election and dashboard
  interactions in responsive Chromium.

## Limits / acceptance boundaries

These are **hypothetical game projections**, not empirical polling,
human-calibrated election probabilities or guaranteed future winners.
A preview is valid only for its server-read snapshot and may change if
other players campaign or publish. The original
**MVP-F007.4 human 90-day campaign/election playtest remains pending**.
The original 72-checkpoint/18-requirement completion rubric receives
**no added points** merely for this quality-of-life feature.

No Vercel deployment, remote Supabase migration or `main` merge has
been executed by this development increment.
