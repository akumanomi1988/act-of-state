-- Cover the immutable stance -> dossier option foreign key for efficient checks.
create index if not exists match_stances_option_fk_idx on public.match_stances(dossier_id,dossier_version,option_id);
