# AOS-059 — Mobile UX recovery and password-first access

## Root-cause assessment

The prior `max-width:760px` styling merely **stacked** desktop panels. The
solo government therefore rendered a lengthy agenda, calendar and dossier
catalogue before the current decision, followed by national statistics,
economic panels, population and archives. Multiplayer stacked creation and
invitation forms before the active match, then budgets, social analytics,
ten-party roster, voting, campaign and elections. Players lost task context
and often needed many viewport heights of scrolling to act.

The development branch **already implemented email/password login** with
Supabase Auth, but the last published `main` release predates that feature.
Four equally prominent access buttons in development also visually suggested
that requesting email links remained the recommended sign-in method.

## Implementation — preserved institutional visual system

Colors, typography, game data, editorial content and desktop information
panels remain unchanged. At mobile breakpoints (<=760px), the frontend now
shows **one active task area** rather than one continuous column.

### Solo

- `Decidir` (default) puts the active real dossier and its policy choices
  directly into the initial viewport, with the unchanged review-and-sign
  transaction.
- `Expedientes` gives access to the programme catalogue, calendar and
  week progress. Selecting an actual dossier returns to `Decidir`.
- `Mi país` exposes national indicators, fiscal policy, social living
  conditions, population, historical analysis and player guidance.
- A sticky tab bar preserves task context even after scrolling. Switching
  tabs or selecting history restores the top of the mobile page.
- All 3 desktop columns and analytics are still available above 760 px.

### Multiplayer

- `Jugar` (default): current dossier, personal political position,
  parliament mandate and government execution.
- `Asamblea`: activity inbox, notifications, invitation and readiness,
  party seats, parliamentary calendar and governance.
- `Elecciones`: campaigns, territorial elections and the strategy lab.
- `Mi país`: budget, social indicators, population, fiscal status, analytics.
- `Partidas`: create/join/discover games, switch matches, account security.
- Match switches and relevant inbox navigation return to the decision
  surface. No duplicate stores, client-owned electoral outcomes or new
  privileged APIs are introduced.

### Authentication and onboarding

- Primary two-option choice: `Entrar con contraseña` / `Crear cuenta`.
- Both use Supabase Auth **email + password**. A normal login calls
  `signInWithPassword` and does **not** send an email.
- Legacy OTP magic links and password recovery are under explicit help,
  not mixed with routine login. Existing account sessions, invitations
  and password rotation retain their previous security contracts.
- Registration MAY trigger one provider-required email confirmation;
  this is NOT an email at every login. A public **username alias** is not
  currently an authentication credential; implementing that would
  require a private server-side resolver and anti-enumeration protections.
- The login form appears first in mobile solo onboarding, before
  marketing copy and demos.

## Acceptance conditions and limitations

- Component tests verify task switching, no state mutations from navigation,
  preserved irreversible-action confirmations and Auth form semantics.
- Chromium automation at 375/390 px verifies the initial **decision-first**
  viewport, nonvisible secondary panels, task navigation, authorized
  interactions, no horizontal overflow and WCAG checks.
- Desktop Chromium at 1440/1800 px verifies that existing panels remain.
- Disposable GoTrue/PostgREST checks password-first login, password rotation,
  legacy/recovery links, restored multiplayer sessions, real 10-party state
  and access denial. Real password login is not verified on the hosted
  Supabase instance by this isolated workflow.
- Manual checks remain: iPhone Safari, Android Chrome 320/360/390 px,
  landscape, keyboard, TalkBack/VoiceOver, real account recovery and
  the real hosted registration/SMTP settings. A green automated run is NOT
  completion of original MVP-V004.4 or hosted Auth gates.

## Release discipline

The public release may still show the old OTP-first flow; this branch is
**not deployed**. Before any authorized merge/controlled release,
confirm production Auth email/password is enabled; decide whether one-time
signup confirmation is required; align allowed callback URLs; run a real
second-device password login, logout, recovery and account-isolation smoke.
A development-branch push is not permission to deploy Vercel or migrate
the hosted Supabase database.

This UX increment **does not alter the 18-requirement/72-checkpoint score**:
it is a functional usability improvement with its own verifiable QA, not
an invented human physical-device acceptance.


## AOS-060 — UX skill-driven refinement (2026-10-28)

The second pass targets additional friction discovered in the source:
the mobile main navigation remained fixed at the **top** (difficult
to reach with one hand), and **Mi país** still mounted all expensive
reports in a single long scroll even when none had been requested.
The multiplayer Assembly similarly combined inbox, roster and legislative
history in one section.

Implemented changes:

- Primary actions are fixed to a bottom touch bar, with safe-area
  support and a reserved footer so the final interactive control is not
  obscured. A 320px Chromium assertion checks the full 5-action bar
  without sideways scrolling.
- A reusable, keyboard-accessible nested navigation introduces
  `Resumen / Economía / Población / Historial` in Solo and Multiplayer.
  `Asamblea` now offers `Avisos / Partidos / Instituciones`.
- Mobile React no longer mounts hidden social, population, fiscal,
  historical, election and campaign panels until their corresponding
  view is selected. Switching user or match does not cache data from
  another user's games; components still use original authorized RPCs.
  On desktop, all existing panels remain visible.
- The current task gains a concise, state-derived next-action cue
  without fabricating decision success or certified election results.
- Multiplayer decision history becomes a disclosure instead of
  occupying an entire screen by default; the actual signed events
  remain intact.
- A mobile `Ayuda` menu restores access to the player guide,
  status and anonymous demo. Operational errors are raised above the
  bottom navigation, not obscured behind it.

**Skill references applied:** Vercel React Best Practices:
`bundle-conditional` (only mount data-fetching modules when the player
needs them), `rerender-derived-state-no-effect` (derive cues directly
from authoritative state), `rendering-conditional-render` (explicit
conditions), and `client-event-listeners` (share one responsive
subscription hook rather than per-panel listeners). Usability
principles: progressive disclosure, task continuity, clear feedback,
48px primary touch targets, and responsive information hierarchy.

**Evidence boundary:** These are code-level improvements with
Chromium responsive/WCAG checks and simulated multiaccount regression.
They are **not** a captured human Product Design browser audit, nor
physical iOS/Android usability signoff. Production remains unchanged;
the original final mobile human acceptance remains pending.
