# ACT OF STATE — Game UX and player language contract

## Product identity and gameplay verbs

This is a persistent, turn-like political governance game, **not**
a project dashboard, policy analytics SaaS or a government ERP.
The player needs to identify their role, find the next pending
political action, understand its effect and return later.

The same account can participate in both supported persistent modes.
Creating an account is **not** the same action as founding a party,
starting a government or launching a legislature.

| Player term (Spanish) | Meaning / player action | Avoid in player UI |
| --- | --- | --- |
| **Menú** | Switch modes; read rules | Administrative navbar |
| **Partida individual** | Govern your own nation | Environment, workspace |
| **Partida parlamentaria** | One shared nation; up to ten parties | Multiplayer national assembly |
| **Partida de prueba** | Four local examples; **not** persistent | Live government, production preview |
| **Entrar / Crear cuenta** | Email + password | OTP as normal login, account = character |
| **Partidas** | Saved parliamentary games and invitations | Project catalog |
| **Gobierno / Oposición** | Party's legal role in shared game | Host/client, admin/user |
| **Escaño** | Seat occupied by player's party | Slot, account ID |
| **Orden del día / Expedientes** | Available issues to examine | Mission control, tickets |
| **Postura del partido** | Preference statement; nonbinding | Vote, decree |
| **Voto parlamentario** | Official vote on a proposal | Signed measure |
| **Ley aprobada** | Parliamentary result, not yet executed | Effect already applied |
| **Decreto / medida firmada** | Binding state change after authorization | API commit, persisted projection |
| **Elecciones** | Campaign and seat projection/certification | Strategy laboratory |
| **Presupuesto** | Treasury and policy allocations | Finance dashboard |
| **Historial / Actas** | Recorded effects and decisions | Audit log, system event |
| **Reglas** | Optional instructions | Tutorial checklist that cannot complete |

## UX invariants

1. **Action before reference:** the live dossier appears before the
   calendar and all charts on a phone. If there is no dossier, show
   the actual lobby or next permitted action, never a fake one.
2. **One menu, clear modes:** no duplicated rows of unrelated header
   links; mode changes are ordinary page navigation, not gameplay writes.
3. **Login is login:** opening a mode does not create a session;
   normal email/password authentication does not send an OTP email.
   Registration can require one verification email depending on Auth policy.
4. **Never promise authorization:** a party posture is not a vote;
   a vote is not a signed law; only a server-confirmed government
   decision updates country finances and living conditions.
5. **Copy follows the game state:** present party name, role, seat,
   and date from authorized match state. No invented progress
   percentages or "success" before server confirmation.
6. **Terminology serves play:** say "Expedientes parlamentarios",
   not "Centro de decisiones de la asamblea"; say
   "Agenda parlamentaria", not "Sala de operaciones legislativas";
   say "Proyección electoral", not "Laboratorio de estrategia".
   Editorial sourcing and technical version metadata remain
   available where legally/technically necessary, but are not
   repeated as decorative all-caps badges on each option.
7. **Keyboard and touch:** navigation is semantic, 44–48px target
   minimum, and all modes are reachable from the same menu.
8. **Access and privacy:** never expose identity mappings, privileged
   service keys or cross-account state to make a username-based login.
9. **Real-world scope:** demo, fictitious scenarios and empirical
   election forecasts are identified accurately. Do not imply that
   fictional reform material is live journalism.

## Evidence, release and QA

- Vitest: game mode/menu route invariants; password-only routine
  login; party role and authenticated menu paths; signed decisions.
- Chromium: login, two modes, a real decision, parliamentary action
  before folded agenda at 390px, 320px layout and automated WCAG checks.
- Isolated real GoTrue/PostgREST: password login, account isolation,
  real invitation and independently authenticated parties; no
  hosted password acceptance assumed.
- Manual outstanding: actual iOS/Android interaction, screen reader
  focus, session/resume between devices, wording comprehension with
  nontechnical players, and production Auth / SMTP confirmation policy.

All changes remain on the development branch, not on `main`.
The original commercial-acceptance score is unchanged.
