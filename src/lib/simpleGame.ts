import type { GovernmentWorld, GovernmentState, Dossier } from './types'

/**
 * Twelve verified, fictional, permanently available introductory decisions.
 * Identifiers and numerical parameters are copied from versioned SQL seed migrations.
 * Guest outcomes are PREVIEWS, never authoritative; signed events come from PostgreSQL.
 * No news feed or editorial approval is needed to complete this first mandate.
 */
export interface SimpleChoice {
  id: string
  title: string
  description: string
  treasuryDelta: number
  policyTarget: number
  responseIntensity: number
  trustBaseDelta: number
}
export interface SimpleCase {
  id: string
  version: number
  title: string
  context: string
  category: string
  options: readonly SimpleChoice[]
}
export const INTRO_CASES: readonly SimpleCase[] = [
  {
    "id": "energy-resilience",
    "version": 1,
    "title": "Plan de resiliencia energética",
    "context": "el encarecimiento de la energía presiona a hogares e industrias. Decide la prioridad de la intervención pública.",
    "category": "Economía y energía",
    "options": [
      {
        "id": "household-support",
        "title": "Proteger a los hogares",
        "description": "Ayudas focalizadas a hogares vulnerables con coste fiscal.",
        "treasuryDelta": -1400,
        "policyTarget": 25,
        "responseIntensity": 35,
        "trustBaseDelta": 2
      },
      {
        "id": "industry-investment",
        "title": "Incentivar la inversión",
        "description": "Incentivos fiscales a eficiencia energética industrial.",
        "treasuryDelta": -850,
        "policyTarget": 75,
        "responseIntensity": 35,
        "trustBaseDelta": 0
      },
      {
        "id": "fiscal-restraint",
        "title": "Contener el gasto",
        "description": "No activar nuevas ayudas y mantener margen presupuestario.",
        "treasuryDelta": 200,
        "policyTarget": 50,
        "responseIntensity": 20,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "water-security",
    "version": 1,
    "title": "Plan de seguridad hídrica",
    "context": "una sequía prolongada obliga al gobierno a equilibrar el consumo doméstico, la modernización industrial y la sostenibilidad de las cuentas públicas.",
    "category": "Territorio y recursos",
    "options": [
      {
        "id": "household-efficiency",
        "title": "Proteger el suministro doméstico",
        "description": "Financiar ahorro y renovación de redes en barrios y municipios.",
        "treasuryDelta": -650,
        "policyTarget": 25,
        "responseIntensity": 25,
        "trustBaseDelta": 1
      },
      {
        "id": "industrial-reuse",
        "title": "Modernizar el uso industrial del agua",
        "description": "Cofinanciar recirculación y eficiencia hídrica en instalaciones productivas.",
        "treasuryDelta": -950,
        "policyTarget": 75,
        "responseIntensity": 30,
        "trustBaseDelta": 0
      },
      {
        "id": "conserve-reserves",
        "title": "Preservar las reservas fiscales",
        "description": "Aplazar nuevas inversiones y reforzar el margen presupuestario.",
        "treasuryDelta": 150,
        "policyTarget": 50,
        "responseIntensity": 10,
        "trustBaseDelta": -1
      }
    ]
  },
  {
    "id": "housing-access",
    "version": 1,
    "title": "Acceso a una vivienda digna",
    "context": "jóvenes y familias de Arcadia destinan una parte creciente de sus ingresos al alquiler, mientras los municipios piden soluciones duraderas. El Gobierno debe decidir entre inversión pública, incentivos de oferta y austeridad.",
    "category": "Vivienda",
    "options": [
      {
        "id": "public-housing",
        "title": "Crear vivienda pública",
        "description": "Financiar alquiler público asequible y reservar suelo municipal para construir a medio plazo.",
        "treasuryDelta": -900,
        "policyTarget": 25,
        "responseIntensity": 30,
        "trustBaseDelta": 3
      },
      {
        "id": "permit-reform",
        "title": "Agilizar nueva construcción",
        "description": "Reducir los plazos de licencias y ofrecer financiación limitada para nuevas promociones.",
        "treasuryDelta": -450,
        "policyTarget": 75,
        "responseIntensity": 25,
        "trustBaseDelta": 0
      },
      {
        "id": "market-observation",
        "title": "Preservar el presupuesto",
        "description": "Mantener la legislación vigente y priorizar la estabilidad fiscal frente a nuevas ayudas.",
        "treasuryDelta": 200,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "health-capacity",
    "version": 1,
    "title": "El futuro de la atención sanitaria",
    "context": "los hospitales públicos de Arcadia acumulan esperas, el personal sanitario solicita refuerzos y las pequeñas empresas temen nuevas cargas tributarias. El Gobierno dispone de recursos limitados.",
    "category": "Sanidad",
    "options": [
      {
        "id": "clinical-staff",
        "title": "Reforzar la atención primaria",
        "description": "Contratar profesionales y ampliar consultas de proximidad para reducir las listas de espera.",
        "treasuryDelta": -1050,
        "policyTarget": 25,
        "responseIntensity": 32,
        "trustBaseDelta": 4
      },
      {
        "id": "hospital-tech",
        "title": "Invertir en tecnología clínica",
        "description": "Digitalizar las derivaciones y modernizar equipamiento en centros regionales.",
        "treasuryDelta": -700,
        "policyTarget": 65,
        "responseIntensity": 25,
        "trustBaseDelta": 2
      },
      {
        "id": "management-review",
        "title": "Reorganizar sin ampliar gasto",
        "description": "Priorizar auditorías de gestión y redistribución de turnos antes de invertir.",
        "treasuryDelta": 150,
        "policyTarget": 50,
        "responseIntensity": 14,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "education-future",
    "version": 1,
    "title": "Educación y oportunidades",
    "context": "la brecha educativa entre las zonas rurales y urbanas de Arcadia se amplía. Las familias demandan recursos; la industria quiere formación tecnológica. No existe una única medida que satisfaga a todos.",
    "category": "Educación",
    "options": [
      {
        "id": "rural-schools",
        "title": "Reforzar la red escolar",
        "description": "Destinar fondos a profesores, bibliotecas y transporte escolar en municipios pequeños.",
        "treasuryDelta": -800,
        "policyTarget": 25,
        "responseIntensity": 28,
        "trustBaseDelta": 4
      },
      {
        "id": "technical-training",
        "title": "Impulsar la formación técnica",
        "description": "Crear programas duales y convenios de formación con centros productivos.",
        "treasuryDelta": -600,
        "policyTarget": 75,
        "responseIntensity": 27,
        "trustBaseDelta": 1
      },
      {
        "id": "curriculum-review",
        "title": "Actualizar el currículo",
        "description": "Cambiar programas de estudio sin ampliar la partida de inversión educativa.",
        "treasuryDelta": 180,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "mobility-network",
    "version": 1,
    "title": "Un país mejor conectado",
    "context": "las conexiones entre la capital, las comarcas industriales y el interior son desiguales. El Gobierno debe priorizar el acceso universal, la eficiencia logística o el ahorro inmediato.",
    "category": "Infraestructuras",
    "options": [
      {
        "id": "public-transport",
        "title": "Ampliar el transporte público",
        "description": "Mejorar ferrocarril regional, frecuencias y conexiones de municipios aislados.",
        "treasuryDelta": -980,
        "policyTarget": 25,
        "responseIntensity": 27,
        "trustBaseDelta": 3
      },
      {
        "id": "freight-corridors",
        "title": "Modernizar corredores logísticos",
        "description": "Invertir en infraestructuras de mercancías para reducir costes a las empresas.",
        "treasuryDelta": -720,
        "policyTarget": 75,
        "responseIntensity": 29,
        "trustBaseDelta": 1
      },
      {
        "id": "maintenance-only",
        "title": "Limitarse al mantenimiento",
        "description": "Aplazar los proyectos de ampliación y mantener la red existente.",
        "treasuryDelta": 100,
        "policyTarget": 50,
        "responseIntensity": 15,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "employment-transition",
    "version": 1,
    "title": "Empleo ante la automatización",
    "context": "la industria de Arcadia incorpora tecnología que aumenta la productividad, pero amenaza empleos rutinarios. Trabajadores y empresas piden respuestas divergentes.",
    "category": "Trabajo",
    "options": [
      {
        "id": "reskilling",
        "title": "Financiar la recualificación",
        "description": "Proporcionar formación y acompañamiento a trabajadores desplazados por la tecnología.",
        "treasuryDelta": -600,
        "policyTarget": 25,
        "responseIntensity": 30,
        "trustBaseDelta": 3
      },
      {
        "id": "innovation-incentives",
        "title": "Acelerar la modernización",
        "description": "Apoyar inversión privada innovadora y proyectos de empleo tecnológico.",
        "treasuryDelta": -500,
        "policyTarget": 75,
        "responseIntensity": 30,
        "trustBaseDelta": 0
      },
      {
        "id": "labor-observatory",
        "title": "Evaluar antes de intervenir",
        "description": "Crear una evaluación administrativa sin nuevo programa público de ayudas.",
        "treasuryDelta": 250,
        "policyTarget": 50,
        "responseIntensity": 15,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "food-resilience",
    "version": 1,
    "title": "Abastecimiento y precios alimentarios",
    "context": "una mala campaña de cosechas y el encarecimiento del transporte tensionan los precios de alimentos en Arcadia. Productores y consumidores esperan medidas distintas.",
    "category": "Agricultura",
    "options": [
      {
        "id": "essential-basket",
        "title": "Proteger la cesta básica",
        "description": "Conceder ayudas focalizadas a los hogares de menores ingresos.",
        "treasuryDelta": -550,
        "policyTarget": 25,
        "responseIntensity": 28,
        "trustBaseDelta": 2
      },
      {
        "id": "farm-upgrade",
        "title": "Modernizar el sector agrario",
        "description": "Cofinanciar almacenamiento, regadío eficiente y logística cooperativa.",
        "treasuryDelta": -650,
        "policyTarget": 75,
        "responseIntensity": 27,
        "trustBaseDelta": 2
      },
      {
        "id": "reserve-funds",
        "title": "Preservar el margen fiscal",
        "description": "Evitar subsidios nuevos y mantener reservas ante eventuales emergencias.",
        "treasuryDelta": 300,
        "policyTarget": 50,
        "responseIntensity": 14,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "digital-sovereignty",
    "version": 1,
    "title": "Instituciones y seguridad digital",
    "context": "Arcadia ha sufrido interrupciones de varios servicios administrativos. La población demanda privacidad y disponibilidad; las empresas buscan mejores servicios digitales.",
    "category": "Tecnología",
    "options": [
      {
        "id": "citizen-protection",
        "title": "Proteger los datos ciudadanos",
        "description": "Reforzar servicios públicos, protección de información personal y atención presencial.",
        "treasuryDelta": -680,
        "policyTarget": 25,
        "responseIntensity": 27,
        "trustBaseDelta": 4
      },
      {
        "id": "public-platforms",
        "title": "Digitalizar la administración",
        "description": "Unificar trámites, reforzar continuidad operativa y abrir plataformas interoperables.",
        "treasuryDelta": -450,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 2
      },
      {
        "id": "limited-audit",
        "title": "Aplicar controles mínimos",
        "description": "Realizar auditorías y mantener sistemas existentes sin gran renovación.",
        "treasuryDelta": 200,
        "policyTarget": 50,
        "responseIntensity": 13,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "climate-adaptation",
    "version": 1,
    "title": "Adaptación a un clima cambiante",
    "context": "olas de calor e inundaciones ponen a prueba infraestructuras, agricultura y hogares de Arcadia. El Gobierno necesita un plan compatible con la seguridad de las cuentas.",
    "category": "Medio ambiente",
    "options": [
      {
        "id": "local-resilience",
        "title": "Proteger a los municipios",
        "description": "Financiar refugios climáticos, protección de barrios e infraestructuras críticas locales.",
        "treasuryDelta": -850,
        "policyTarget": 25,
        "responseIntensity": 29,
        "trustBaseDelta": 3
      },
      {
        "id": "industrial-transition",
        "title": "Incentivar la transición productiva",
        "description": "Modernizar industrias vulnerables y promover eficiencia de recursos.",
        "treasuryDelta": -600,
        "policyTarget": 75,
        "responseIntensity": 29,
        "trustBaseDelta": 1
      },
      {
        "id": "monitoring-plan",
        "title": "Priorizar seguimiento y reservas",
        "description": "Ampliar el análisis de riesgos y posponer gran parte de la inversión.",
        "treasuryDelta": 150,
        "policyTarget": 50,
        "responseIntensity": 15,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "pension-covenant",
    "version": 1,
    "title": "Pacto de pensiones y generaciones",
    "context": "El envejecimiento ficticio de Arcadia presiona la sostenibilidad de las pensiones mientras los jóvenes reclaman oportunidades de empleo y los mayores exigen certidumbre. Un pacto generacional debe repartir costes sin desatender a quienes ya dependen del sistema.",
    "category": "Protección social",
    "options": [
      {
        "id": "basic-pension-floor",
        "title": "Garantizar una pensión mínima",
        "description": "Elevar las prestaciones mínimas y financiar su revisión anual, asumiendo un mayor compromiso presupuestario.",
        "treasuryDelta": -460,
        "policyTarget": 25,
        "responseIntensity": 29,
        "trustBaseDelta": 3
      },
      {
        "id": "funded-pension-transition",
        "title": "Impulsar fondos complementarios",
        "description": "Crear ahorro complementario voluntario y mejorar la supervisión de los fondos sin sustituir de inmediato el sistema vigente.",
        "treasuryDelta": -180,
        "policyTarget": 75,
        "responseIntensity": 22,
        "trustBaseDelta": 1
      },
      {
        "id": "retirement-timetable",
        "title": "Ajustar gradualmente los plazos",
        "description": "Aplazar parte de la reforma de prestaciones y revisar edades de acceso para liberar recursos a corto plazo.",
        "treasuryDelta": 130,
        "policyTarget": 50,
        "responseIntensity": 11,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "mental-health-network",
    "version": 1,
    "title": "Salud mental y proximidad",
    "context": "En las ciudades y comarcas ficticias aumentan las consultas por ansiedad y soledad, pero los equipos sanitarios ya soportan mucha carga. El Ejecutivo debe elegir entre una red pública, colaboración especializada o contención administrativa.",
    "category": "Sanidad",
    "options": [
      {
        "id": "community-mental-health",
        "title": "Abrir centros comunitarios",
        "description": "Financiar equipos móviles, consultas de barrio y prevención en centros escolares con atención gratuita.",
        "treasuryDelta": -420,
        "policyTarget": 25,
        "responseIntensity": 28,
        "trustBaseDelta": 3
      },
      {
        "id": "specialist-partnerships",
        "title": "Contratar capacidad especializada",
        "description": "Concertar servicios especializados con indicadores públicos de calidad y derivación desde la atención primaria.",
        "treasuryDelta": -180,
        "policyTarget": 75,
        "responseIntensity": 23,
        "trustBaseDelta": 1
      },
      {
        "id": "existing-care-priorities",
        "title": "Reordenar las consultas existentes",
        "description": "Reasignar turnos y coordinar derivaciones sin abrir nuevos centros ni aumentar las partidas de atención.",
        "treasuryDelta": 100,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -2
      }
    ]
  }
]

/** Remaining authored reforms; logged-in players stay on the same simple screen. */
export const CONTINUATION_CASES: readonly SimpleCase[] = [
  {
    "id": "care-economy",
    "version": 1,
    "title": "Cuidados y envejecimiento digno",
    "context": "Miles de familias ficticias combinan trabajo con cuidados a mayores dependientes y personas con discapacidad. Las zonas rurales disponen de menos servicios y una intervención mal diseñada puede aumentar desigualdades territoriales.",
    "category": "Protección social",
    "options": [
      {
        "id": "public-home-care",
        "title": "Financiar cuidados a domicilio",
        "description": "Crear una red pública comarcal de apoyo domiciliario y descanso para familiares cuidadores.",
        "treasuryDelta": -390,
        "policyTarget": 25,
        "responseIntensity": 30,
        "trustBaseDelta": 4
      },
      {
        "id": "cooperative-care",
        "title": "Apoyar cooperativas de cuidados",
        "description": "Abrir programas de acreditación y cofinanciar cooperativas locales con evaluación de resultados.",
        "treasuryDelta": -160,
        "policyTarget": 75,
        "responseIntensity": 23,
        "trustBaseDelta": 1
      },
      {
        "id": "care-service-audit",
        "title": "Auditar prestaciones actuales",
        "description": "Revisar duplicidades y concentrar ayudas existentes sin comprometer nueva inversión estructural.",
        "treasuryDelta": 115,
        "policyTarget": 50,
        "responseIntensity": 13,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "public-safety-pact",
    "version": 1,
    "title": "Seguridad y confianza cívica",
    "context": "Una serie de incidentes ficticios reabre el debate sobre seguridad en estaciones, barrios y zonas de ocio. El temor ciudadano convive con la necesidad de respetar derechos y controlar el uso de datos públicos.",
    "category": "Seguridad",
    "options": [
      {
        "id": "neighborhood-mediation",
        "title": "Prevención y mediación de barrio",
        "description": "Ampliar mediadores, equipos de proximidad y protección de víctimas con supervisión civil.",
        "treasuryDelta": -380,
        "policyTarget": 25,
        "responseIntensity": 29,
        "trustBaseDelta": 3
      },
      {
        "id": "smart-policing",
        "title": "Modernizar la respuesta policial",
        "description": "Renovar comunicación y coordinación operativa con controles explícitos de privacidad y auditoría.",
        "treasuryDelta": -220,
        "policyTarget": 75,
        "responseIntensity": 25,
        "trustBaseDelta": 0
      },
      {
        "id": "targeted-patrols",
        "title": "Redistribuir patrullas",
        "description": "Reordenar los recursos existentes hacia las zonas con mayor demanda sin crear nuevos programas.",
        "treasuryDelta": 90,
        "policyTarget": 50,
        "responseIntensity": 13,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "cultural-belonging",
    "version": 1,
    "title": "Cultura, bibliotecas y cohesión",
    "context": "Los pequeños municipios ficticios pierden espacios culturales mientras los centros metropolitanos concentran programación y financiación. El Gobierno debe ponderar cohesión territorial, economía creativa y necesidades básicas.",
    "category": "Cultura",
    "options": [
      {
        "id": "community-culture",
        "title": "Financiar cultura de proximidad",
        "description": "Abrir bibliotecas multifunción y circuitos culturales de bajo coste en municipios con escasa oferta.",
        "treasuryDelta": -270,
        "policyTarget": 25,
        "responseIntensity": 25,
        "trustBaseDelta": 3
      },
      {
        "id": "creative-industry",
        "title": "Incentivar industrias creativas",
        "description": "Apoyar proyectos culturales exportables, producción local y formación tecnológica para creadores.",
        "treasuryDelta": -145,
        "policyTarget": 75,
        "responseIntensity": 21,
        "trustBaseDelta": 1
      },
      {
        "id": "heritage-maintenance",
        "title": "Priorizar conservación",
        "description": "Concentrar los recursos en mantenimiento del patrimonio existente y suspender nuevas convocatorias.",
        "treasuryDelta": 80,
        "policyTarget": 50,
        "responseIntensity": 11,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "tax-compliance",
    "version": 1,
    "title": "Fraude fiscal y contrato social",
    "context": "Las cuentas ficticias de Arcadia muestran diferencias persistentes entre el esfuerzo de hogares y empresas. La confianza en la recaudación depende tanto de su eficacia como de la previsibilidad para quienes cumplen.",
    "category": "Economía",
    "options": [
      {
        "id": "tax-inspection-access",
        "title": "Reforzar la inspección justa",
        "description": "Ampliar equipos de asistencia e inspección para pequeñas y grandes obligaciones, priorizando garantías y trazabilidad.",
        "treasuryDelta": -300,
        "policyTarget": 25,
        "responseIntensity": 27,
        "trustBaseDelta": 4
      },
      {
        "id": "risk-based-audit",
        "title": "Digitalizar controles tributarios",
        "description": "Modernizar cruces de datos con revisión humana y servicios digitales de cumplimiento para empresas.",
        "treasuryDelta": -160,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 1
      },
      {
        "id": "temporary-regularization",
        "title": "Regularización extraordinaria",
        "description": "Aprobar un esquema temporal de regularización para aumentar ingresos inmediatos con un riesgo reputacional.",
        "treasuryDelta": 230,
        "policyTarget": 50,
        "responseIntensity": 15,
        "trustBaseDelta": -4
      }
    ]
  },
  {
    "id": "industrial-reconversion",
    "version": 1,
    "title": "Reconversión de la industria regional",
    "context": "Varias fábricas ficticias pierden pedidos por cambios tecnológicos y costes energéticos; decenas de comarcas dependen de ellas. El gabinete debe repartir los recursos entre empleo, modernización y estabilidad del tesoro.",
    "category": "Industria",
    "options": [
      {
        "id": "worker-transition-fund",
        "title": "Fondo de transición laboral",
        "description": "Financiar formación, garantías de empleo y apoyo temporal a trabajadores de sectores en reconversión.",
        "treasuryDelta": -540,
        "policyTarget": 25,
        "responseIntensity": 32,
        "trustBaseDelta": 4
      },
      {
        "id": "productive-investment",
        "title": "Acelerar inversión productiva",
        "description": "Cofinanciar maquinaria, eficiencia energética e innovación en consorcios empresariales regionales.",
        "treasuryDelta": -310,
        "policyTarget": 75,
        "responseIntensity": 30,
        "trustBaseDelta": 1
      },
      {
        "id": "orderly-adjustment",
        "title": "Ajuste industrial limitado",
        "description": "Priorizar la solvencia fiscal y la asistencia administrativa sin rescates sectoriales generalizados.",
        "treasuryDelta": 160,
        "policyTarget": 50,
        "responseIntensity": 11,
        "trustBaseDelta": -4
      }
    ]
  },
  {
    "id": "local-enterprise",
    "version": 1,
    "title": "Pequeñas empresas y territorio",
    "context": "Los pequeños negocios ficticios informan de baja productividad, escaso crédito e incertidumbre regulatoria. La actividad comarcal depende de decisiones que no generen privilegios injustificados.",
    "category": "Empleo",
    "options": [
      {
        "id": "microcredit-guarantees",
        "title": "Garantías para negocios locales",
        "description": "Abrir microcréditos públicos condicionados a empleo estable y rendición de cuentas.",
        "treasuryDelta": -440,
        "policyTarget": 25,
        "responseIntensity": 28,
        "trustBaseDelta": 3
      },
      {
        "id": "digital-business-hubs",
        "title": "Centros de modernización empresarial",
        "description": "Financiar asesoramiento digital y redes compartidas de exportación para pymes.",
        "treasuryDelta": -230,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 1
      },
      {
        "id": "licensing-simplification",
        "title": "Simplificar licencias",
        "description": "Reducir cargas administrativas y reservar el gasto para otras prioridades sin subvenciones nuevas.",
        "treasuryDelta": 170,
        "policyTarget": 50,
        "responseIntensity": 14,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "debt-credibility",
    "version": 1,
    "title": "Credibilidad de la deuda pública",
    "context": "Tras varias decisiones de gasto ficticias, Arcadia debe negociar sus próximas necesidades de financiación. Un ajuste abrupto puede dañar servicios; una expansión indiscriminada limita los presupuestos futuros.",
    "category": "Finanzas públicas",
    "options": [
      {
        "id": "social-debt-plan",
        "title": "Pacto fiscal con garantías sociales",
        "description": "Crear un programa plurianual de reducción gradual del déficit con protección de servicios básicos.",
        "treasuryDelta": -260,
        "policyTarget": 25,
        "responseIntensity": 26,
        "trustBaseDelta": 3
      },
      {
        "id": "growth-debt-plan",
        "title": "Consolidación basada en crecimiento",
        "description": "Invertir en gestión de deuda y apoyo productivo con metas de transparencia trimestral.",
        "treasuryDelta": -140,
        "policyTarget": 75,
        "responseIntensity": 22,
        "trustBaseDelta": 1
      },
      {
        "id": "immediate-spending-freeze",
        "title": "Congelación presupuestaria",
        "description": "Posponer programas de gasto no comprometidos para recuperar reservas con coste de aceptación ciudadana.",
        "treasuryDelta": 290,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -4
      }
    ]
  },
  {
    "id": "circular-industry",
    "version": 1,
    "title": "Recursos y economía circular",
    "context": "El consumo ficticio de materiales importados hace vulnerables a las fábricas nacionales. Municipios y empresas quieren reciclar, pero difieren sobre quién debe asumir los costes de adaptación.",
    "category": "Industria",
    "options": [
      {
        "id": "municipal-reuse",
        "title": "Crear redes municipales de reutilización",
        "description": "Invertir en separación, reparación y centros comarcales de recuperación de materiales.",
        "treasuryDelta": -380,
        "policyTarget": 25,
        "responseIntensity": 27,
        "trustBaseDelta": 3
      },
      {
        "id": "recycling-incentives",
        "title": "Incentivar cadenas circulares",
        "description": "Cofinanciar tecnología y acuerdos de recogida industrial con objetivos medibles.",
        "treasuryDelta": -210,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 1
      },
      {
        "id": "voluntary-standards",
        "title": "Normas voluntarias sin subvención",
        "description": "Promover estándares de información y compras públicas prudentes sin inversiones estructurales.",
        "treasuryDelta": 110,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "judicial-delay",
    "version": 1,
    "title": "Justicia ante los retrasos",
    "context": "En la Arcadia ficticia aumentan los procedimientos sin resolver y ciudadanos y empresas pierden confianza en los tiempos judiciales. La independencia de los tribunales debe mantenerse al decidir cómo asignar recursos.",
    "category": "Justicia",
    "options": [
      {
        "id": "regional-justice-support",
        "title": "Reforzar juzgados comarcales",
        "description": "Financiar personal de apoyo, digitalización accesible y salas locales de mediación judicial.",
        "treasuryDelta": -330,
        "policyTarget": 25,
        "responseIntensity": 27,
        "trustBaseDelta": 4
      },
      {
        "id": "procedural-modernization",
        "title": "Modernizar los procedimientos",
        "description": "Actualizar gestión procesal y formación de personal con revisión independiente de resultados.",
        "treasuryDelta": -150,
        "policyTarget": 75,
        "responseIntensity": 25,
        "trustBaseDelta": 1
      },
      {
        "id": "judicial-workload-review",
        "title": "Revisar cargas sin inversión nueva",
        "description": "Redistribuir expedientes y priorizar procedimientos urgentes antes de aumentar plantilla.",
        "treasuryDelta": 100,
        "policyTarget": 50,
        "responseIntensity": 13,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "regional-autonomy",
    "version": 1,
    "title": "Competencias de las regiones",
    "context": "Las regiones ficticias reclaman adaptar servicios a su población, mientras otras temen disparidades de financiación. El Gobierno debe preservar derechos comunes sin ignorar las diferencias territoriales.",
    "category": "Instituciones",
    "options": [
      {
        "id": "territorial-equalization",
        "title": "Fondo territorial de igualdad",
        "description": "Financiar servicios esenciales en distritos rurales y mecanismos auditables de reparto.",
        "treasuryDelta": -390,
        "policyTarget": 25,
        "responseIntensity": 29,
        "trustBaseDelta": 3
      },
      {
        "id": "regional-performance",
        "title": "Acuerdos de gestión territorial",
        "description": "Delegar proyectos con objetivos, información pública y evaluaciones compartidas por los distritos.",
        "treasuryDelta": -220,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 1
      },
      {
        "id": "central-competences",
        "title": "Mantener el marco central",
        "description": "Aplazar nuevas transferencias para proteger la estabilidad presupuestaria y jurídica.",
        "treasuryDelta": 120,
        "policyTarget": 50,
        "responseIntensity": 13,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "integrity-procurement",
    "version": 1,
    "title": "Contratos públicos y transparencia",
    "context": "Un informe ficticio descubre retrasos y adjudicaciones poco comparables en infraestructuras. La ciudadanía pide transparencia, pero los municipios pequeños carecen de personal especializado.",
    "category": "Instituciones",
    "options": [
      {
        "id": "open-contracting",
        "title": "Contratación pública abierta",
        "description": "Publicar expedientes normalizados y financiar supervisión independiente de contratos y conflictos de interés.",
        "treasuryDelta": -260,
        "policyTarget": 25,
        "responseIntensity": 30,
        "trustBaseDelta": 4
      },
      {
        "id": "shared-procurement",
        "title": "Plataforma de compra compartida",
        "description": "Centralizar herramientas de licitación y asistencia jurídica con trazabilidad y recursos de reclamación.",
        "treasuryDelta": -130,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 1
      },
      {
        "id": "basic-procurement-audit",
        "title": "Auditoría de expedientes existentes",
        "description": "Revisar una muestra de contratos sin asumir nuevas competencias o infraestructuras de control.",
        "treasuryDelta": 90,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "participatory-councils",
    "version": 1,
    "title": "Participación ciudadana sostenida",
    "context": "En la nación ficticia la participación pública disminuye entre elecciones y los partidos discuten quién debe fijar prioridades. Se necesitan canales de debate útiles sin sustituir instituciones representativas.",
    "category": "Democracia",
    "options": [
      {
        "id": "civic-assemblies",
        "title": "Asambleas ciudadanas consultivas",
        "description": "Abrir procesos deliberativos accesibles por distrito con informes públicos y seguimiento de propuestas.",
        "treasuryDelta": -180,
        "policyTarget": 25,
        "responseIntensity": 26,
        "trustBaseDelta": 4
      },
      {
        "id": "digital-consultation",
        "title": "Consultas con garantía digital",
        "description": "Crear una plataforma accesible de participación con auditoría externa y asistencia presencial.",
        "treasuryDelta": -95,
        "policyTarget": 75,
        "responseIntensity": 23,
        "trustBaseDelta": 1
      },
      {
        "id": "existing-public-hearings",
        "title": "Conservar audiencias tradicionales",
        "description": "Reforzar la publicación de actas existentes sin crear nuevas estructuras deliberativas.",
        "treasuryDelta": 80,
        "policyTarget": 50,
        "responseIntensity": 11,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "drought-reserves",
    "version": 1,
    "title": "Sequía y reservas hídricas",
    "context": "Tras varios meses ficticios de poca lluvia, la disponibilidad de agua para cultivos y hogares desciende. Las cuencas de Arcadia difieren y un reparto injusto amenaza la cohesión entre distritos.",
    "category": "Medio ambiente",
    "options": [
      {
        "id": "public-water-reserves",
        "title": "Reserva pública de agua",
        "description": "Invertir en reparación de redes y reservas para consumo esencial con apoyo a municipios rurales.",
        "treasuryDelta": -490,
        "policyTarget": 25,
        "responseIntensity": 30,
        "trustBaseDelta": 4
      },
      {
        "id": "smart-irrigation",
        "title": "Regadío eficiente y medición",
        "description": "Cofinanciar sensores, almacenamiento y mejoras de eficiencia condicionadas a ahorro verificable.",
        "treasuryDelta": -250,
        "policyTarget": 75,
        "responseIntensity": 28,
        "trustBaseDelta": 1
      },
      {
        "id": "voluntary-water-limits",
        "title": "Racionamiento voluntario",
        "description": "Coordinar campañas de ahorro y vigilancia del consumo con inversión pública mínima.",
        "treasuryDelta": 170,
        "policyTarget": 50,
        "responseIntensity": 13,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "epidemic-preparedness",
    "version": 1,
    "title": "Preparación sanitaria ante epidemias",
    "context": "Un ejercicio ficticio de salud pública descubre demoras para compartir información clínica y suministros estratégicos. Las decisiones deben proteger libertades y capacidad de respuesta sin atribuir riesgos a grupos sociales.",
    "category": "Sanidad",
    "options": [
      {
        "id": "local-response-stock",
        "title": "Red local de respuesta sanitaria",
        "description": "Crear reservas sanitarias comarcales, formación y atención comunitaria de emergencia.",
        "treasuryDelta": -480,
        "policyTarget": 25,
        "responseIntensity": 29,
        "trustBaseDelta": 4
      },
      {
        "id": "laboratory-coordination",
        "title": "Red de laboratorios interoperables",
        "description": "Financiar alertas clínicas, coordinación de datos anónimos y protocolos interhospitalarios.",
        "treasuryDelta": -240,
        "policyTarget": 75,
        "responseIntensity": 27,
        "trustBaseDelta": 1
      },
      {
        "id": "existing-emergency-protocols",
        "title": "Revisar protocolos vigentes",
        "description": "Auditar reservas e instrucciones ya existentes antes de comprometer nuevas compras.",
        "treasuryDelta": 100,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -2
      }
    ]
  },
  {
    "id": "critical-cyberdefense",
    "version": 1,
    "title": "Infraestructura digital bajo presión",
    "context": "Un fallo ficticio afecta simultáneamente a redes de abastecimiento y servicios administrativos. Proteger la continuidad operativa exige inversiones y garantías de privacidad sin convertir el incidente en vigilancia indiscriminada.",
    "category": "Tecnología",
    "options": [
      {
        "id": "public-resilience-teams",
        "title": "Equipos públicos de resiliencia",
        "description": "Desplegar respuesta técnica para hospitales y servicios básicos, con control democrático y privacidad.",
        "treasuryDelta": -390,
        "policyTarget": 25,
        "responseIntensity": 31,
        "trustBaseDelta": 4
      },
      {
        "id": "critical-private-security",
        "title": "Acuerdos de seguridad sectorial",
        "description": "Crear certificaciones y respuesta coordinada con operadores, auditoría independiente y costes compartidos.",
        "treasuryDelta": -190,
        "policyTarget": 75,
        "responseIntensity": 26,
        "trustBaseDelta": 1
      },
      {
        "id": "limited-system-review",
        "title": "Revisión mínima de continuidad",
        "description": "Programar inspecciones y limitar la renovación técnica para conservar reservas fiscales.",
        "treasuryDelta": 125,
        "policyTarget": 50,
        "responseIntensity": 11,
        "trustBaseDelta": -3
      }
    ]
  },
  {
    "id": "international-supply-shock",
    "version": 1,
    "title": "Dependencia de suministros exteriores",
    "context": "Una interrupción comercial ficticia eleva precios industriales y retrasa entregas esenciales. El Gobierno debe elegir cuánto diversificar, cuánta producción asegurar y qué parte del riesgo asumir.",
    "category": "Relaciones exteriores",
    "options": [
      {
        "id": "strategic-stockpiles",
        "title": "Reservas de suministro esenciales",
        "description": "Financiar reservas rotativas de componentes críticos con criterios públicos y control del gasto.",
        "treasuryDelta": -430,
        "policyTarget": 25,
        "responseIntensity": 28,
        "trustBaseDelta": 3
      },
      {
        "id": "trade-diversification",
        "title": "Diversificar acuerdos comerciales",
        "description": "Apoyar proveedores alternativos y facilitar cooperación logística con socios regionales.",
        "treasuryDelta": -250,
        "policyTarget": 75,
        "responseIntensity": 27,
        "trustBaseDelta": 1
      },
      {
        "id": "market-adjustment",
        "title": "Dejar actuar al mercado",
        "description": "Evitar nuevos compromisos fiscales y revisar solo trámites aduaneros prioritarios.",
        "treasuryDelta": 200,
        "policyTarget": 50,
        "responseIntensity": 12,
        "trustBaseDelta": -3
      }
    ]
  }
]
export const ALL_SOLO_CASES: readonly SimpleCase[] = [...INTRO_CASES, ...CONTINUATION_CASES]
export const ELECTION_CHECKPOINTS = [12, 24, 28] as const
export const MANDATE_SIZE = INTRO_CASES.length
export const GUEST_STORAGE_KEY = 'aos:simple-guest:v1'
export interface GuestDecision { caseId: string; optionId: string }
export interface GuestProgress { version: 1; decisions: GuestDecision[] }
export interface SimpleMetrics { treasury_m_eur: number; approval: number; trust: number }
export interface GuestEvent {
  caseId: string
  optionId: string
  before: SimpleMetrics
  after: SimpleMetrics
}
export type GuestSnapshot = { metrics: SimpleMetrics; events: GuestEvent[] }
export type ElectionResult = {
  estimatedVote: number
  reelected: boolean
  headline: string
}
const bounded = (n: number) => Math.max(0, Math.min(100, n))
export const emptyGuest = (): GuestProgress => ({ version: 1, decisions: [] })

/**
 * Mirrors the founding two-cohort arithmetic for offline guidance. Later
 * demographic migrations and fiscal settlements mean real results can differ.
 */
export function evaluateGuest(progress: GuestProgress): GuestSnapshot {
  if (progress.version !== 1 || !Array.isArray(progress.decisions) ||
      progress.decisions.length > MANDATE_SIZE) throw new Error('INVALID_GUEST_PROGRESS')
  const cohorts = [
    { weight: 65, ideal: 25, support: 50, trust: 50 },
    { weight: 35, ideal: 75, support: 50, trust: 50 }
  ]
  const metrics: SimpleMetrics = { treasury_m_eur: 12000, approval: 50, trust: 50 }
  const events: GuestEvent[] = []
  const seen = new Set<string>()
  for (const decision of progress.decisions) {
    const scenario = INTRO_CASES.find(c => c.id === decision.caseId)
    const choice = scenario?.options.find(o => o.id === decision.optionId)
    if (!scenario || !choice || seen.has(decision.caseId)) throw new Error('INVALID_GUEST_PROGRESS')
    seen.add(decision.caseId)
    const before = { ...metrics }
    metrics.treasury_m_eur += choice.treasuryDelta
    if (metrics.treasury_m_eur < 0) throw new Error('INSUFFICIENT_TREASURY')
    for (const cohort of cohorts) {
      const alignment = 50 - Math.abs(cohort.ideal - choice.policyTarget)
      cohort.support = bounded(cohort.support +
        Math.round(alignment * choice.responseIntensity / 100))
      cohort.trust = bounded(cohort.trust +
        Math.round(alignment * choice.responseIntensity / 200) + choice.trustBaseDelta)
    }
    metrics.approval = Math.round(cohorts.reduce((a, c) => a + c.weight * c.support, 0) / 100)
    metrics.trust = Math.round(cohorts.reduce((a, c) => a + c.weight * c.trust, 0) / 100)
    events.push({ caseId: decision.caseId, optionId: choice.id, before, after: { ...metrics } })
  }
  return { metrics, events }
}

export function chooseGuest(progress: GuestProgress, caseId: string, optionId: string): GuestProgress {
  if (progress.decisions.some(d => d.caseId === caseId)) throw new Error('ALREADY_DECIDED')
  if (INTRO_CASES[progress.decisions.length]?.id !== caseId) throw new Error('OUT_OF_ORDER')
  const updated: GuestProgress = { version: 1,
    decisions: [...progress.decisions, { caseId, optionId }] }
  evaluateGuest(updated)
  return updated
}

export function parseGuest(raw: string | null): GuestProgress {
  if (!raw || raw.length > 4096) return emptyGuest()
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object' || !('version' in parsed) ||
        parsed.version !== 1 || !('decisions' in parsed) || !Array.isArray(parsed.decisions))
      return emptyGuest()
    const decisions: GuestDecision[] = parsed.decisions.map((step: unknown) => {
      if (!step || typeof step !== 'object' || !('caseId' in step) ||
          !('optionId' in step) || typeof step.caseId !== 'string' ||
          typeof step.optionId !== 'string') throw new Error('INVALID_GUEST_PROGRESS')
      return { caseId: step.caseId, optionId: step.optionId }
    })
    const progress: GuestProgress = { version: 1, decisions }
    if (decisions.some((d, i) => d.caseId !== INTRO_CASES[i]?.id)) return emptyGuest()
    evaluateGuest(progress)
    return progress
  } catch { return emptyGuest() }
}

export function loadGuest(): GuestProgress {
  try { return parseGuest(window.localStorage.getItem(GUEST_STORAGE_KEY)) }
  catch { return emptyGuest() }
}
export function saveGuest(progress: GuestProgress): boolean {
  try { window.localStorage.setItem(GUEST_STORAGE_KEY, JSON.stringify(progress)); return true }
  catch { return false }
}
export function clearGuest(): boolean {
  try { window.localStorage.removeItem(GUEST_STORAGE_KEY); return true }
  catch { return false }
}

export function electionResult(state: SimpleMetrics): ElectionResult {
  // Transparent fictional end-of-mandate rule, not certified parliamentary voting.
  const fiscal = bounded(Math.round(state.treasury_m_eur / 12000 * 100))
  const estimatedVote = bounded(Math.round(
    state.approval * 0.60 + state.trust * 0.25 + fiscal * 0.15
  ))
  return {
    estimatedVote,
    reelected: estimatedVote >= 50,
    headline: estimatedVote >= 50
      ? 'La ciudadanía renovaría tu mandato'
      : 'La ciudadanía elegiría un cambio de Gobierno'
  }
}

export function consequences(scenario: SimpleCase, choice: SimpleChoice,
  before: SimpleMetrics, after: SimpleMetrics): { title: string; body: string; warning: string | null } {
  const approval = after.approval - before.approval
  const trust = after.trust - before.trust
  const popular = approval > 0 ? 'sube' : approval < 0 ? 'baja' : 'se mantiene'
  const institutional = trust > 0 ? 'mejora' : trust < 0 ? 'se debilita' : 'se mantiene'
  const spending = after.treasury_m_eur - before.treasury_m_eur
  const cost = spending < 0
    ? 'La inversión reduce los fondos públicos disponibles para futuras crisis.'
    : spending > 0
      ? 'El Tesoro gana margen, aunque el coste político de ahorrar puede aparecer después.'
      : 'La medida no modifica por sí misma el Tesoro.'
  return {
    title: 'El Gobierno pone en marcha: ' + choice.title,
    body: 'Ante ' + scenario.title.toLowerCase() + ', has elegido ' +
      choice.description.charAt(0).toLowerCase() + choice.description.slice(1) +
      ' La popularidad ' + popular + ' y la confianza institucional ' +
      institutional + '. ' + cost,
    warning: after.treasury_m_eur < 3000
      ? 'Las reservas se están agotando. Tus próximas decisiones tendrán menos margen financiero.'
      : null
  }
}

export function committedMandate(world: GovernmentWorld) {
  const signed = ALL_SOLO_CASES.map(scenario =>
    world.events.find(event =>
      event.dossier_id === scenario.id && event.dossier_version === scenario.version) ?? null)
  const nextIndex = signed.findIndex(event => event === null)
  const completed = nextIndex < 0 ? ALL_SOLO_CASES.length : nextIndex
  const totalSigned = signed.filter(Boolean).length
  const finalEvent = signed.filter(event => event !== null)
    .sort((a, b) => a!.created_at.localeCompare(b!.created_at)).at(-1) ?? null
  return {
    completed,
    nextIndex: nextIndex < 0 ? ALL_SOLO_CASES.length : nextIndex,
    totalSigned,
    finalState: finalEvent?.state_after ?? world.government as GovernmentState,
    finalEvent,
    signed
  }
}

export interface GuestImportServices {
  load: () => Promise<GovernmentWorld>
  sign: (scenario: Dossier, choiceId: string) => Promise<unknown>
}
export class GuestImportConflict extends Error {
  constructor(message: string) { super(message); this.name = 'GuestImportConflict' }
}

/**
 * Only called after explicit player approval. Revalidates every signed step
 * against a fresh authorized snapshot. Lost HTTP responses are reconciled.
 * Does not clear browser progress: the caller only does so on full success.
 */
export async function importGuest(progress: GuestProgress, services: GuestImportServices):
  Promise<{ world: GovernmentWorld; imported: number }> {
  evaluateGuest(progress)
  let world = await services.load()
  let imported = 0
  for (const step of progress.decisions) {
    const scenario = INTRO_CASES.find(s => s.id === step.caseId)
    if (!scenario) throw new GuestImportConflict('Decisión de invitado desconocida.')
    const existing = world.events.find(e => e.dossier_id === scenario.id)
    if (existing) {
      if (existing.option_id !== step.optionId || existing.dossier_version !== scenario.version)
        throw new GuestImportConflict('La decisión «' + scenario.title +
          '» ya existe con otra opción. No se ha sobrescrito tu gobierno.')
      continue
    }
    const real = world.dossiers.find(d =>
      d.id === scenario.id && d.version === scenario.version && d.release_kind === 'intro')
    const match = world.options.find(o =>
      o.dossier_id === scenario.id && o.dossier_version === scenario.version &&
      o.id === step.optionId)
    if (!real || !match) throw new GuestImportConflict('El servidor todavía no tiene el expediente «' +
      scenario.title + '». Tus decisiones siguen guardadas en este navegador.')
    let error: unknown
    try { await services.sign(real, match.id) } catch (reason) { error = reason }
    // Even on transport failure the RPC may have committed: always reconcile.
    world = await services.load()
    const verified = world.events.find(e => e.dossier_id === scenario.id)
    if (!verified) {
      if (error) throw error
      throw new GuestImportConflict('No se ha confirmado «' + scenario.title +
        '». Puedes reintentar sin duplicar las decisiones ya registradas.')
    }
    if (verified.option_id !== step.optionId || verified.dossier_version !== scenario.version)
      throw new GuestImportConflict('El servidor ha registrado una opción distinta para «' +
        scenario.title + '». Se ha detenido la importación.')
    imported++
  }
  return { world, imported }
}
