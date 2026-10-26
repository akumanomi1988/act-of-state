-- AOS-054: 56 new authored independent policy alternatives for the 28 original fictional permanent dossiers.
-- Historical choices, IDs, outcomes and server decision authority are unchanged.
insert into public.dossier_options(dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,policy_target,response_intensity,trust_base_delta)
values
('housing-access',1,'bridge-housing-access','Fideicomiso mixto de alquiler','Constituir un fondo público-cooperativo de alquiler protegido y reservar cupos de vivienda rural. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-520,40,24,3),
('housing-access',1,'levy-housing-access','Recuperación de plusvalías urbanas','Gravar las ganancias extraordinarias del suelo para financiar rehabilitación sin subsidiar especulación. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',320,90,36,-2),
('health-capacity',1,'bridge-health-capacity','Red sanitaria comunitaria','Organizar equipos médicos itinerantes y consultas rurales entre hospitales y ayuntamientos. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-590,40,24,3),
('health-capacity',1,'levy-health-capacity','Contribución sanitaria preventiva','Crear una tasa sanitaria finalista para prevención temprana y exigir objetivos clínicos verificables. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',240,90,36,-2),
('education-future',1,'bridge-education-future','Tutorías intergeneracionales','Financiar formación docente y tutorías para alumnos vulnerables mediante redes locales. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-470,40,24,3),
('education-future',1,'levy-education-future','Bonos educativos auditados','Ensayar bonos de formación acreditados con supervisión contra segregación y auditoría de aprendizaje. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',-220,90,36,-2),
('mobility-network',1,'bridge-mobility-network','Consorcios comarcales de movilidad','Crear transporte bajo demanda y billetes integrados entre municipios con evaluación pública de cobertura. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-430,40,24,3),
('mobility-network',1,'levy-mobility-network','Peajes de congestión selectivos','Cobrar por congestión en corredores saturados y reinvertir en reparación de conexiones regionales. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',300,90,36,-2),
('employment-transition',1,'bridge-employment-transition','Cuenta personal de reconversión','Dotar formación transferible a trabajadores desplazados con certificación y seguimiento personalizado. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-520,40,24,3),
('employment-transition',1,'levy-employment-transition','Contribución por automatización','Gravar despliegues automatizados intensivos para financiar formación y proteger la transición laboral. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',310,90,36,-2),
('food-resilience',1,'bridge-food-resilience','Compra alimentaria cooperativa','Crear acuerdos de abastecimiento local y almacenes compartidos para escuelas y hospitales. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-460,40,24,3),
('food-resilience',1,'levy-food-resilience','Mercado de excedentes alimentarios','Exigir trazabilidad de excedentes de grandes operadores y sancionar desperdicio evitable. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',180,90,36,-2),
('digital-sovereignty',1,'bridge-digital-sovereignty','Plataforma pública interoperable','Desarrollar componentes abiertos y portables para trámites críticos reduciendo dependencia comercial. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-460,40,24,3),
('digital-sovereignty',1,'levy-digital-sovereignty','Canon por dependencia digital','Cobrar un canon a servicios críticos sin plan de salida verificable y financiar auditorías independientes. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',210,90,36,-2),
('climate-adaptation',1,'bridge-climate-adaptation','Rehabilitación climática vecinal','Cofinanciar sombra urbana aislamiento y refugios climáticos elegidos por municipios. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-540,40,24,3),
('climate-adaptation',1,'levy-climate-adaptation','Bonos de responsabilidad ambiental','Exigir garantías para restauración ambiental a industrias con emisiones extraordinarias. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',250,90,36,-2),
('energy-resilience',1,'bridge-energy-resilience','Comunidades energéticas territoriales','Crear redes de almacenamiento y autoconsumo con participación municipal y supervisión de costes. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-480,40,24,3),
('energy-resilience',1,'levy-energy-resilience','Tarifa de demanda punta','Implantar un gravamen progresivo al consumo máximo industrial para financiar redes resilientes. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',270,90,36,-2),
('water-security',1,'bridge-water-security','Consejos de cuenca ciudadana','Financiar observatorios y pactos de ahorro entre agricultores hogares e industrias locales. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-360,40,24,3),
('water-security',1,'levy-water-security','Recargo al consumo hídrico intensivo','Aplicar una tarifa de extracción intensiva conservando mínimos domésticos protegidos. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',290,90,36,-2),
('pension-covenant',1,'bridge-pension-covenant','Cotización por cuidados familiares','Reconocer cotizaciones parciales por cuidados acreditados mediante financiación generacional plurianual. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-290,40,24,3),
('pension-covenant',1,'levy-pension-covenant','Revalorización según capacidad','Limitar aumentos de pensiones elevadas por renta mientras se preserva la protección mínima. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',240,90,36,-2),
('mental-health-network',1,'bridge-mental-health-network','Acompañamiento emocional escolar','Dotar orientadores a colegios con protocolos de derivación clínica y evaluación regional. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-260,40,24,3),
('mental-health-network',1,'levy-mental-health-network','Prevención laboral obligatoria','Exigir planes de salud mental en grandes empleadores con multas por incumplimientos reiterados. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',100,90,36,-2),
('care-economy',1,'bridge-care-economy','Profesionalización de cuidadores','Crear acreditación gratuita y descansos de sustitución para cuidadores informales acreditados. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-240,40,24,3),
('care-economy',1,'levy-care-economy','Seguro mutual de dependencia','Establecer una aportación gradual mutualizada con supervisión de aseguradoras y cobertura severa. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',160,90,36,-2),
('public-safety-pact',1,'bridge-public-safety-pact','Prevención juvenil de conflictos','Abrir programas de mediación escolar y apoyo social en barrios vulnerables. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-250,40,24,3),
('public-safety-pact',1,'levy-public-safety-pact','Control independiente de seguridad','Establecer un organismo externo con facultad inspectora y publicación protegida de quejas. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',120,90,36,-2),
('cultural-belonging',1,'bridge-cultural-belonging','Cooperativas culturales locales','Conceder ayudas abiertas a iniciativas culturales rurales con acceso público verificable. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-170,40,24,3),
('cultural-belonging',1,'levy-cultural-belonging','Recargo de conservación patrimonial','Cobrar una tasa por visitas comerciales a enclaves saturados y destinarla al patrimonio. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',175,90,36,-2),
('tax-compliance',1,'bridge-tax-compliance','Defensor del contribuyente','Crear asistencia tributaria gratuita para comercios con revisión transparente previa a sanciones. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-160,40,24,3),
('tax-compliance',1,'levy-tax-compliance','Auditoría de titularidades reales','Cruzar registros de sociedades bajo supervisión judicial contra evasión compleja y ocultación. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',280,90,36,-2),
('industrial-reconversion',1,'bridge-industrial-reconversion','Centros regionales de reciclaje','Financiar formación laboral junto a sindicatos y empresas en territorios industriales vulnerables. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-340,40,24,3),
('industrial-reconversion',1,'levy-industrial-reconversion','Recuperación de ayudas fallidas','Reclamar subvenciones a empresas que incumplan resultados verificables y reinvertir localmente. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',320,90,36,-2),
('local-enterprise',1,'bridge-local-enterprise','Avales cooperativos de proximidad','Crear garantías rotatorias entre municipios y negocios para evitar cierres por falta de liquidez. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-260,40,24,3),
('local-enterprise',1,'levy-local-enterprise','Canon sobre locales improductivos','Aplicar una tasa a grandes propietarios con locales vacíos y financiar nuevos emprendimientos. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',170,90,36,-2),
('debt-credibility',1,'bridge-debt-credibility','Consejo fiscal independiente','Publicar análisis presupuestarios plurianuales y pactar ajuste fiscal sin recortes automáticos. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-85,40,24,3),
('debt-credibility',1,'levy-debt-credibility','Recargo temporal extraordinario','Capturar beneficios excepcionales para reducir deuda aceptando riesgos de menor inversión. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',290,90,36,-2),
('circular-industry',1,'bridge-circular-industry','Red de reparación comunitaria','Subvencionar talleres certificados de reutilización y compras públicas de productos reparables. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-225,40,24,3),
('circular-industry',1,'levy-circular-industry','Garantías a productores contaminantes','Exigir garantías de recuperación a fabricantes de alto residuo con devolución por cumplimiento. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',180,90,36,-2),
('judicial-delay',1,'bridge-judicial-delay','Asistencia jurídica de proximidad','Abrir servicios de mediación temprana y clínicas jurídicas públicas en comarcas aisladas. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-180,40,24,3),
('judicial-delay',1,'levy-judicial-delay','Tramitación judicial priorizada','Introducir objetivos públicos de resolución con auditoría independiente y reparto de expedientes. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',95,90,36,-2),
('regional-autonomy',1,'bridge-regional-autonomy','Consejo de cooperación territorial','Negociar competencias y financiación mediante actas abiertas y arbitraje técnico independiente. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-180,40,24,3),
('regional-autonomy',1,'levy-regional-autonomy','Autonomía fiscal experimental','Probar competencias tributarias regionales con reglas de solidaridad y corrección territorial. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',160,90,36,-2),
('integrity-procurement',1,'bridge-integrity-procurement','Observatorios ciudadanos de contratos','Financiar revisión independiente de licitaciones y protección de denunciantes acreditados. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-145,40,24,3),
('integrity-procurement',1,'levy-integrity-procurement','Sanciones contractuales reforzadas','Implantar multas proporcionales por adjudicaciones irregulares con recursos y transparencia. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',185,90,36,-2),
('participatory-councils',1,'bridge-participatory-councils','Jurados ciudadanos por sorteo','Reunir paneles representativos remunerados con asesoría técnica y respuesta gubernamental. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-110,40,24,3),
('participatory-councils',1,'levy-participatory-councils','Consultas locales vinculantes','Permitir consultas municipales supervisadas judicialmente sobre inversiones presupuestadas. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',-75,90,36,-2),
('drought-reserves',1,'bridge-drought-reserves','Red de agua regenerada','Cofinanciar reutilización de aguas residuales para riego e industria protegiendo caudales ecológicos. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-320,40,24,3),
('drought-reserves',1,'levy-drought-reserves','Canon a la extracción profunda','Cobrar cuotas progresivas sobre grandes extracciones y destinar fondos a recuperar acuíferos. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',205,90,36,-2),
('epidemic-preparedness',1,'bridge-epidemic-preparedness','Formación comunitaria sanitaria','Financiar simulacros y protocolos compartidos de emergencia con municipios y hospitales. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-275,40,24,3),
('epidemic-preparedness',1,'levy-epidemic-preparedness','Reserva sanitaria obligatoria','Exigir aportaciones de industrias esenciales a un inventario sanitario auditado y verificable. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',140,90,36,-2),
('critical-cyberdefense',1,'bridge-critical-cyberdefense','Auditoría abierta de sistemas críticos','Financiar pruebas de seguridad y divulgación coordinada para servicios públicos prioritarios. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-230,40,24,3),
('critical-cyberdefense',1,'levy-critical-cyberdefense','Garantías contra incidentes graves','Exigir garantías a proveedores críticos por incidentes prevenibles con controles independientes. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',200,90,36,-2),
('international-supply-shock',1,'bridge-international-supply-shock','Pacto comercial entre regiones','Negociar compras conjuntas y rutas alternativas con países socios para reducir dependencias. La medida requiere evaluación pública periódica de costes, acceso y resultados.',-275,40,24,3),
('international-supply-shock',1,'levy-international-supply-shock','Arancel estratégico de protección','Aplicar gravámenes temporales a importaciones críticas de alto riesgo para diversificar suministros. La decisión genera un conflicto distributivo explícito que deberá revisarse ante el Parlamento.',225,90,36,-2);

-- Preserve publisher authorization, ten reviewed dossiers and all source validation; extend published alternatives upper limit to five.
create or replace function public.publish_editorial_week(
  p_week_start date, p_expected_revision integer
) returns public.editorial_weeks
language plpgsql volatile security definer set search_path=''
as $$
declare
  v_user uuid := auth.uid();
  v_week public.editorial_weeks%rowtype;
  v_d jsonb; v_o jsonb; v_options jsonb;
  v_id text; v_oid text;
  v_source_at timestamptz;
  v_delta integer; v_target integer; v_intensity integer; v_trust integer;
begin
  if v_user is null or not exists (
    select 1 from public.editorial_members m
    where m.user_id=v_user and m.role='publisher'
  ) then raise exception 'EDITORIAL_PUBLISH_FORBIDDEN' using errcode='42501'; end if;
  if p_week_start is null or extract(isodow from p_week_start)<>1 or
    p_week_start < (now() at time zone 'UTC')::date -
      (extract(isodow from (now() at time zone 'UTC')::date)::integer-1) then
    raise exception 'EDITORIAL_INVALID_WEEK' using errcode='P0001';
  end if;
  select * into v_week from public.editorial_weeks
  where week_start=p_week_start for update;
  if not found then raise exception 'EDITORIAL_WEEK_NOT_FOUND' using errcode='P0001'; end if;
  if v_week.status='published' then return v_week; end if;
  if p_expected_revision is null or v_week.revision<>p_expected_revision then
    raise exception 'EDITORIAL_REVISION_CONFLICT' using errcode='P0001';
  end if;
  if jsonb_array_length(v_week.draft)<>10 or
    (select count(distinct e.value->>'id')
     from jsonb_array_elements(v_week.draft) e)<>10 then
    raise exception 'EDITORIAL_REQUIRES_TEN_DISTINCT_DOSSIERS' using errcode='P0001';
  end if;
  if (select count(*) from public.editorial_slot_reviews r
      where r.week_start=p_week_start and r.revision=v_week.revision
       and exists(select 1 from jsonb_array_elements(v_week.draft) d
                  where d.value->>'id'=r.dossier_id))<>10 then
    raise exception 'EDITORIAL_REQUIRES_TEN_REVIEWS' using errcode='P0001'; end if;
  if exists(select 1 from public.weekly_releases where week_start=p_week_start) then
    raise exception 'EDITORIAL_RELEASE_ALREADY_EXISTS' using errcode='P0001';
  end if;

  -- A weekly release must not recycle a single article across distinct
  -- dossiers. This is enforced server-side, not only by the browser.
  if (select count(distinct btrim(d.value->>'source_url'))
      from jsonb_array_elements(v_week.draft) d)<>10 then
    raise exception 'EDITORIAL_DUPLICATE_NEWS_SOURCE' using errcode='P0001';
  end if;

  insert into public.weekly_releases(week_start) values(p_week_start);
  for v_d in select value from jsonb_array_elements(v_week.draft) loop
    v_id := v_d->>'id';
    if v_id is null or length(v_id)>100 or
      v_id !~ '^[a-z0-9-]+$' or
      left(v_id,length('weekly-'||p_week_start::text||'-')) <>
        'weekly-'||p_week_start::text||'-' then
      raise exception 'EDITORIAL_INVALID_DOSSIER_ID' using errcode='P0001';
    end if;
    if length(coalesce(v_d->>'title','')) not between 8 and 160
      or length(coalesce(v_d->>'context','')) not between 40 and 3000
      or length(coalesce(v_d->>'category','')) not between 3 and 80
      or length(coalesce(v_d->>'source_title','')) not between 5 and 300
      or length(coalesce(v_d->>'source_url',''))>2048
      or coalesce(v_d->>'source_url','') !~ '^https://[^[:space:]]+$' then
      raise exception 'EDITORIAL_INVALID_DOSSIER_CONTENT' using errcode='P0001';
    end if;
    begin
      v_source_at := (v_d->>'source_published_at')::timestamptz;
    exception when others then
      raise exception 'EDITORIAL_INVALID_SOURCE_DATE' using errcode='P0001';
    end;
    if v_source_at is null or v_source_at>now() then
      raise exception 'EDITORIAL_INVALID_SOURCE_DATE' using errcode='P0001';
    end if;
    v_options := v_d->'options';
    if coalesce(jsonb_typeof(v_options),'')<>'array' then
      raise exception 'EDITORIAL_INVALID_OPTIONS' using errcode='P0001';
    end if;
    if jsonb_array_length(v_options) not between 2 and 5 or
      (select count(distinct e.value->>'id')
       from jsonb_array_elements(v_options) e)<>jsonb_array_length(v_options) then
      raise exception 'EDITORIAL_INVALID_OPTIONS' using errcode='P0001';
    end if;

    insert into public.dossiers(
      id,version,title,context,category,release_kind,available_from,
      source_url,source_title,source_published_at
    ) values (
      v_id,1,v_d->>'title',v_d->>'context',v_d->>'category','weekly',p_week_start,
      v_d->>'source_url',v_d->>'source_title',v_source_at
    );
    for v_o in select value from jsonb_array_elements(v_options) loop
      v_oid := v_o->>'id';
      if v_oid is null or length(v_oid)>80 or
        v_oid !~ '^[a-z0-9-]+$' or
        length(coalesce(v_o->>'title','')) not between 4 and 160 or
        length(coalesce(v_o->>'description','')) not between 12 and 1500 then
        raise exception 'EDITORIAL_INVALID_OPTION_CONTENT' using errcode='P0001';
      end if;
      if coalesce(jsonb_typeof(v_o->'treasury_delta_m_eur'),'')<>'number'
        or coalesce(jsonb_typeof(v_o->'policy_target'),'')<>'number'
        or coalesce(jsonb_typeof(v_o->'response_intensity'),'')<>'number'
        or coalesce(jsonb_typeof(v_o->'trust_base_delta'),'')<>'number' then
        raise exception 'EDITORIAL_INVALID_OPTION_PARAMETERS' using errcode='P0001';
      end if;
      begin
        v_delta := (v_o->>'treasury_delta_m_eur')::integer;
        v_target := (v_o->>'policy_target')::integer;
        v_intensity := (v_o->>'response_intensity')::integer;
        v_trust := (v_o->>'trust_base_delta')::integer;
      exception when others then
        raise exception 'EDITORIAL_INVALID_OPTION_PARAMETERS' using errcode='P0001';
      end;
      if v_delta not between -12000 and 12000 or
        v_target not between 0 and 100 or
        v_intensity not between 0 and 100 or
        v_trust not between -20 and 20 then
        raise exception 'EDITORIAL_INVALID_OPTION_PARAMETERS' using errcode='P0001';
      end if;
      insert into public.dossier_options(
        dossier_id,dossier_version,id,title,description,
        treasury_delta_m_eur,policy_target,response_intensity,trust_base_delta
      ) values (
        v_id,1,v_oid,v_o->>'title',v_o->>'description',
        v_delta,v_target,v_intensity,v_trust
      );
    end loop;
  end loop;
  perform public.approve_weekly_release(p_week_start);
  update public.editorial_weeks
  set status='published',revision=revision+1,published_by=v_user,
      published_at=now(),updated_by=v_user,updated_at=now()
  where week_start=p_week_start returning * into strict v_week;
  return v_week;
end $$;
