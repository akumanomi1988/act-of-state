# MVP-F004.4 — Quantitative demographic calibration and balance review

Reviewed: 27 October 2026. Model: `households-v3`. Reference geography:
Spain (national statistics transferred into a fictional country).
**This is a quantitative simulation acceptance review, not a voter survey.**

## Empirical source register

| Official source and reference period | Published evidence | Transfer to 300 game households |
| --- | --- | --- |
| [INE: 2026–2041 household projection](https://www.ine.es/dyngs/Prensa/es/PROH20262041.htm), reference 2026 | 19,759,349 households: 5,620,017 single, 5,732,736 two, 3,916,320 three, 4,490,276 four-plus; mean 2.49 | Largest-remainder allocation: 85/87/60/68. Subdivide four-plus into 32 fours and 36 fives as a **design assumption** to obtain 747 weighted residents, mean 2.49 |
| [Health Ministry/INE: Spain population age table](https://inclasns.sanidad.gob.es/report/population/), 2025 | Age 20–34 = 8,363,747; 35–64 = 21,682,781; 65+ = 10,307,147 | Exact **adult-resident proxy** margins 62/161/77; not a survey of household heads |
| [INE: España Municipal](https://www.ine.es/infografias/infografia_censo.pdf), reference 2025 | 3.0% in municipalities under 1,000, 16.6% in municipalities of 1,001–10,000 residents | 59 in small-municipality proxy and 241 in large-municipality proxy; **not** Eurostat DEGURBA or observed households |
| [INE: household income atlas 2024](https://www.ine.es/dyngs/Prensa/ADRH2024.htm), released 19 Oct 2026 | Average net income per resident €15,948; consumption-unit median €19,950 | Relative rank **20/60/20** strata 60/180/60 (bottom quintile / middle three / top quintile); **no fabricated euro income** |

## Balance findings and measured acceptance checks

- **Mass and size.** 300 immutable household agents, with size distribution
  **85 one / 87 two / 60 three / 32 four / 36 five**; exactly **747**
  resident votes. The four-versus-five split is a game interpolation, not a
  source-observed 4+/5+ breakdown.
- **Demographic proxies.** Representative adult-age strata **62 young
  (20–34) / 161 working (35–64) / 77 senior (65+)**; settlements
  **241 municipality ≥10,000 / 59 municipality under 10,000**.
  Descriptive UI labels do not imply the game knows actual household ages.
- **Income.** Low/middle/high refer to invented *relative* quintile tiers
  **60/180/60**. Political sensitivity and the population income amount are
  simulation rules and cannot be inferred from INE household-income levels.
- **Independence.** All nine age×income cells populated and no more than
  three households apart from independent-marginal expectations; every
  district contains both founding political cohorts, plus multiple age,
  income and settlement types.
- **Political stability.** Fictional 65/35 cohort preferences are preserved,
  as are all six district seat definitions (25/20/18/15/12/10), 100-seat
  server-owned D'Hondt allocation and the original political-reaction
  coefficients. The independent numerical oracle tests 0/100 extreme,
  25/75 moderate, 50/50 tie and five-party counterfactuals: all vote shares
  remain finite, positive, and mass-normalized.
- **Historical compatibility.** `households-v1` and `households-v2` rows,
  their resident masses and old signed acts are never migrated or replayed.
  Only newly created nations receive version `households-v3`.
- **Security/rollback.** PostgreSQL transaction-only acceptance tests check
  actual seeded marginal totals, national/district 100 seats, idempotent
  initiation, authenticated member versus outsider RLS and historic v1
  preservation. No actual census row or private voter information is imported.

## Independent limitations / acceptance boundaries

INE adult-resident age shares and municipality **population** shares are
explicit *proxies* for household archetype ranking, not observed household
head-age distributions or rural-household shares. The national household size
mix and published mean are independently anchored; the model is not a
representative microdata sample of real residents. No evidence establishes
real electoral response, actual vote intent, campaign persuasion accuracy or
the effects of real legislation. These are game-design assumptions;
**MVP-F007.4 human-tested electoral cycle remains pending**.

Reproduce the numerical review with `npm run test:oracle`. Verify the actual
server seeding and 100-seat election through
`supabase/tests/household_demographic_balance.sql` and
`supabase/tests/districts.sql` on disposable PostgreSQL. Validate the UI
and integration in the branch's three GitHub CI workflows.
No hosted database or Vercel release is modified by this review.
