# AOS-036 — Multiplayer participation, ready checks and invitation links

This module completes player-facing participation controls for ten-party
asynchronous political matches, building on existing match discovery,
elections, legislation and government decision services.

## Mechanics

1. The host creates a ten-seat match. By default the system retains the
   previous two-player minimum activation rule. Existing historical lobbies
   are not blocked. The host may enable strict ready-checks for a lobby;
   this choice is persisted server-side and changeable only before activation.
2. Each participant may affirm or withdraw readiness before activation.
   Newly joined parties are initially unready. Members cannot change anyone
   else's readiness, and only a host can toggle the ready-check requirement.
3. When ready-check is enabled, the game may start only if at least two parties
   are present and all current members, including the host, are ready.
   PostgreSQL enforces this independently of any web interface.
4. Readiness, host policy, joining, leaving and activation all take the same
   exclusive match-row lock, preventing conflicting operations during startup.
5. Non-host members can withdraw from an open lobby; their seat becomes
   available again. A rejoining participant is again unready. After starting,
   both withdrawal and readiness changes are rejected. Hosts cannot withdraw
   because they are the durable government owners.
6. Hosts can share either the code or a full multiplayer invitation URL
   containing a validated 32-character hexadecimal code. Links prefill the
   join form, including after an email magic-link login redirect and reload.
7. The existing 15-second polling refresh reconciles the count of prepared
   members, seat display and host activation eligibility.

## Security, compatibility and limitations

The host must opt into strict readiness; this is a deliberate backward-
compatibility decision. The original mandatory two-party start rule remains.
Public discovery does not disclose private invitation tokens or player IDs.
Tables remain RLS-protected and browser roles cannot mutate them directly.

The SQL rollback integration exercises eleven synthetic Auth identities, a
ten-member assembly, denial with one unready party, seat recycling, repeated
activation, post-start immutability and isolation. Browser smoke covers magic
link invitation preservation and mobile accessibility. React tests cover
party readiness, withdrawal and client-side error handling.

A real ten-account authenticated playtest and week-long political simulation
remain external acceptance criteria.
