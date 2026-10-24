# AOS-033 — Optional public-match matchmaking

ACT OF STATE remains a free, browser-based asynchronous game. Private match
invitations continue to work exactly as before. By default a new match is
private and cannot be discovered in the public lobby directory.

## Lobby lifecycle

The authenticated host can toggle the public visibility of a pregame lobby.
The directory displays at most 40 most recently created public lobbies with
vacancies; each entry includes only the title, number of present parties,
remaining vacancies and creation timestamp. It reveals no invite codes,
national statistics, host account identifiers or opponent profiles.

An authenticated player chooses a public lobby and a unique party name. The
join RPC verifies that the lobby is publicly advertised, then reuses the
existing locked and bounded ten-seat allocator. Joins are idempotent for
existing players and serialize with invite joins, host visibility updates and
the act of starting the match. A closed, full, hidden or started match cannot
be joined as a new player. The lobby directory is eventually consistent,
with a 30-second refresh; the database is the sole authority for admission.

## Security

No anonymous RPC grants, no direct client table permissions, no service keys
and no new data exposure. Owners can change only the visibility of their own
pregame match. Existing matches are private by default. The invitation token
is used only inside the security-definer join function; the directory API
never returns it.

## Verification

- PostgreSQL rollback suite tests default privacy, direct UUID attempts,
  cross-user toggle denial, selective discoverability, token suppression,
  idempotent authenticated joins, unpublish and post-start restrictions.
- Typed browser helper rejects invalid directory responses. Component
  tests cover join flow, account change and error recovery.
- GitHub PostgreSQL 17 and Chromium checks run before production release.
  Real multi-identity acceptance still requires externally provisioned
  authenticated test accounts.
