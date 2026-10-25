-- AOS-043: Original fictional single-player nation-building agenda.
-- This is authored GAME CONTENT, NOT current events, demographics, or real forecasts.
-- All outcomes use the existing authoritative, versioned PostgreSQL engine.
-- Stable ID/version design keeps historical decisions immutable and retry-safe.
insert into public.dossiers (id, version, title, context, category, release_kind)
values
 ('housing-access',1,'Acceso a una vivienda digna','Escenario ficticio: jóvenes y familias de Arcadia destinan una parte creciente de sus ingresos al alquiler, mientras los municipios piden soluciones duraderas. El Gobierno debe decidir entre inversión pública, incentivos de oferta y austeridad.','Vivienda','intro'),
 ('health-capacity',1,'El futuro de la atención sanitaria','Escenario ficticio: los hospitales públicos de Arcadia acumulan esperas, el personal sanitario solicita refuerzos y las pequeñas empresas temen nuevas cargas tributarias. El Gobierno dispone de recursos limitados.','Sanidad','intro'),
 ('education-future',1,'Educación y oportunidades','Escenario ficticio: la brecha educativa entre las zonas rurales y urbanas de Arcadia se amplía. Las familias demandan recursos; la industria quiere formación tecnológica. No existe una única medida que satisfaga a todos.','Educación','intro'),
 ('mobility-network',1,'Un país mejor conectado','Escenario ficticio: las conexiones entre la capital, las comarcas industriales y el interior son desiguales. El Gobierno debe priorizar el acceso universal, la eficiencia logística o el ahorro inmediato.','Infraestructuras','intro'),
 ('employment-transition',1,'Empleo ante la automatización','Escenario ficticio: la industria de Arcadia incorpora tecnología que aumenta la productividad, pero amenaza empleos rutinarios. Trabajadores y empresas piden respuestas divergentes.','Trabajo','intro'),
 ('food-resilience',1,'Abastecimiento y precios alimentarios','Escenario ficticio: una mala campaña de cosechas y el encarecimiento del transporte tensionan los precios de alimentos en Arcadia. Productores y consumidores esperan medidas distintas.','Agricultura','intro'),
 ('digital-sovereignty',1,'Instituciones y seguridad digital','Escenario ficticio: Arcadia ha sufrido interrupciones de varios servicios administrativos. La población demanda privacidad y disponibilidad; las empresas buscan mejores servicios digitales.','Tecnología','intro'),
 ('climate-adaptation',1,'Adaptación a un clima cambiante','Escenario ficticio: olas de calor e inundaciones ponen a prueba infraestructuras, agricultura y hogares de Arcadia. El Gobierno necesita un plan compatible con la seguridad de las cuentas.','Medio ambiente','intro');

insert into public.dossier_options
 (dossier_id,dossier_version,id,title,description,treasury_delta_m_eur,
  policy_target,response_intensity,trust_base_delta)
values
 ('housing-access',1,'public-housing','Crear vivienda pública','Financiar alquiler público asequible y reservar suelo municipal para construir a medio plazo.',-900,25,30,3),
 ('housing-access',1,'permit-reform','Agilizar nueva construcción','Reducir los plazos de licencias y ofrecer financiación limitada para nuevas promociones.',-450,75,25,0),
 ('housing-access',1,'market-observation','Preservar el presupuesto','Mantener la legislación vigente y priorizar la estabilidad fiscal frente a nuevas ayudas.',200,50,12,-3),
 ('health-capacity',1,'clinical-staff','Reforzar la atención primaria','Contratar profesionales y ampliar consultas de proximidad para reducir las listas de espera.',-1050,25,32,4),
 ('health-capacity',1,'hospital-tech','Invertir en tecnología clínica','Digitalizar las derivaciones y modernizar equipamiento en centros regionales.',-700,65,25,2),
 ('health-capacity',1,'management-review','Reorganizar sin ampliar gasto','Priorizar auditorías de gestión y redistribución de turnos antes de invertir.',150,50,14,-2),
 ('education-future',1,'rural-schools','Reforzar la red escolar','Destinar fondos a profesores, bibliotecas y transporte escolar en municipios pequeños.',-800,25,28,4),
 ('education-future',1,'technical-training','Impulsar la formación técnica','Crear programas duales y convenios de formación con centros productivos.',-600,75,27,1),
 ('education-future',1,'curriculum-review','Actualizar el currículo','Cambiar programas de estudio sin ampliar la partida de inversión educativa.',180,50,12,-2),
 ('mobility-network',1,'public-transport','Ampliar el transporte público','Mejorar ferrocarril regional, frecuencias y conexiones de municipios aislados.',-980,25,27,3),
 ('mobility-network',1,'freight-corridors','Modernizar corredores logísticos','Invertir en infraestructuras de mercancías para reducir costes a las empresas.',-720,75,29,1),
 ('mobility-network',1,'maintenance-only','Limitarse al mantenimiento','Aplazar los proyectos de ampliación y mantener la red existente.',100,50,15,-3),
 ('employment-transition',1,'reskilling','Financiar la recualificación','Proporcionar formación y acompañamiento a trabajadores desplazados por la tecnología.',-600,25,30,3),
 ('employment-transition',1,'innovation-incentives','Acelerar la modernización','Apoyar inversión privada innovadora y proyectos de empleo tecnológico.',-500,75,30,0),
 ('employment-transition',1,'labor-observatory','Evaluar antes de intervenir','Crear una evaluación administrativa sin nuevo programa público de ayudas.',250,50,15,-2),
 ('food-resilience',1,'essential-basket','Proteger la cesta básica','Conceder ayudas focalizadas a los hogares de menores ingresos.',-550,25,28,2),
 ('food-resilience',1,'farm-upgrade','Modernizar el sector agrario','Cofinanciar almacenamiento, regadío eficiente y logística cooperativa.',-650,75,27,2),
 ('food-resilience',1,'reserve-funds','Preservar el margen fiscal','Evitar subsidios nuevos y mantener reservas ante eventuales emergencias.',300,50,14,-3),
 ('digital-sovereignty',1,'citizen-protection','Proteger los datos ciudadanos','Reforzar servicios públicos, protección de información personal y atención presencial.',-680,25,27,4),
 ('digital-sovereignty',1,'public-platforms','Digitalizar la administración','Unificar trámites, reforzar continuidad operativa y abrir plataformas interoperables.',-450,75,26,2),
 ('digital-sovereignty',1,'limited-audit','Aplicar controles mínimos','Realizar auditorías y mantener sistemas existentes sin gran renovación.',200,50,13,-3),
 ('climate-adaptation',1,'local-resilience','Proteger a los municipios','Financiar refugios climáticos, protección de barrios e infraestructuras críticas locales.',-850,25,29,3),
 ('climate-adaptation',1,'industrial-transition','Incentivar la transición productiva','Modernizar industrias vulnerables y promover eficiencia de recursos.',-600,75,29,1),
 ('climate-adaptation',1,'monitoring-plan','Priorizar seguimiento y reservas','Ampliar el análisis de riesgos y posponer gran parte de la inversión.',150,50,15,-2);
