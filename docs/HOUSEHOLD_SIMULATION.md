# AOS-031 — Synthetic household simulator

## Model

- A government owns exactly 300 persistent synthetic household archetypes. Each carries 1–5 weighted residents. This is a small simulation sample, not an official population count.
- Two existing policy cohorts allocate 65%/35% of the archetypes. The sample size is an integer multiple of 100 to preserve exact cohort weights. Each family has age, income, settlement and ideological variation, plus individual political support and trust.
- No random calls, real identity data, client-generated votes or LLM. A unique primary key ensures safe repeated initialization. Old families are never regenerated on login.
- Existing population cohort updates from cabinet decisions or fiscal acts trigger atomic propagation of policy sensitivity factors (75%–125%) to family microstates, clamped at 0–100. This deliberately produces heterogeneous opinion, even though the national macro metrics continue to use the proven cohort engine.
- Electoral model electoral-households-v1 scores parties individually for each household against preference, incumbent trust/support and campaign influence, and weights normalized vote shares by simulated residents. The 100-seat D'Hondt allocation and deterministic tie-break remain unchanged.
- Historic elections retain their previous model version and stored snapshots. New certificates include household model version and household sample size.

## AOS-054 synthetic demographic coupling correction

The original 300-agent `households-v1` seed used `n % 10` for age and
`(7*n) % 10` for income. These share the same 10-step cycle. This caused
**three structurally empty age × income cells**, including all high-income
young and all low/high-income seniors (not a realistic diversity assumption).

Newly created governments now receive **`households-v2`** household rows:
- Age rank `(37*n+11) % 300`: 90 young / 150 working / 60 senior.
- Income rank `(71*n+29) % 300`: 90 low / 150 middle / 60 high.
- Both are full-cycle permutations, with 300 stable households and 900
  resident weights. The nine age/income cells are populated, within three
  simulated households of each independent-marginal expectation.
- Political cohort rank `((n-1)*29+7)%100` also breaks the original
  accidental coupling with the territorial district index `(n-1)%100`.
  All six districts now contain both cohorts while preserving exact national
  195/105 family membership and 65/35 game-design weight. A per-district
  deviation check enforces a maximum of three household agents from its
  synthetic 65% expectation.
- The stable district map (25/20/18/15/12/10 seats), founding 65/35 cohorts,
  household policy response, historical fiscal effects and election D'Hondt
  coefficients are **unchanged**.
- Existing v1 households are **not migrated or reseeded**. A government
  started before this migration keeps its v1 household snapshot; login remains
  idempotent. Authorized population profiles now advertise the stored
  household model version, and the UI understands both.
- The new rollback-only SQL acceptance covers demographic cross-tabs, all
  marginal totals, territorial coverage, election seats, access control
  and historical v1 reuse without rewriting signed acts.

**This is synthetic structural debiasing, not empirical population calibration.**
The age and income margins remain fictional game-design inputs, not sampled
real-world census demographics. The original F004.4 empirical calibration
acceptance and F007.4 human campaign playtest gates remain open.

## AOS-057 INE-source population archetype calibration

Newly created governments use `households-v3`: exactly 300 synthetic
households, 747 weighted residents (2.49 per household), with size mix
derived from INE 2026 data and explicit 2025 adult-age and municipality-size
proxies. Income buckets remain relative quintile game categories. Existing
v1/v2 worlds, election results and historical acts are not recalibrated.

Read the [independent quantitative population and electoral balance
review](POPULATION_CALIBRATION_REVIEW.md) for original sources, ranking
methodology, measurable stability criteria and remaining non-empirical
political response coefficients.

## Authorization

- Raw synthetic households are stored under RLS with no direct browser role table privileges.
- The authenticated RPC get_population_profile returns aggregate segment statistics; only the government owner or member of its multiplayer match may access them.
- No opinion estimates are claims about real voters or polling data.

## Acceptance

- Transactional SQL suite households.sql tests cardinality, idempotent generation, demographic mass, heterogeneity, decision retries, election seat conservation, owner/member/outsider authorization and atomic autonomous reactions.
- Unit tests check the React readout, demographic filters, account switches and network rejection. Chromium smoke exercises the visible explorer against intercepted HTTP.
- Full population calibration, scalability testing and manually validated real-account browser flows remain pending.
