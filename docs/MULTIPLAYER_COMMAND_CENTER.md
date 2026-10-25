# AOS-044 — Multiplayer legislative command and safe reconciliation

## Scope and production boundaries

This epic consolidates the **existing** persistent ten-party gameplay rather than
adding cosmetic features or fictitious acceptance percentages.

1. **Role-aware council agenda.** The multiplayer government receives a readable
   command board based on `get_match_world` only. Published weekly dossiers precede
   the permanent fictional programme; a filter separates current-week, foundation,
   unsigned actions and signed national acts. The board reports the user's party
   stance independently from an actual signed decision.
2. **Leadership-aware controls.** The current government/host is identified by the
   server-owned `match.host_user_id`. Only the current executive sees its signing
   tools. Other authenticated party members can choose stances and cast votes
   through existing protected RPCs; changing a browser variable grants no privilege.
3. **Fail-closed cabinet signature.** A decision with a lost HTTP acknowledgement
   is reconciled against fresh server event history. A matching signed option
   is success; a different option is a **conflict**, not a success; absence of an
   event or a failed read locks further signing until an explicit fresh sync.
   The uncertain dossier ID survives UI navigation. Switching identities or
   matches resets the in-memory lock but not any server act.
4. **Immutable-history resilience.** Polling responses with fewer existing decision
   events cannot erase a newer confirmed national act on screen. The backend
   remains authoritative; no synthetic confirmation, local event insertion or
   direct table grants are used.
5. **Parliamentary reconciliation.** Proposals, votes and tally closures are
   confirmed through `get_parliament_state` even if their write response
   is lost. No success notice appears unless the exact bill, vote or closure
   is present in the official state. Older in-flight reads cannot overwrite
   newer snapshots.
6. **Integration and browser QA.** Unit tests prove signed versus stance-only
   status, weekly UTC deadlines, personal actions, retry recovery and conflicting
   signatures. A Chromium scenario renders ten synthetic seat identities and
   independently signs in two browser contexts as government and opposition,
   checking privilege-sensitive controls, responsive layout and WCAG 2.1 A/AA.

## Boundaries of evidence

- SQL ten-party tests use eleven synthetic identities and actually invoke the
  current authorization, parliament, voting and government-decision functions
  in rollback transactions. They do **not** constitute a real SMTP-backed ten-user
  playtest.
- Browser contexts intercept synthetic Supabase HTTP responses. The UI and
  login session isolation are exercised, **not** Supabase live Auth or server
  security enforcement; the latter belongs to PostgreSQL tests.
- No additional Supabase migration is needed: the existing signed event,
  parliament state, match world, RLS and row locks are reused.
- No editorial publications are synthesized in production; weekly board
  content is derived only from actual approved dossiers in the world snapshot.

## Acceptance procedure

Require clean CI: deterministic Node oracle, TypeScript, all Vitest suites,
production build, all pre-existing Chromium tests, plus the two-role
ten-seat synthetic browser scenario, axe WCAG 2.1 A/AA and screenshots.
Check exact merge-commit Vercel status.

External sign-off remains necessary for real ten-account multiplayer gameplay,
real emails, an editor-approved and source-verified ten-news week, social/economic
balance, manual screen-reader QA and approved final visual identity.

The strict acceptance criterion remains **2 of 18 (11.1%)** until evidence
closes another existing gate. Engineering delivery is reported independently
via verified features, tested workflows, source commits and deployments,
never a guessed percentage.
