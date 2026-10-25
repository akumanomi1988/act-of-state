# AOS-047 — Integrated political week and editorial acceptance

## Real player milestone

The asynchronous legislature now has a **weekly operations room** inside the
existing authenticated multiplayer game. It reuses the existing national
government, ten-seat parliament, press desk, calendar and historical acts.

The room is a **read-only projection** of authenticated
`get_match_world`, `get_match_calendar` and `get_parliament_state`.
It does not mint laws, invent timestamps, change who holds the cabinet or
silently treat a party position as a parliamentary vote.

### Six integrated features

1. **Editorial deadline and truthful publication status.** Only weekly dossiers
   belonging to the server-reported Monday count. Ten permanent fictional
   founding dossiers are explicitly excluded. In the absence of an approved
   weekly release, the UI reports that no verified news agenda is available.
2. **Personal action queue for ten parties.** Roles are derived solely from
   `match.host_user_id`. The room distinguishes `record stance`, `vote now`,
   `await tally`, `propose legislation`, `sign a passed law`, and
   `await executive signature`. A passed bill is not a signed act.
3. **One-click official agenda navigation.** Action links open the same case
   in the established Parliament/decision UI rather than introducing a
   second writing path. Policies still pass server mandates, account roles
   and safe idempotent signature reconciliation.
4. **Multi-source status and fail-closed refresh.** Calendar and parliament
   are fetched from the actual authenticated server. Pending, stale,
   failed and new-day states are visibly distinguished. An older incomplete
   fetch cannot overwrite a newer snapshot. A different-day snapshot
   disables all work actions until a fresh read.
5. **Legislative deadline and archive.** The authoritative Friday is the
   deadline for ongoing work. After that date, pending work is no longer
   advertised as actionable; the existing immutable weekly accountability
   panel shows historical acts and voted measures.
6. **End-to-end ten-case editorial security acceptance.** The isolated
   GoTrue/PostgREST CI now creates three authentic test identities
   (publisher, editor, outsider), grants an editorial role **only through
   local Postgres fixture bootstrap**, verifies role administration,
   ten **synthetic** articles with distinct `example.invalid` citations,
   draft versioning, ten publisher reviews, partial-review denial,
   edit-caused review invalidation, independent re-review,
   immutable publication, idempotent retry, outsider denial and
   next-week embargo.

## Release evidence — 2026-10-25

- [Merged PR #40](https://github.com/akumanomi1988/act-of-state/pull/40) is the original code delivery at `477ce9ffedac3f0cde86ebd8bfd6aa0d4cb472ff`.
- [Quality workflow #40221460826](https://github.com/akumanomi1988/act-of-state/actions/runs/40221460826) **PASS**: 181/181 Vitest, 38 test files, TypeScript/build, 15 Chromium scenarios, the two guest viewports and WCAG checks. The new Wednesday/Friday deadline and ten-seat action navigation are explicitly exercised.
- [Actual local GoTrue/PostgREST #40221460670](https://github.com/akumanomi1988/act-of-state/actions/runs/40221460670) **PASS**: `AOS_LIVE_AUTH_PASS` 126 assertions across ten JWT browser identities; `AOS_REAL_EMAIL_PASS` 26 assertions across real local Mailpit magic links; `AOS_EDITORIAL_WEEK_PASS` 60 assertions with ten **synthetic** newsroom sources, ten independent review attestations and approved immutable publication. No real external journalistic sources or production data were written.
- A build/deployment status from Vercel is independent of a live hosted human acceptance test. The full human/SMTP/editorial acceptance gates remain open.

## Quality evidence

- `src/lib/weeklyCommand.test.ts`: pure state-machine tests verify the
  ten-case count, stance/vote/signature separation, role-specific priority,
  deadline, immutable act and no-news honesty.
- `src/WeeklyMissionControl.test.tsx`: React tests verify the operational
  interface, real data dependencies, empty publication, vote controls,
  stale read fail-closed behavior, deadline and navigation.
- `tests/browser-smoke.mjs`: responsive Chromium council screenshots and
  WCAG A/AA tests now cover the open vote, Wednesday deadline, shared ten-seat
  UI and mission shortcut. Mock network only in this visual suite.
- `tests/weekly-editorial-acceptance.mjs`: genuine local GoTrue/Auth,
  PostgREST/editorial RPC integration with real PostgreSQL and rollback-free
  ephemeral data. Production SQL migrations replayed in order by the CI.
- Existing real-JWT `tests/real-auth-acceptance.mjs` and actual email-link
  `tests/magic-link-acceptance.mjs` must remain fully green.

## Strict acceptance boundary

The ten citations in the E2E test are intentionally made up and use the
non-resolving `example.invalid` domain. Their role is to verify **the
software's editorial review and publication controls**, not to publish
news. No synthetic dossier is published to the hosted ACT OF STATE project.
The actual editor and publisher must independently verify ten real articles
and write accurate policy dilemmas before a human-facing release.

Similarly, the two current browser acceptance modes are real automated
GoTrue sessions against **disposable local services**; they do not certify
external SMTP, production hosted login, a complete human ten-player week or
a human screen-reader review.

These release gates retain their partial status until independently tested.
The original strict MVP tally remains **2 of 18 (11.1%)**; engineering
coverage should be discussed independently rather than guessed as a
percentage.

## Operator follow-up for acceptance

1. Complete approved live-news dossiers and require independent publisher
   reviews for all ten; publish only after source verification.
2. Test authenticated player access in production against a seeded but
   isolated test legislature.
3. Invite ten consenting real participants and record each party's stance,
   vote, attendance and national consequences.
4. Observe the scheduled Friday/Saturday settlement, next-week embargo and
   immutable historical act through a genuine UTC calendar transition.
5. Record failure cases, retest corrected behavior, approve accessibility
   and final visuals, and only then close corresponding product criteria.
