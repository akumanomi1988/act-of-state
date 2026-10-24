# AOS-034 — Territorial Representation and Persistent Regional Electorate

The national legislature has six entirely fictional constituencies. The 300
persistent synthetic households of each government now retain an immutable
regional assignment. No real voter details, addresses or political polling
data are used.

## Geography

Districts are Capital (25 seats), Industrial Corridor (20), Coast (18),
Agrarian Plains (15), Highlands (12) and Interior Frontier (10).
Their assembly representation totals 100 seats. The assignment of the 300
persistent family archetypes is deterministic by household index, with
75, 60, 54, 45, 36 and 30 family samples, respectively. Preexisting
household states and historic decisions are never regenerated.

## Electoral mechanics

Each district counts its synthetic households independently. A family's
residents are distributed between the parties using its policy preferences,
the incumbent's support/trust, campaign influence and manifesto distance.
D'Hondt quotients allocate exactly the mandated seats of each district.
Ties favor the earlier original party seat number. Aggregated district
seats become the existing 100 parliamentary mandates. Confidence votes,
parliamentary bills and government transitions continue using the certified
mandates without introducing a second source of authority.

The election model is versioned as electoral-districts-v1. New certified
acts persist a six-district geographic result snapshot. Historical elections
retain their former version and national outcome and are not recalculated.

## Player experience

The population panel adds a territorial dimension showing regional households,
resident weights, government support, public trust and assigned mandates.
The election panel exposes per-district projections, party seat allocation
and frozen certified district records. All access uses authenticated,
owner/member-checked aggregate RPCs. Direct browser access to raw family and
district tables is denied.

## Acceptance and limitations

The SQL rollback suite checks regional membership, population conservation,
regional/national seat totals, repeatability and cross-account isolation.
Existing election, campaign and parliamentary regressions guard continuity.
React unit tests cover territorial projections; Chromium browser and Supabase
Cloud migrations must pass before release.

This is a designed fictional electoral mechanic, not a statistical projection
of real-life regional elections. Real-world calibration, spatial policy effects
and external domain review are still outstanding.
