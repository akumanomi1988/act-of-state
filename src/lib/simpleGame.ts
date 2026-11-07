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
  const signed = INTRO_CASES.map(scenario =>
    world.events.find(event =>
      event.dossier_id === scenario.id && event.dossier_version === scenario.version) ?? null)
  const nextIndex = signed.findIndex(event => event === null)
  const completed = signed.filter(Boolean).length
  const finalEvent = signed.filter(event => event !== null)
    .sort((a, b) => a!.created_at.localeCompare(b!.created_at)).at(-1) ?? null
  return {
    completed,
    nextIndex: nextIndex < 0 ? MANDATE_SIZE : nextIndex,
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
