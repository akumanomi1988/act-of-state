# AOS-050 — A complete fictional national reform campaign

## Player-facing campaign

ACT OF STATE now contains **28 permanent, original political dossiers and
84 policy alternatives**: the ten unchanged founding cases and four
additional reform chapters containing 18 dilemmas and 54 choices.

| Chapter | Cases | Alternatives |
| --- | ---: | ---: |
| Foundation (AOS-043, unchanged) | 10 | 30 |
| Society and welfare | 5 | 15 |
| Economy and resources | 5 | 15 |
| Institutions and democracy | 4 | 12 |
| Resilience and foreign relations | 4 | 12 |
| **Total** | **28** | **84** |

Each of the eighteen new cases contains original fiction, a meaningful
sector-specific context, three distinct fiscal and ideological alternatives,
a deterministic voter-cohort response and one immutable signed national act.
The topics are pensions, community mental health, eldercare, public safety,
culture, tax compliance, industrial reconversion, local enterprise, debt
credibility, circular resources, judicial delays, regional autonomy,
procurement integrity, participation, drought, epidemic preparedness,
critical cyber resilience and external supply dependence.

No actual national forecasts, polls, statistics, breaking events,
journalistic articles or living people are represented by these authored
fictional situations.

## Existing system contracts

- The existing `public.submit_decision` engine authorizes the government,
  applies validated treasury/cohort effects, atomically records history,
  protects retries and rejects contradictory choices. No browser-calculated
  effects, new mutation endpoint or client-held balance are introduced.
- In an active ten-party match, `propose_parliament_bill`,
  `record_match_stance`, `cast_parliament_vote` and the Parliament
  mandate trigger require the same binding vote as any other legislation.
  Cabinet ownership cannot bypass it, and a party stance alone is not law.
- `get_government_world` and `get_match_world` already return the permanent
  catalogue and full effects through their authorized per-owner/member RPCs.
  The two new nullable columns `programme_chapter` and
  `programme_order` provide only display metadata; they do not grant data
  access or bypass RLS.
- AOS-043's original ten IDs and thirty option IDs, costs, responses,
  permanent state and archived acts remain **unchanged**. The new
  migration assigns those IDs a display group without changing effects.
- Weekly editorial dossiers remain a completely separate
  `release_kind='weekly'` with real sourcing, ten-case publication,
  individual publisher reviews and Friday deadline. The new database
  constraint **forbids attaching a fictional chapter to a weekly dossier**.
  No invented news is imported or automatically published.

## Player experience

- Solo: independently tracked 10-case founding programme, 18-case reform
  campaign and four chapter subtotals; resume the next unsigned policy or
  browse any category. Each chapter remains accessible even after founding.
- Shared Parliament: government and opposition see the same new catalogue,
  yet each party's recorded stance is personal; only the server-signed acts
  count toward binding progress. Six new filters separate each campaign
  chapter from the real-news agenda.
- Accessible labels explicitly mark permanent scenarios as fiction. Mobile
  layouts collapse the chapter grid; progress bars state signed and total
  counts. Completing the authored campaign never fabricates an election,
  editorial publication or an end-of-life condition for the continuing game.

## Verification / testing boundary

Added `supabase/tests/reform_programme.sql` to the disposable PostgreSQL
matrix. It validates 18 unique dossier IDs, 54 options, complete category
coverage, meaningful fiscal alternatives, stable ordering, publication
isolation, a full 18-decision signing journey, exact idempotent retries,
archived signed outcomes and cross-owner isolation. Legacy founding and
editorial golden suites are updated to continue verifying the original ten
dossiers and distinct weekly published news separately.

The isolated GoTrue/ten-JWT integration extends its real Parliament path to
a second signed pension-law mandate and a persistent fiscal ledger. Unit,
React and existing Chromium regressions cover independent campaign progress
and new navigation.

**No production deployment, new hosted Supabase migration or real editorial
publication is included in this development branch.** These files cannot
be declared externally accepted until CI validates the branch and a human
authorizes an eventual release.

## Pending full-product acceptance

This is an authored gameplay expansion, **not** completion of ACT OF STATE as
a commercially accepted product. Real external SMTP, staffed real-news
publication, a complete human multiweek ten-party playtest, empirical balance,
human art and screen-reader sign-off, long-term production operation and
recovery remain independent acceptance gates. The strict tally remains
**2/18** until each original requirement's entire acceptance scope is
certified.
