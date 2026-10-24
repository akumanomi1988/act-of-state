# AOS-032 — High-throughput weekly editorial sourcing

## Purpose

The national political calendar requires ten important dossiers every Monday.
Each dossier must refer to a real publicly sourced report. The editorial
workbench now offers a one-click action to prepare ten distinct source
citations from the six existing allowlisted RSS endpoints. It does not
automatically infer legislation, political consequences or publish news.

## Authorized ingestion path

1. An authenticated editor or publisher opens the editorial workbench.
2. Six independent authenticated GET requests use the existing Supabase
   news-discovery Edge Function. It limits requested feeds, validates staff
   roles, restricts hosts and redirects, limits RSS document size and times out.
3. The browser revalidates each HTTPS citation, timestamp, origin and content
   length, restricting entries to the preceding fourteen days.
4. Eligible sources are selected round-robin across news sections, at most
   three per feed, and tracking variants and previously used URLs are removed.
5. Only untouched dossiers receive a provisional neutral title, broad policy
   category and citation metadata. The policy context and choices remain
   incomplete. Human editors must independently verify the source, analyze the
   political dilemma and author balanced, consequential policy options.
6. No draft is saved automatically. The existing optimistic concurrency
   editorial save and separate publisher-review workflow remain authoritative.
   No news is published on the basis of an unreviewed headline.

## Backend integrity

AOS-032 migration adds a distinct news-source URL requirement to the atomic
publication RPC. A publisher cannot materialize multiple dossiers referencing
one identical article, even by calling the RPC directly. Existing published
decisions and historical acts are not changed.

## Verification

- Vitest covers source allowlists, deduplication, diversification, stale
  timestamps, credential-bearing URLs, incomplete source handling and
  preservation of authored editorial content.
- PostgreSQL rollback integration tests forbid a duplicate-source slate and
  confirm that a corrected unique slate remains publishable and idempotent.
- Browser Chromium mocks authenticated role-based newsroom discovery and
  verifies ten references, nonpublication, mobile responsiveness, no implicit
  persistence and accessibility.
- Third-party RSS uptime, real editor credentials, factual verification and
  unattended editorial staffing are outside these automatic tests.
