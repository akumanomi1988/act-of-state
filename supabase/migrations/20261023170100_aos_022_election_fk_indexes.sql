-- AOS-022: support both election-result composite foreign keys.
-- Keeping these indexes avoids a full scan when a match-party identity is removed.
create index match_elections_incumbent_fk_idx
  on public.match_elections(match_id,incumbent_user_id);
create index match_elections_winner_fk_idx
  on public.match_elections(match_id,winner_user_id);
