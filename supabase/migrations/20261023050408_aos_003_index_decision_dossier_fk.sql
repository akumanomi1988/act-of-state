-- AOS-MVP-001: covering index for versioned dossier-option FK.
create index if not exists decision_events_dossier_option_fk_idx
 on public.decision_events(dossier_id,dossier_version,option_id);
