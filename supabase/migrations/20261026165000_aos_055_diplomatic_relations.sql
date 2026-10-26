-- AOS-055: fictional geopolitical diplomacy; 3 campaigns x 5 meaningful choices.
-- Existing policy signatures, Parliament mandates, historical fiscal events and authored dossier versions stay immutable.
ALTER TABLE public.dossiers DROP CONSTRAINT dossier_programme_chapter_check;
ALTER TABLE public.dossiers ADD CONSTRAINT dossier_programme_chapter_check
 CHECK(programme_chapter is null or programme_chapter in
 ('founding','society','economy','institutions','resilience','diplomacy'));
INSERT INTO public.dossiers(id,version,title,context,category,release_kind,programme_chapter,programme_order)
VALUES
('diplomacy-europe',1,'Pacto político con Europa','Escenario ficticio: Arcadia afronta una negociación de acceso industrial, movilidad de profesionales y reglas comunes con su bloque europeo. Los socios condicionan la cooperación al cumplimiento de acuerdos, mientras el Parlamento debate soberanía, empleo y derechos sociales. Ninguna vía elimina todos los costes.','Europa','intro','diplomacy',1),
('diplomacy-asia',1,'Rutas comerciales con Asia','Escenario ficticio: Las cadenas de suministro asiáticas concentran recursos tecnológicos y transporte marítimo esenciales para Arcadia. El gabinete debe repartir riesgos entre comercio, producción interna, clima y derechos laborales sin inventar hechos sobre países reales.','Asia','intro','diplomacy',2),
('diplomacy-usa',1,'Alianza transatlántica con Estados Unidos','Escenario ficticio: Arcadia busca equilibrar cooperación tecnológica, seguridad y autonomía regulatoria ante una propuesta de alianza con Estados Unidos. Cada pacto afecta socios europeos y asiáticos de manera distinta y debe superar el escrutinio del Parlamento.','Estados Unidos','intro','diplomacy',3);
INSERT INTO public.dossier_options(dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,policy_target,response_intensity,trust_base_delta)
VALUES
('diplomacy-europe','1','europe-social-treaty','Tratado de movilidad social','Negociar reconocimiento mutuo de derechos laborales y movilidad de profesionales, con fondos de adaptación territorial.',-440,30,31,4),
('diplomacy-europe','1','europe-industrial-market','Mercado industrial compartido','Abrir compras industriales y estándares comunes europeos a cambio de ayudas de reconversión supervisadas.',-260,68,28,2),
('diplomacy-europe','1','europe-border-controls','Control fronterizo soberano','Limitar temporalmente concesiones regulatorias para conservar capacidad estatal, aceptando menor integración comercial.',180,86,37,-4),
('diplomacy-europe','1','europe-green-compact','Pacto verde de infraestructuras','Compartir inversión en redes y adaptación climática con cláusulas verificables de transparencia energética.',-510,40,30,3),
('diplomacy-europe','1','europe-multilateral-audit','Mesa multilateral independiente','Pactar una supervisión externa de acuerdos comerciales y resolver discrepancias mediante arbitraje transparente.',-120,53,23,2),
('diplomacy-asia','1','asia-supply-compact','Acuerdo de suministros críticos','Negociar proveedores diversificados y almacenamiento estratégico sujeto a controles de origen y continuidad.',-370,65,33,2),
('diplomacy-asia','1','asia-labor-standards','Cláusulas laborales recíprocas','Condicionar nuevos contratos a normas verificables de empleo y protección laboral con auditorías independientes.',-190,33,26,4),
('diplomacy-asia','1','asia-import-restrictions','Restricciones industriales estratégicas','Aplicar límites selectivos a importaciones críticas para impulsar producción nacional, asumiendo fricciones comerciales.',240,88,35,-4),
('diplomacy-asia','1','asia-research-network','Red científica transpacífica','Financiar intercambios universitarios y laboratorios compartidos con protección de resultados e información sensible.',-420,43,27,3),
('diplomacy-asia','1','asia-maritime-cooperation','Cooperación marítima abierta','Impulsar corredores portuarios transparentes y normas de seguridad compartidas sin exclusividad geopolítica.',-230,52,28,2),
('diplomacy-usa','1','usa-cyber-accord','Acuerdo de ciberseguridad conjunto','Coordinar respuesta a incidentes y capacitación técnica con garantías de soberanía de datos y supervisión parlamentaria.',-350,70,30,2),
('diplomacy-usa','1','usa-tech-license','Licencias tecnológicas recíprocas','Intercambiar licencias industriales y formación en fabricación avanzada con mecanismos de salida y competencia justa.',-310,60,30,2),
('diplomacy-usa','1','usa-security-neutrality','Neutralidad estratégica activa','Mantener autonomía en defensa y contratos estratégicos, aceptando una reducción de cooperación bilateral.',170,35,35,-3),
('diplomacy-usa','1','usa-cultural-exchange','Programa cultural y académico','Ampliar becas y cooperación cultural con garantías de accesibilidad pública y evaluación fiscal transparente.',-160,42,21,4),
('diplomacy-usa','1','usa-open-trade-council','Consejo de comercio trilateral','Abrir una mesa con representantes europeos y asiáticos para negociar acceso no exclusivo al mercado estadounidense.',-275,55,31,3);

