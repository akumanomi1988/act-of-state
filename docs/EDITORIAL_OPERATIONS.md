# AOS-035 — Complete operational weekly political editorial cycle

ACT OF STATE remains free to play. One real UTC day equals one in-game day.
Mondays release exactly ten political decisions anchored to separately
cited news stories. Fridays mark the end-of-week checkpoint; autonomous
fiscal, election and parliamentary settlement continues under the existing
secure calendar job.

## First publisher — trusted operator provisioning

The database intentionally starts with zero publishers. Browser identities
cannot make themselves staff. The verified Supabase project owner must
authorize and provision the first publisher out of band.

1. Have the intended operator register with a magic-link and confirm email.
2. From the trusted Supabase SQL editor, verify the intended email and UUID,
   and obtain explicit operator authorization. No browser/service key exposure.
3. As the trusted DB owner, run the following provisional transaction:

    BEGIN;
    INSERT INTO public.editorial_members(user_id,role)
    SELECT id,'publisher' FROM auth.users
    WHERE lower(email)=lower('REPLACE_WITH_VERIFIED_OPERATOR_EMAIL')
      AND email_confirmed_at IS NOT NULL
    ON CONFLICT(user_id) DO NOTHING;
    SELECT u.id,u.email,m.role FROM auth.users u
    JOIN public.editorial_members m ON m.user_id=u.id
    WHERE lower(u.email)=lower('REPLACE_WITH_VERIFIED_OPERATOR_EMAIL');
    ROLLBACK;

Replace ROLLBACK with COMMIT only after reviewing the exact UUID, account
ownership and intended access. This bootstrap has deliberately NOT been
executed in production without an approved operator identity.

Later publisher-managed grants/revocations use authenticated RPCs with
confirmed accounts, per-change audit and a serialized last-publisher guard.

## Monday to Friday release

1. Open the editorial console with an editor or publisher identity.
2. Pick a Monday and import ten distinct recent cited news references.
   Unavailable RSS sources are reported; nothing is published.
3. Prepare policy scenarios: deterministic category-based fictional context
   and three substantial policy alternatives per cited dossier, without
   overriding any human-authored context, option or parameter. Scenarios do
   not purport to be actual news facts or announced governmental measures.
4. Human editors check every original citation, political issue, option
   description and numerical effects. Save a ten-dossier draft under the
   optimistic revision protocol.
5. A publisher opens and independently checks the original news citation
   for each of ten dossiers, then explicitly approves each dossier.
   Every review records the publisher UUID, saved revision and timestamp.
   Any resave invalidates all ten reviews, including the unedited slots.
6. PostgreSQL requires ten distinct, complete, approved current-revision
   dossiers and sources. Publisher confirmation atomically materializes the
   ten dossiers, their policy options, weekly approval and immutable history.
7. Players then receive the approved week's decisions through existing
   authenticated nation/match snapshots. Results, economic changes, voting,
   Friday settlement and due elections remain server-authoritative.

## Acceptance and external dependencies

Database regression tests exercise RBAC, last-publisher security, approval
invalidation, duplicated source rollback, publication idempotence and
authorization boundaries. React and browser tests cover sourced hypothetical
policy choices, disabled publish controls, staff management and mobile WCAG.

Real human fact-checking, actual staff provisioning and a complete
authenticated cross-account week in production remain required before
declaring the weekly operation fully accepted.


## AOS-056 — mandatory five-choice publication

All NEW weekly releases now require exactly five uniquely titled and
substantively distinct policy positions per dossier (distinct policy targets,
immutable IDs, validated bounds) before the database will materialize a
Monday release. Editor drafts from earlier versions can still be loaded and
revised; any with fewer than five choices must be completed before they can
be reviewed as publishable. Already published histories are immutable and
unchanged. The newsroom's fictional scenario drafting aid proposes all
five positions but never fabricates factual source verification, auto-saves
or grants itself publishing rights.
