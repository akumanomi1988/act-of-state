# ACT OF STATE — Authenticated local MCP bridge (AOS-057)

The game stays browser-first and free. An optional local Node.js stdio server
uses the official MCP v2 SDK, pinned to 2.4.0, and the already established
Supabase authenticated RPCs. No privileged API keys or new cloud service.

## Setup

Run npm ci in mcp/. Configure the following variables in your trusted MCP
host's per-connector secure environment (never add them to a repository):

- AOS_SUPABASE_URL: the dedicated DEV Supabase HTTPS base URL
- AOS_SUPABASE_PUBLISHABLE_KEY: public/publishable API key, never service_role
- AOS_USER_ACCESS_TOKEN: short-lived authenticated user JWT for that game

Configure the MCP host command as node, with args containing the absolute
path to the mcp/server.mjs file. The host must ask before stateful actions.

## Tools

Read-only: list_matches, inspect_cabinet, inspect_match,
inspect_parliament, inspect_calendar, inspect_diplomacy,
inspect_party_finances.

Stateful: record_stance, propose_bill, cast_vote, sign_decision.
All mutating actions demand confirm:true and are marked destructive.
The connected user's actual PostgreSQL JWT identity and game permissions
remain the final authority. Never retry an uncertain stateful result
without consulting official signed history. No anonymous fallback exists.

## Verification and limitations

npm test in mcp/ runs real protocol client/server handshake tests,
permission-error propagation, input validation, confirmation enforcement,
credential transport and response redaction. GitHub CI uses the
independent pinned lockfile and ephemeral runner without hosted credentials.

JWT expiration requires ordinary reauthentication. No persistent session,
email, password or refresh tokens are stored by this adapter. Real hosted
Supabase user login and external MCP host UI are NOT_TESTED and require
authorized developer verification. The bridge does not fabricate another hosted service or claim full internationalized UI acceptance.