CREATE TABLE public.diplomacy_option_effects (
  dossier_id text NOT NULL,
  dossier_version integer NOT NULL,
  option_id text NOT NULL,
  bloc text NOT NULL CHECK (bloc IN ('europe','asia','usa')),
  relation_delta smallint NOT NULL CHECK (relation_delta BETWEEN -20 AND 20),
  trade_delta smallint NOT NULL CHECK (trade_delta BETWEEN -10 AND 10),
  PRIMARY KEY(dossier_id,dossier_version,option_id,bloc),
  FOREIGN KEY(dossier_id,dossier_version,option_id)
    REFERENCES public.dossier_options(dossier_id,dossier_version,id)
);
ALTER TABLE public.diplomacy_option_effects ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diplomacy_option_effects FROM public,anon,authenticated;

INSERT INTO public.diplomacy_option_effects(dossier_id,dossier_version,option_id,bloc,relation_delta,trade_delta)
VALUES
('diplomacy-europe',1,'europe-social-treaty','europe',14,2),
('diplomacy-europe',1,'europe-social-treaty','asia',-3,-1),
('diplomacy-europe',1,'europe-social-treaty','usa',2,0),
('diplomacy-europe',1,'europe-industrial-market','europe',12,5),
('diplomacy-europe',1,'europe-industrial-market','asia',-7,-3),
('diplomacy-europe',1,'europe-industrial-market','usa',1,1),
('diplomacy-europe',1,'europe-border-controls','europe',-15,-6),
('diplomacy-europe',1,'europe-border-controls','asia',2,1),
('diplomacy-europe',1,'europe-border-controls','usa',5,2),
('diplomacy-europe',1,'europe-green-compact','europe',15,3),
('diplomacy-europe',1,'europe-green-compact','asia',4,2),
('diplomacy-europe',1,'europe-green-compact','usa',-4,-1),
('diplomacy-europe',1,'europe-multilateral-audit','europe',8,1),
('diplomacy-europe',1,'europe-multilateral-audit','asia',6,2),
('diplomacy-europe',1,'europe-multilateral-audit','usa',6,1),
('diplomacy-asia',1,'asia-supply-compact','europe',2,1),
('diplomacy-asia',1,'asia-supply-compact','asia',16,6),
('diplomacy-asia',1,'asia-supply-compact','usa',-4,-1),
('diplomacy-asia',1,'asia-labor-standards','europe',9,2),
('diplomacy-asia',1,'asia-labor-standards','asia',7,1),
('diplomacy-asia',1,'asia-labor-standards','usa',4,1),
('diplomacy-asia',1,'asia-import-restrictions','europe',4,-1),
('diplomacy-asia',1,'asia-import-restrictions','asia',-16,-7),
('diplomacy-asia',1,'asia-import-restrictions','usa',5,1),
('diplomacy-asia',1,'asia-research-network','europe',3,0),
('diplomacy-asia',1,'asia-research-network','asia',13,3),
('diplomacy-asia',1,'asia-research-network','usa',8,2),
('diplomacy-asia',1,'asia-maritime-cooperation','europe',7,2),
('diplomacy-asia',1,'asia-maritime-cooperation','asia',12,4),
('diplomacy-asia',1,'asia-maritime-cooperation','usa',3,1),
('diplomacy-usa',1,'usa-cyber-accord','europe',4,1),
('diplomacy-usa',1,'usa-cyber-accord','asia',-3,-1),
('diplomacy-usa',1,'usa-cyber-accord','usa',15,3),
('diplomacy-usa',1,'usa-tech-license','europe',1,1),
('diplomacy-usa',1,'usa-tech-license','asia',1,0),
('diplomacy-usa',1,'usa-tech-license','usa',16,5),
('diplomacy-usa',1,'usa-security-neutrality','europe',7,2),
('diplomacy-usa',1,'usa-security-neutrality','asia',6,2),
('diplomacy-usa',1,'usa-security-neutrality','usa',-15,-6),
('diplomacy-usa',1,'usa-cultural-exchange','europe',5,0),
('diplomacy-usa',1,'usa-cultural-exchange','asia',4,0),
('diplomacy-usa',1,'usa-cultural-exchange','usa',11,2),
('diplomacy-usa',1,'usa-open-trade-council','europe',10,3),
('diplomacy-usa',1,'usa-open-trade-council','asia',9,3),
('diplomacy-usa',1,'usa-open-trade-council','usa',10,3);

