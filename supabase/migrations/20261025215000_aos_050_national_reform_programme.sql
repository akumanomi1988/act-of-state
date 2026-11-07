-- AOS-050: 18 new ORIGINAL, FICTIONAL, PERMANENT NATIONAL REFORM DOSSIERS.
-- No actual events, sources or demographic claims. All options execute through
-- the already-authorized immutable decision and parliamentary mandate RPCs.
-- The first ten founding policies retain their IDs, options and fiscal effects.
-- No future date embargo or editorial publication privilege is bypassed.
alter table public.dossiers add column programme_chapter text;
alter table public.dossiers add column programme_order smallint;
alter table public.dossiers add constraint dossier_programme_chapter_check
  check(programme_chapter is null or programme_chapter in
    ('founding','society','economy','institutions','resilience'));
alter table public.dossiers add constraint dossier_programme_order_check
  check(programme_order is null or programme_order between 1 and 99);
alter table public.dossiers add constraint dossier_editorial_chapter_isolation
  check(release_kind <> 'weekly' or programme_chapter is null);

-- Stable chapter ordering of the previous permanent founding programme.
update public.dossiers as d set programme_chapter='founding',
 programme_order=seed.display_order
from (values
('energy-resilience',1),
('water-security',2),
('housing-access',3),
('health-capacity',4),
('education-future',5),
('mobility-network',6),
('employment-transition',7),
('food-resilience',8),
('digital-sovereignty',9),
('climate-adaptation',10)
) as seed(id,display_order)
where d.id=seed.id and d.version=1 and d.release_kind='intro';

insert into public.dossiers(id,version,title,context,category,release_kind,programme_chapter,programme_order)
values
('pension-covenant',1,'Pacto de pensiones y generaciones','Escenario ficticio: El envejecimiento ficticio de Arcadia presiona la sostenibilidad de las pensiones mientras los jóvenes reclaman oportunidades de empleo y los mayores exigen certidumbre. Un pacto generacional debe repartir costes sin desatender a quienes ya dependen del sistema.','Protección social','intro','society',1),
('mental-health-network',1,'Salud mental y proximidad','Escenario ficticio: En las ciudades y comarcas ficticias aumentan las consultas por ansiedad y soledad, pero los equipos sanitarios ya soportan mucha carga. El Ejecutivo debe elegir entre una red pública, colaboración especializada o contención administrativa.','Sanidad','intro','society',2),
('care-economy',1,'Cuidados y envejecimiento digno','Escenario ficticio: Miles de familias ficticias combinan trabajo con cuidados a mayores dependientes y personas con discapacidad. Las zonas rurales disponen de menos servicios y una intervención mal diseñada puede aumentar desigualdades territoriales.','Protección social','intro','society',3),
('public-safety-pact',1,'Seguridad y confianza cívica','Escenario ficticio: Una serie de incidentes ficticios reabre el debate sobre seguridad en estaciones, barrios y zonas de ocio. El temor ciudadano convive con la necesidad de respetar derechos y controlar el uso de datos públicos.','Seguridad','intro','society',4),
('cultural-belonging',1,'Cultura, bibliotecas y cohesión','Escenario ficticio: Los pequeños municipios ficticios pierden espacios culturales mientras los centros metropolitanos concentran programación y financiación. El Gobierno debe ponderar cohesión territorial, economía creativa y necesidades básicas.','Cultura','intro','society',5),
('tax-compliance',1,'Fraude fiscal y contrato social','Escenario ficticio: Las cuentas ficticias de Arcadia muestran diferencias persistentes entre el esfuerzo de hogares y empresas. La confianza en la recaudación depende tanto de su eficacia como de la previsibilidad para quienes cumplen.','Economía','intro','economy',1),
('industrial-reconversion',1,'Reconversión de la industria regional','Escenario ficticio: Varias fábricas ficticias pierden pedidos por cambios tecnológicos y costes energéticos; decenas de comarcas dependen de ellas. El gabinete debe repartir los recursos entre empleo, modernización y estabilidad del tesoro.','Industria','intro','economy',2),
('local-enterprise',1,'Pequeñas empresas y territorio','Escenario ficticio: Los pequeños negocios ficticios informan de baja productividad, escaso crédito e incertidumbre regulatoria. La actividad comarcal depende de decisiones que no generen privilegios injustificados.','Empleo','intro','economy',3),
('debt-credibility',1,'Credibilidad de la deuda pública','Escenario ficticio: Tras varias decisiones de gasto ficticias, Arcadia debe negociar sus próximas necesidades de financiación. Un ajuste abrupto puede dañar servicios; una expansión indiscriminada limita los presupuestos futuros.','Finanzas públicas','intro','economy',4),
('circular-industry',1,'Recursos y economía circular','Escenario ficticio: El consumo ficticio de materiales importados hace vulnerables a las fábricas nacionales. Municipios y empresas quieren reciclar, pero difieren sobre quién debe asumir los costes de adaptación.','Industria','intro','economy',5),
('judicial-delay',1,'Justicia ante los retrasos','Escenario ficticio: En la Arcadia ficticia aumentan los procedimientos sin resolver y ciudadanos y empresas pierden confianza en los tiempos judiciales. La independencia de los tribunales debe mantenerse al decidir cómo asignar recursos.','Justicia','intro','institutions',1),
('regional-autonomy',1,'Competencias de las regiones','Escenario ficticio: Las regiones ficticias reclaman adaptar servicios a su población, mientras otras temen disparidades de financiación. El Gobierno debe preservar derechos comunes sin ignorar las diferencias territoriales.','Instituciones','intro','institutions',2),
('integrity-procurement',1,'Contratos públicos y transparencia','Escenario ficticio: Un informe ficticio descubre retrasos y adjudicaciones poco comparables en infraestructuras. La ciudadanía pide transparencia, pero los municipios pequeños carecen de personal especializado.','Instituciones','intro','institutions',3),
('participatory-councils',1,'Participación ciudadana sostenida','Escenario ficticio: En la nación ficticia la participación pública disminuye entre elecciones y los partidos discuten quién debe fijar prioridades. Se necesitan canales de debate útiles sin sustituir instituciones representativas.','Democracia','intro','institutions',4),
('drought-reserves',1,'Sequía y reservas hídricas','Escenario ficticio: Tras varios meses ficticios de poca lluvia, la disponibilidad de agua para cultivos y hogares desciende. Las cuencas de Arcadia difieren y un reparto injusto amenaza la cohesión entre distritos.','Medio ambiente','intro','resilience',1),
('epidemic-preparedness',1,'Preparación sanitaria ante epidemias','Escenario ficticio: Un ejercicio ficticio de salud pública descubre demoras para compartir información clínica y suministros estratégicos. Las decisiones deben proteger libertades y capacidad de respuesta sin atribuir riesgos a grupos sociales.','Sanidad','intro','resilience',2),
('critical-cyberdefense',1,'Infraestructura digital bajo presión','Escenario ficticio: Un fallo ficticio afecta simultáneamente a redes de abastecimiento y servicios administrativos. Proteger la continuidad operativa exige inversiones y garantías de privacidad sin convertir el incidente en vigilancia indiscriminada.','Tecnología','intro','resilience',3),
('international-supply-shock',1,'Dependencia de suministros exteriores','Escenario ficticio: Una interrupción comercial ficticia eleva precios industriales y retrasa entregas esenciales. El Gobierno debe elegir cuánto diversificar, cuánta producción asegurar y qué parte del riesgo asumir.','Relaciones exteriores','intro','resilience',4);

