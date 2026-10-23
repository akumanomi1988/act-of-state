-- AOS-026: index all confidence governance FK prefixes reported by Supabase advisors.
-- No data change, no widening of table grants or exposed RPC surface.
create index match_confidence_candidate_fk_idx
  on public.match_confidence_motions(match_id,candidate_id);
create index match_confidence_incumbent_fk_idx
  on public.match_confidence_motions(match_id,incumbent_id);
create index match_confidence_proposer_fk_idx
  on public.match_confidence_motions(match_id,proposer_id);
create index match_confidence_vote_motion_match_fk_idx
  on public.match_confidence_votes(motion_id,match_id);