-- An immutable snapshot is committed in the SAME transaction as the signed
-- parliamentary/government decision, never on a browser-controlled request.
CREATE TABLE public.diplomacy_events (
  decision_event_id uuid NOT NULL REFERENCES public.decision_events(id) ON DELETE CASCADE,
  government_id uuid NOT NULL REFERENCES public.governments(id) ON DELETE CASCADE,
  dossier_id text NOT NULL,
  option_id text NOT NULL,
  bloc text NOT NULL CHECK (bloc IN ('europe','asia','usa')),
  relation_delta smallint NOT NULL CHECK (relation_delta BETWEEN -20 AND 20),
  trade_delta smallint NOT NULL CHECK (trade_delta BETWEEN -10 AND 10),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY(decision_event_id,bloc)
);
CREATE INDEX diplomacy_history_gov ON public.diplomacy_events(government_id,created_at DESC);
ALTER TABLE public.diplomacy_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.diplomacy_events FROM public,anon,authenticated;

CREATE FUNCTION game_internal.snapshot_diplomacy_decision()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 INSERT INTO public.diplomacy_events
  (decision_event_id,government_id,dossier_id,option_id,bloc,relation_delta,trade_delta)
 SELECT NEW.id,NEW.government_id,NEW.dossier_id,NEW.option_id,
   x.bloc,x.relation_delta,x.trade_delta
 FROM public.diplomacy_option_effects x
 WHERE x.dossier_id=NEW.dossier_id AND x.dossier_version=NEW.dossier_version
 AND x.option_id=NEW.option_id;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION game_internal.snapshot_diplomacy_decision() FROM public,anon,authenticated;
CREATE TRIGGER snapshot_diplomacy_after_signature
 AFTER INSERT ON public.decision_events FOR EACH ROW
 EXECUTE FUNCTION game_internal.snapshot_diplomacy_decision();

CREATE FUNCTION public.get_diplomacy_state(p_government_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE v_user uuid:=auth.uid(); v_allowed boolean;
BEGIN
 IF v_user IS NULL OR p_government_id IS NULL THEN
   RAISE EXCEPTION 'DIPLOMACY_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 SELECT EXISTS (
    SELECT 1 FROM public.governments g WHERE g.id=p_government_id
    AND (g.owner_id=v_user OR EXISTS (
      SELECT 1 FROM public.matches m JOIN public.match_players p ON p.match_id=m.id
      WHERE m.government_id=g.id AND p.user_id=v_user
    ))
 ) INTO v_allowed;
 IF NOT v_allowed THEN
    RAISE EXCEPTION 'DIPLOMACY_FORBIDDEN' USING ERRCODE='42501';
 END IF;
 RETURN jsonb_build_object(
  'governmentId',p_government_id,'modelVersion','diplomacy-v1',
  'blocs',(SELECT jsonb_agg(jsonb_build_object(
   'id', b.id,'label',b.label,
   'relation',greatest(0,least(100,50+coalesce(agg.relation_delta,0))),
   'tradeIndex',greatest(0,least(200,100+coalesce(agg.trade_delta,0))),
   'signedEffects',coalesce(agg.signed_effects,0)) ORDER BY b.ordering)
   FROM (VALUES('europe','Europa',1),('asia','Asia',2),('usa','Estados Unidos',3))
      AS b(id,label,ordering)
   LEFT JOIN (
    SELECT e.bloc,SUM(e.relation_delta)::int relation_delta,
      SUM(e.trade_delta)::int trade_delta,COUNT(*)::int signed_effects
    FROM public.diplomacy_events e WHERE e.government_id=p_government_id
    GROUP BY e.bloc
   ) agg ON agg.bloc=b.id),
  'recentEffects',COALESCE((
    SELECT jsonb_agg(jsonb_build_object(
       'eventId',z.decision_event_id,'bloc',z.bloc,
       'dossierId',z.dossier_id,'optionId',z.option_id,
       'title',h.dossier_title_snapshot,'choice',h.option_title_snapshot,
       'relationDelta',z.relation_delta,'tradeDelta',z.trade_delta,
       'signedAt',h.created_at) ORDER BY h.created_at DESC,z.bloc)
    FROM (SELECT * FROM public.diplomacy_events e
      WHERE e.government_id=p_government_id
      ORDER BY e.created_at DESC,e.decision_event_id DESC LIMIT 30) z
    JOIN public.decision_events h ON h.id=z.decision_event_id
  ),'[]'::jsonb));
END $$;
REVOKE ALL ON FUNCTION public.get_diplomacy_state(uuid) FROM public,anon;
GRANT EXECUTE ON FUNCTION public.get_diplomacy_state(uuid) TO authenticated;
