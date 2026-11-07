# ACT OF STATE — Radical Simple-Play Mode

## Goal

A browser game, not an administrative dashboard: **see a crisis → choose
a measure → read the consequences → advance toward an electoral checkpoint**.
The first decision requires no registration, editorial publication or manual.

The default root page (/) uses SimpleSoloApp; the previous comprehensive
dashboard remains available at /advanced. Parliamentary gameplay stays at
/multiplayer, separate from solo onboarding. The original simulator, economic
rules, historical events and authorization boundaries remain intact.

## Player flow

1. Enter the site and see one fictional dilemma and three political choices.
2. Choose a measure and confirm it with one action.
3. See a narrative result with popularity, treasury and trust changes.
4. Advance with one button; twelve initial scenarios work as a browser guest.
5. Reach a **fictional, deterministic election forecast** at decision 12.
6. After saving to an account, continue the same simplified gameplay through
   **28** seeded permanent scenarios, with further electoral milestones at
   decisions 24 and 28.
7. Detailed budgets, demographics and parliamentary institutions remain optional
   through the menu; they do not interrupt normal gameplay.

No real-news publication is needed to complete these permanently authored cases.

## Guest-to-account transition

The versioned local storage key is aos:simple-guest:v1. Browser saves are
validated for case IDs, option IDs, uniqueness, order and affordability.
Guest effects are **previews**, not authoritative simulation outputs.

After signup/login, the player explicitly chooses whether to import the
guest decisions. Import verifies the authenticated government owner and the
latest server state, then invokes the existing protected submit_decision RPC
for each case. Every write is reconciled against immutable server events.
Previously signed choices with different options halt the import rather than
overwriting any data. Lost HTTP responses are checked before reattempting.
Guest storage is cleared only after the complete transfer succeeds.

This is a *resumable*, not a multi-case atomic, import: if the connection
breaks midway, already committed choices remain signed. A retry skips
identical saved acts, and a player can decline the import.

## Election rule

The solo-only election score is intentionally explicit and fictional:

- 60% popularity;
- 25% institutional trust;
- 15% remaining treasury, capped against the initial treasury.

A score of at least 50 gives an estimated re-election. Scores are bounded
to 0–100. The result is based on the signed outcome at the checkpoint and
is **not** a certified D'Hondt parliamentary election. The multiplayer
electoral engine and its persistent acts are unchanged.

## Engineering guardrails

- Existing /advanced and /multiplayer modes are preserved.
- Server-owned decision state never comes from the guest preview.
- No anonymous access is granted to authenticated government RPCs.
- No data migration or production Supabase change is made by this feature.
- Unconfirmed signatures block resubmission until reconciliation.
- Scenarios are explicitly fictional; the news editorial pipeline remains
  separate and protected by its existing approval rules.

## Verification and release

Vitest covers deterministic guest play, parsing and corruption rejection,
guest import/resume/conflicts, result navigation, elections and reset.
Chromium scripts test the anonymous homepage and continue to test the old
dashboard at /advanced.

Physical iOS/Android usability, hosted password authentication, SMTP,
production schema parity, final human accessibility, multiweek editorial
operation and live multiplayer acceptance are still unverified. This branch
does not authorize a merge or Vercel deployment.

Before publication: verify passing typecheck/unit/oracle/build/browser checks,
confirm the permanent 28-case migrations exist in the dedicated hosted
Supabase project, then run real-device and real-account tests. Deployment
requires explicit authorization from the owner.
