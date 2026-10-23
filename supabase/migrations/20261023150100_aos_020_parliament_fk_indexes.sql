-- AOS-020: cover both parliamentary foreign keys for predictable cascading and joins.
create index parliament_bills_proposer_fk_idx
  on public.parliament_bills(match_id,proposed_by);
create index parliament_votes_bill_match_fk_idx
  on public.parliament_votes(bill_id,match_id);
