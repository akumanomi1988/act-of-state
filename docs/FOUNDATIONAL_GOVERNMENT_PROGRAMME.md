# AOS-043 — Authoritative foundational government programme

## Product contract

ACT OF STATE previously had two authored fictional intro dossiers. The official authenticated government now contains **ten permanent fictional political dossiers** (30 options in total): original energy and water scenarios plus housing, healthcare, education, infrastructure, employment, food supply, digital institutions and climate adaptation. These are *gameplay content*, not current news and not policy forecasts.

Every signed choice uses the **existing PostgreSQL decision RPC** and its existing concurrency, deterministic simulation, version, event history and RLS. We do not run any mathematical rules in the browser, expand privileged grants, introduce LLM-generated content or add independent local saves.

The eight new dossiers have stable IDs and option versions. Once a government has signed a dossier, the choice remains immutable. Published weekly dossiers remain separate and are sorted ahead of the permanent intro catalogue to protect time-limited legislative work.

## Five integrated systems

1. **Nation-building content.** Eight new original Spanish-language dilemmas and 24 balanced alternatives with versioned existing `treasury_delta_m_eur`, `policy_target`, `response_intensity` and `trust_base_delta` fields.
2. **Official government agenda.** Select any intro dossier, review its fiscal commitment, sign via the authenticated server RPC, inspect the persisted outcome and return to a growing archive. Existing editorial weekly dossiers remain available independently.
3. **Event-derived mandate overview.** A signed/total progress bar and a scorecard derived *exclusively* from signed immutable before/after events. Treasury (M€), approval (percentage points) and trust (percentage points) display **policy signature contributions**, not the entire cumulative state of the nation, which also evolves through the calendar and fiscal engine.
4. **Deadline-aware navigation.** Weekly dossiers shown first, with accessible filters for all, this week's news, permanent founding programme, pending, and signed. A contextual continuation action selects the next unsigned permanent dossier. No fake success conditions or election results.
5. **Onboarding, manual and release evidence.** The player's persistent onboarding reflects real completed intro dossiers and links to the detailed player guide.

## Balancing and safeguards

- For the unchanged 12,000 M€ initial treasury, signing the most expensive option in **all ten dossiers** costs 8,860 M€. This keeps the entire initial programme playable even before a weekly fiscal settlement. That constraint is covered by SQL integration tests; it is not a guarantee of a solvent long-term government because other real policies may change the treasury between decisions.
- Existing server-side insufficient-treasury, decision uniqueness, multi-account ownership, approval rules and parliamentary constraints still apply; the UI cannot fabricate a successful signature or recalculate cohort responses.
- Content does not claim that a specific choice is objectively desirable. Options trade off household and business affinities and the budget.
- A separate `/demo` guest experience remains a four-dossier, non-authoritative teaching simulation; decisions cannot be transferred to this official government.
- Scores are synthetic and constructed for gameplay, not representative human population research.

## Cloud rollout

The additive seed is tracked as `supabase/migrations/20261025145152_aos_043_foundational_campaign.sql` matching the dedicated ACT OF STATE Cloud migration history. It was deployed after passing disposable PostgreSQL suites, with the database confirming ten intro dossiers and thirty choices. This operation did not rewrite existing decisions or modify any external Supabase projects.

## Verification

The incremental SQL regression `supabase/tests/foundational_campaign.sql` verifies exactly ten intro dossiers and 30 options, distinct policy categories, full worst-case ten-decision execution, state snapshots, deterministic identical retries, conflicting retry rejection and second-identity RLS isolation. All disposable fixtures roll back.

Existing `world_snapshot.sql` has updated expected catalogue counts. No previous decision event schema or public API signature is changed. New React tests verify server-ledger-only progress, progress completion, fiscal/political deltas that cannot be polluted by background economic ticks, deadline priority, all navigation filters and empty states. The Chromium QA suite exercises sign/reload/filter and WCAG 2.1 A/AA on 390 and 1440px viewports with intercepted **synthetic** Supabase RPCs.

For acceptance require:
- Clean GitHub Actions quality pipeline: `npm ci`, oracle, TypeScript, Vitest, build and browser checks.
- Disposable PostgreSQL CI: all migrations in order plus new and existing rollback SQL suites.
- Apply the exact reviewed seed SQL to the dedicated ACT OF STATE Supabase project and confirm row counts and player-visible catalog through a read query.
- Inspect GitHub Vercel deployment result for the merged commit.
- Never mark live email login, real-human ten-party multiplayer, reviewed ten-news-week publication or manual visual/screen-reader approval as completed without corresponding real-world evidence.

## Remaining major epic

Real authenticated multi-user onboarding and a full real editorial Monday-to-Friday political week need authorized test participants and independent editorial source verification. The acceptance tracker remains strict: **2/18 (11.1%) fully accepted** until outstanding gates have independently documented evidence, even though the implementation footprint is substantially larger.
