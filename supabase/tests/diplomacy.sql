-- AOS-055: signed, immutable diplomatic effects and ownership/match isolation.
-- All accounts and acts are synthetic and rolled back.
BEGIN;
INSERT INTO auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,created_at,updated_at)
VALUES
('55000000-0000-4000-8000-000000000001','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','diplomacy-1@example.invalid','',now(),now(),now()),
('55000000-0000-4000-8000-000000000002','00000000-0000-0000-0000-000000000000',
 'authenticated','authenticated','diplomacy-2@example.invalid','',now(),now(),now());
DO $$
BEGIN
 IF (SELECT count(*) FROM public.diplomacy_option_effects)<>45 THEN
  RAISE EXCEPTION 'DIPLOMACY_EFFECT_CATALOGUE_INCOMPLETE';
 END IF;
END $$;
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','55000000-0000-4000-8000-000000000001',true);
DO $$
DECLARE
 g public.governments%rowtype;
 one public.decision_events%rowtype;
 again public.decision_events%rowtype;
 second public.decision_events%rowtype;
 third public.decision_events%rowtype;
 s jsonb; b jsonb;
 deny boolean:=false;
BEGIN
 g:=public.start_government();
 s:=public.get_diplomacy_state(g.id);
 IF s->>'modelVersion'<>'diplomacy-v1' OR
   jsonb_array_length(s->'blocs')<>3 OR jsonb_array_length(s->'recentEffects')<>0
   OR (s->'blocs'->0->>'relation')::integer<>50 OR
   (s->'blocs'->1->>'tradeIndex')::integer<>100
 THEN RAISE EXCEPTION 'DIPLOMACY_STARTING_SNAPSHOT_INVALID %',s; END IF;
 IF (SELECT count(*) FROM public.dossiers WHERE programme_chapter='diplomacy')<>3 OR
   (SELECT count(*) FROM public.dossier_options o JOIN public.dossiers d
       ON d.id=o.dossier_id AND d.version=o.dossier_version
       WHERE d.programme_chapter='diplomacy')<>15
 THEN RAISE EXCEPTION 'DIPLOMACY_AUTHORING_INCOMPLETE'; END IF;
 one:=public.submit_decision(g.id,'diplomacy-europe',1,'europe-social-treaty');
 again:=public.submit_decision(g.id,'diplomacy-europe',1,'europe-social-treaty');
 IF one.id<>again.id OR one.option_title_snapshot<>'Tratado de movilidad social'
 THEN RAISE EXCEPTION 'DIPLOMACY_RETRY_OR_ARCHIVE_FAILED'; END IF;
 s:=public.get_diplomacy_state(g.id);
 IF (s->'blocs'->0->>'relation')::integer<>64
   OR (s->'blocs'->1->>'relation')::integer<>47
   OR (s->'blocs'->2->>'relation')::integer<>52
   OR jsonb_array_length(s->'recentEffects')<>3
 THEN RAISE EXCEPTION 'DIPLOMACY_FIRST_SIGNATURE_INCOMPLETE %',s; END IF;
 second:=public.submit_decision(g.id,'diplomacy-asia',1,'asia-supply-compact');
 third:=public.submit_decision(g.id,'diplomacy-usa',1,'usa-cyber-accord');
 s:=public.get_diplomacy_state(g.id);
 IF jsonb_array_length(s->'recentEffects')<>9
   OR (s->'blocs'->0->>'relation')::integer<>70
   OR (s->'blocs'->1->>'relation')::integer<>60
   OR (s->'blocs'->2->>'relation')::integer<>63
   OR (s->'blocs'->0->>'tradeIndex')::integer<>104
   OR (s->'blocs'->1->>'tradeIndex')::integer<>104
   OR (s->'blocs'->2->>'tradeIndex')::integer<>102
   OR (s->'blocs'->1->>'signedEffects')::integer<>3
 THEN RAISE EXCEPTION 'DIPLOMACY_COMPOUNDING_INVALID %',s; END IF;
 BEGIN
   PERFORM public.submit_decision(g.id,'diplomacy-europe',1,'europe-border-controls');
 EXCEPTION WHEN sqlstate 'P0001' THEN deny:=true;
 END;
 IF NOT deny THEN RAISE EXCEPTION 'CONTRADICTORY_DIPLOMACY_SIGNATURE_ACCEPTED'; END IF;
 deny:=false;
 BEGIN
   UPDATE public.diplomacy_events SET relation_delta=20 WHERE government_id=g.id;
 EXCEPTION WHEN insufficient_privilege THEN deny:=true;
 END;
 IF NOT deny THEN RAISE EXCEPTION 'CLIENT_DIPLOMACY_LEDGER_MODIFICATION_ALLOWED'; END IF;
 deny:=false;
 BEGIN
   INSERT INTO public.diplomacy_option_effects
   (dossier_id,dossier_version,option_id,bloc,relation_delta,trade_delta)
   VALUES('diplomacy-europe',1,'europe-social-treaty','usa',20,5);
 EXCEPTION WHEN insufficient_privilege THEN deny:=true;
 END;
 IF NOT deny THEN RAISE EXCEPTION 'CLIENT_DIPLOMACY_EFFECT_MANIPULATION_ALLOWED'; END IF;
 PERFORM set_config('request.jwt.claim.sub','55000000-0000-4000-8000-000000000002',true);
 deny:=false;
 BEGIN
   PERFORM public.get_diplomacy_state(g.id);
 EXCEPTION WHEN insufficient_privilege THEN deny:=true;
 END;
 IF NOT deny THEN RAISE EXCEPTION 'DIPLOMACY_CROSS_ACCOUNT_READ_ALLOWED'; END IF;
 deny:=false;
 BEGIN
   PERFORM public.submit_decision(g.id,'diplomacy-asia',1,'asia-labor-standards');
 EXCEPTION WHEN insufficient_privilege THEN deny:=true;
 END;
 IF NOT deny THEN RAISE EXCEPTION 'DIPLOMACY_CROSS_ACCOUNT_SIGNATURE_ALLOWED'; END IF;
END $$;
ROLLBACK;

