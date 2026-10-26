# AOS-055 — International Diplomacy

## Gameplay
The programme gains three new fictional diplomatic dossiers: Europe, Asia,
and United States. Each has five distinct fiscal and geopolitical choices.
The existing 28 dossiers and 140 options remain untouched. Development now
contains 31 permanent dossiers and 155 alternatives.

A cabinet can sign a diplomatic dossier using the existing national decision
engine. In Parliament the treaty needs a binding prior vote; a party stance or
a failed bill is not a government signature.

## Model and durability
Each treaty option owns three versioned impact vectors, for 45 total.
The signed national decision insert atomically snapshots the three effects
into a private immutable diplomacy ledger. Retrying an original government
signature cannot double-count geopolitics or fiscal effects. Accumulated
relation scores start at neutral 50 (range 0..100). The fictional trade
index starts at 100 (range 0..200). These are NOT real country indicators
or objective geopolitical predictions.

Players can see only their own government or legitimate match's diplomatic
snapshot through an authenticated RPC. RLS and revoked direct table grants
prohibit browser-side diplomacy writes or cross-government inspection.
Both solo and ten-party UIs display verified regional indices, signed
history and direct navigation to the real legislative dossier.

## Acceptance and release
Unit, SQL, live GoTrue/Parliament and Chromium mobile accessibility
checks are required for isolated technical acceptance. Real geopolitical
balance, human week-long play and staffed real-news publication remain
outside technical acceptance. Do not apply hosted Supabase migration,
merge main, or deploy Vercel without separate approval.