insert into public.dossier_options(dossier_id,dossier_version,id,title,description,
 treasury_delta_m_eur,policy_target,response_intensity,trust_base_delta)
values
('pension-covenant',1,'basic-pension-floor','Garantizar una pensión mínima','Elevar las prestaciones mínimas y financiar su revisión anual, asumiendo un mayor compromiso presupuestario.',-460,25,29,3),
('pension-covenant',1,'funded-pension-transition','Impulsar fondos complementarios','Crear ahorro complementario voluntario y mejorar la supervisión de los fondos sin sustituir de inmediato el sistema vigente.',-180,75,22,1),
('pension-covenant',1,'retirement-timetable','Ajustar gradualmente los plazos','Aplazar parte de la reforma de prestaciones y revisar edades de acceso para liberar recursos a corto plazo.',130,50,11,-3),
('mental-health-network',1,'community-mental-health','Abrir centros comunitarios','Financiar equipos móviles, consultas de barrio y prevención en centros escolares con atención gratuita.',-420,25,28,3),
('mental-health-network',1,'specialist-partnerships','Contratar capacidad especializada','Concertar servicios especializados con indicadores públicos de calidad y derivación desde la atención primaria.',-180,75,23,1),
('mental-health-network',1,'existing-care-priorities','Reordenar las consultas existentes','Reasignar turnos y coordinar derivaciones sin abrir nuevos centros ni aumentar las partidas de atención.',100,50,12,-2),
('care-economy',1,'public-home-care','Financiar cuidados a domicilio','Crear una red pública comarcal de apoyo domiciliario y descanso para familiares cuidadores.',-390,25,30,4),
('care-economy',1,'cooperative-care','Apoyar cooperativas de cuidados','Abrir programas de acreditación y cofinanciar cooperativas locales con evaluación de resultados.',-160,75,23,1),
('care-economy',1,'care-service-audit','Auditar prestaciones actuales','Revisar duplicidades y concentrar ayudas existentes sin comprometer nueva inversión estructural.',115,50,13,-2),
('public-safety-pact',1,'neighborhood-mediation','Prevención y mediación de barrio','Ampliar mediadores, equipos de proximidad y protección de víctimas con supervisión civil.',-380,25,29,3),
('public-safety-pact',1,'smart-policing','Modernizar la respuesta policial','Renovar comunicación y coordinación operativa con controles explícitos de privacidad y auditoría.',-220,75,25,0),
('public-safety-pact',1,'targeted-patrols','Redistribuir patrullas','Reordenar los recursos existentes hacia las zonas con mayor demanda sin crear nuevos programas.',90,50,13,-2),
('cultural-belonging',1,'community-culture','Financiar cultura de proximidad','Abrir bibliotecas multifunción y circuitos culturales de bajo coste en municipios con escasa oferta.',-270,25,25,3),
('cultural-belonging',1,'creative-industry','Incentivar industrias creativas','Apoyar proyectos culturales exportables, producción local y formación tecnológica para creadores.',-145,75,21,1),
('cultural-belonging',1,'heritage-maintenance','Priorizar conservación','Concentrar los recursos en mantenimiento del patrimonio existente y suspender nuevas convocatorias.',80,50,11,-2),
('tax-compliance',1,'tax-inspection-access','Reforzar la inspección justa','Ampliar equipos de asistencia e inspección para pequeñas y grandes obligaciones, priorizando garantías y trazabilidad.',-300,25,27,4),
('tax-compliance',1,'risk-based-audit','Digitalizar controles tributarios','Modernizar cruces de datos con revisión humana y servicios digitales de cumplimiento para empresas.',-160,75,26,1),
('tax-compliance',1,'temporary-regularization','Regularización extraordinaria','Aprobar un esquema temporal de regularización para aumentar ingresos inmediatos con un riesgo reputacional.',230,50,15,-4),
('industrial-reconversion',1,'worker-transition-fund','Fondo de transición laboral','Financiar formación, garantías de empleo y apoyo temporal a trabajadores de sectores en reconversión.',-540,25,32,4),
('industrial-reconversion',1,'productive-investment','Acelerar inversión productiva','Cofinanciar maquinaria, eficiencia energética e innovación en consorcios empresariales regionales.',-310,75,30,1),
('industrial-reconversion',1,'orderly-adjustment','Ajuste industrial limitado','Priorizar la solvencia fiscal y la asistencia administrativa sin rescates sectoriales generalizados.',160,50,11,-4),
('local-enterprise',1,'microcredit-guarantees','Garantías para negocios locales','Abrir microcréditos públicos condicionados a empleo estable y rendición de cuentas.',-440,25,28,3),
('local-enterprise',1,'digital-business-hubs','Centros de modernización empresarial','Financiar asesoramiento digital y redes compartidas de exportación para pymes.',-230,75,26,1),
('local-enterprise',1,'licensing-simplification','Simplificar licencias','Reducir cargas administrativas y reservar el gasto para otras prioridades sin subvenciones nuevas.',170,50,14,-2),
('debt-credibility',1,'social-debt-plan','Pacto fiscal con garantías sociales','Crear un programa plurianual de reducción gradual del déficit con protección de servicios básicos.',-260,25,26,3),
('debt-credibility',1,'growth-debt-plan','Consolidación basada en crecimiento','Invertir en gestión de deuda y apoyo productivo con metas de transparencia trimestral.',-140,75,22,1),
('debt-credibility',1,'immediate-spending-freeze','Congelación presupuestaria','Posponer programas de gasto no comprometidos para recuperar reservas con coste de aceptación ciudadana.',290,50,12,-4),
('circular-industry',1,'municipal-reuse','Crear redes municipales de reutilización','Invertir en separación, reparación y centros comarcales de recuperación de materiales.',-380,25,27,3),
('circular-industry',1,'recycling-incentives','Incentivar cadenas circulares','Cofinanciar tecnología y acuerdos de recogida industrial con objetivos medibles.',-210,75,26,1),
('circular-industry',1,'voluntary-standards','Normas voluntarias sin subvención','Promover estándares de información y compras públicas prudentes sin inversiones estructurales.',110,50,12,-2),
('judicial-delay',1,'regional-justice-support','Reforzar juzgados comarcales','Financiar personal de apoyo, digitalización accesible y salas locales de mediación judicial.',-330,25,27,4),
('judicial-delay',1,'procedural-modernization','Modernizar los procedimientos','Actualizar gestión procesal y formación de personal con revisión independiente de resultados.',-150,75,25,1),
('judicial-delay',1,'judicial-workload-review','Revisar cargas sin inversión nueva','Redistribuir expedientes y priorizar procedimientos urgentes antes de aumentar plantilla.',100,50,13,-3),
('regional-autonomy',1,'territorial-equalization','Fondo territorial de igualdad','Financiar servicios esenciales en distritos rurales y mecanismos auditables de reparto.',-390,25,29,3),
('regional-autonomy',1,'regional-performance','Acuerdos de gestión territorial','Delegar proyectos con objetivos, información pública y evaluaciones compartidas por los distritos.',-220,75,26,1),
('regional-autonomy',1,'central-competences','Mantener el marco central','Aplazar nuevas transferencias para proteger la estabilidad presupuestaria y jurídica.',120,50,13,-3),
('integrity-procurement',1,'open-contracting','Contratación pública abierta','Publicar expedientes normalizados y financiar supervisión independiente de contratos y conflictos de interés.',-260,25,30,4),
('integrity-procurement',1,'shared-procurement','Plataforma de compra compartida','Centralizar herramientas de licitación y asistencia jurídica con trazabilidad y recursos de reclamación.',-130,75,26,1),
('integrity-procurement',1,'basic-procurement-audit','Auditoría de expedientes existentes','Revisar una muestra de contratos sin asumir nuevas competencias o infraestructuras de control.',90,50,12,-3),
('participatory-councils',1,'civic-assemblies','Asambleas ciudadanas consultivas','Abrir procesos deliberativos accesibles por distrito con informes públicos y seguimiento de propuestas.',-180,25,26,4),
('participatory-councils',1,'digital-consultation','Consultas con garantía digital','Crear una plataforma accesible de participación con auditoría externa y asistencia presencial.',-95,75,23,1),
('participatory-councils',1,'existing-public-hearings','Conservar audiencias tradicionales','Reforzar la publicación de actas existentes sin crear nuevas estructuras deliberativas.',80,50,11,-2),
('drought-reserves',1,'public-water-reserves','Reserva pública de agua','Invertir en reparación de redes y reservas para consumo esencial con apoyo a municipios rurales.',-490,25,30,4),
('drought-reserves',1,'smart-irrigation','Regadío eficiente y medición','Cofinanciar sensores, almacenamiento y mejoras de eficiencia condicionadas a ahorro verificable.',-250,75,28,1),
('drought-reserves',1,'voluntary-water-limits','Racionamiento voluntario','Coordinar campañas de ahorro y vigilancia del consumo con inversión pública mínima.',170,50,13,-3),
('epidemic-preparedness',1,'local-response-stock','Red local de respuesta sanitaria','Crear reservas sanitarias comarcales, formación y atención comunitaria de emergencia.',-480,25,29,4),
('epidemic-preparedness',1,'laboratory-coordination','Red de laboratorios interoperables','Financiar alertas clínicas, coordinación de datos anónimos y protocolos interhospitalarios.',-240,75,27,1),
('epidemic-preparedness',1,'existing-emergency-protocols','Revisar protocolos vigentes','Auditar reservas e instrucciones ya existentes antes de comprometer nuevas compras.',100,50,12,-2),
('critical-cyberdefense',1,'public-resilience-teams','Equipos públicos de resiliencia','Desplegar respuesta técnica para hospitales y servicios básicos, con control democrático y privacidad.',-390,25,31,4),
('critical-cyberdefense',1,'critical-private-security','Acuerdos de seguridad sectorial','Crear certificaciones y respuesta coordinada con operadores, auditoría independiente y costes compartidos.',-190,75,26,1),
('critical-cyberdefense',1,'limited-system-review','Revisión mínima de continuidad','Programar inspecciones y limitar la renovación técnica para conservar reservas fiscales.',125,50,11,-3),
('international-supply-shock',1,'strategic-stockpiles','Reservas de suministro esenciales','Financiar reservas rotativas de componentes críticos con criterios públicos y control del gasto.',-430,25,28,3),
('international-supply-shock',1,'trade-diversification','Diversificar acuerdos comerciales','Apoyar proveedores alternativos y facilitar cooperación logística con socios regionales.',-250,75,27,1),
('international-supply-shock',1,'market-adjustment','Dejar actuar al mercado','Evitar nuevos compromisos fiscales y revisar solo trámites aduaneros prioritarios.',200,50,12,-3);

-- Every new reform option remains within the original engine's safe bounds.
-- Do not introduce a new decision engine, privileged write path, or daily cost.
