# AOS-024 — Editorial news discovery

## Purpose

A logged-in, authorized editorial worker can discover source citations from four pre-approved public RSS feeds and copy one reference into a selected unpublished dossier slot. The worker must independently read and verify the source, write a neutral policy dilemma, design 2–4 balanced options, save a revision, and obtain explicit publisher approval. **Nothing is auto-published or presented as verified merely because it appeared in a feed.** Headlines are source references, not simulation-generated political facts.

## Dataflow and permissions

1. `/editorial` checks the current authenticated user's staff role (existing editorial membership/RLS).
2. The opt-in source picker calls the Supabase function `news-discovery` with the current user JWT. The Edge Function uses `verify_jwt=true`, verifies the Auth user again and checks `editorial_members` through the caller's own RLS permissions.
3. Only four hardcoded feed URLs are retrievable: The Guardian politics/world and BBC politics/business. There is no arbitrary remote URL argument or proxy. Redirects fail closed, upstream reads have a 7-second timeout and 500 KB response cap; output is limited to 30 recently dated records per feed with host/HTTPS validation and duplicate suppression.
4. The editor chooses a headline and explicitly clicks **Vincular fuente**. Only `source_url`, `source_title`, `source_published_at` are populated; the existing draft stays **unsaved** until the human explicitly saves it.
5. Existing CAS-protected editorial publication requirements remain authoritative and unchanged.

## Release verification

- `npm run test:oracle` covers the RSS parser's source whitelist, entity decoding, date constraints, duplicate rejection, unsafe links and malformed feed cases alongside the deterministic political oracle.
- `npm test` includes component coverage for user-triggered fetches, source linking, readonly states, duplicate selection, malformed metadata and failures.
- `npm run typecheck`, `npm run build`, GitHub PR checks.
- Deploy `supabase/functions/news-discovery/index.ts` with `rss.mjs` in the same Edge Function bundle and **`verify_jwt=true`**.
- Negative live test: unauthenticated invocation must not return articles; live positive test requires a verified authorized editor. Never manufacture a staff account or an email auth session solely for testing.
- Inspect returned real-world citations before describing this as an operational news source. RSS availability and terms can change.

## Known scope exclusions

No article text scraping, LLM facts, automatic ten-item selection, automatic option generation, automated factual verification, editorial role assignment or bypass of the Monday embargo. Four English-language sources are a seed catalog, not geographically balanced coverage of Spain, the EU and world affairs. Automated source ingestion into ten publishable dossiers remains a future feature.

## Operational dependencies

Real user authentication remains obstructed when Supabase's built-in SMTP reaches its free quota. Configure a trusted SMTP provider or a separately configured OAuth identity provider without leaking credentials to the frontend. A source feed being online does not bypass Auth or editorial approval.
