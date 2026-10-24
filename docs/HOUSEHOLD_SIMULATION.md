# AOS-031 — Synthetic household simulator

## Model

- A government owns exactly 300 persistent synthetic household archetypes. Each carries 1–5 weighted residents. This is a small simulation sample, not an official population count.
- Two existing policy cohorts allocate 65%/35% of the archetypes. The sample size is an integer multiple of 100 to preserve exact cohort weights. Each family has age, income, settlement and ideological variation, plus individual political support and trust.
- No random calls, real identity data, client-generated votes or LLM. A unique primary key ensures safe repeated initialization. Old families are never regenerated on login.
- Existing population cohort updates from cabinet decisions or fiscal acts trigger atomic propagation of policy sensitivity factors (75%–125%) to family microstates, clamped at 0–100. This deliberately produces heterogeneous opinion, even though the national macro metrics continue to use the proven cohort engine.
- Electoral model electoral-households-v1 scores parties individually for each household against preference, incumbent trust/support and campaign influence, and weights normalized vote shares by simulated residents. The 100-seat D'Hondt allocation and deterministic tie-break remain unchanged.
- Historic elections retain their previous model version and stored snapshots. New certificates include household model version and household sample size.

## Authorization

- Raw synthetic households are stored under RLS with no direct browser role table privileges.
- The authenticated RPC get_population_profile returns aggregate segment statistics; only the government owner or member of its multiplayer match may access them.
- No opinion estimates are claims about real voters or polling data.

## Acceptance

- Transactional SQL suite households.sql tests cardinality, idempotent generation, demographic mass, heterogeneity, decision retries, election seat conservation, owner/member/outsider authorization and atomic autonomous reactions.
- Unit tests check the React readout, demographic filters, account switches and network rejection. Chromium smoke exercises the visible explorer against intercepted HTTP.
- Full population calibration, scalability testing and manually validated real-account browser flows remain pending.
