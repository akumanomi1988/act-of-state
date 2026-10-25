/**
 * AOS-042: explicitly non-authoritative, authored guest training scenario.
 * No real governments, elections, Supabase requests or production engine calls.
 * Only validated option identifiers are stored in this browser.
 */
export const DEMO_STORAGE_KEY = 'aos:guest-training:v1'
export const DEMO_MODEL_VERSION = 1 as const

export type DemoMetrics = {
  treasury: number
  approval: number
  trust: number
  households: number
  companies: number
}

export type DemoChoice = {
  id: string
  title: string
  description: string
  effects: DemoMetrics
}

export type DemoCase = {
  id: string
  category: string
  title: string
  context: string
  choices: readonly DemoChoice[]
}

export type DemoDecision = { caseId: string; optionId: string }
export type DemoProgress = { version: typeof DEMO_MODEL_VERSION; decisions: DemoDecision[] }

export const INITIAL_METRICS: Readonly<DemoMetrics> = Object.freeze({
  treasury: 8000, approval: 50, trust: 50, households: 50, companies: 50
})

// Numbers are authored pedagogical fixtures, NOT the server-side decision model.
export const DEMO_CASES: readonly DemoCase[] = [
  {
    id: 'energy', category: 'Energía', title: 'Un invierno de precios elevados',
    context: 'En la República ficticia de Arcadia, los hogares afrontan facturas energéticas elevadas. Las empresas alertan de dificultades para mantener la producción.',
    choices: [
      { id: 'aid', title: 'Ayuda directa a familias', description: 'Subvencionar facturas priorizando los hogares vulnerables.', effects: { treasury: -1200, approval: 9, trust: 5, households: 14, companies: -2 } },
      { id: 'grid', title: 'Invertir en la red eléctrica', description: 'Una inversión de retorno lento con beneficio para la actividad industrial.', effects: { treasury: -1800, approval: 3, trust: 7, households: 4, companies: 12 } },
      { id: 'market', title: 'No intervenir en los precios', description: 'Preservar tesorería asumiendo mayor presión social.', effects: { treasury: 350, approval: -11, trust: -7, households: -13, companies: 4 } }
    ]
  },
  {
    id: 'housing', category: 'Vivienda', title: 'El acceso a la vivienda',
    context: 'La población joven reclama alquileres asequibles. Los promotores solicitan menos trabas para levantar nuevas viviendas.',
    choices: [
      { id: 'public', title: 'Crear un parque público', description: 'Financiar nuevas viviendas de alquiler asequible.', effects: { treasury: -1600, approval: 8, trust: 8, households: 12, companies: -4 } },
      { id: 'licenses', title: 'Agilizar licencias de obra', description: 'Reducir trámites e impulsar la construcción privada.', effects: { treasury: -250, approval: 3, trust: -1, households: 1, companies: 12 } },
      { id: 'rent', title: 'Ayuda temporal al alquiler', description: 'Apoyo rápido con coste fiscal recurrente ilustrativo.', effects: { treasury: -750, approval: 7, trust: 3, households: 9, companies: -3 } }
    ]
  },
  {
    id: 'water', category: 'Territorio', title: 'Reservas de agua en mínimos',
    context: 'Una sequía ficticia obliga a elegir entre seguridad hídrica, agricultura y sostenibilidad presupuestaria.',
    choices: [
      { id: 'reservoir', title: 'Modernizar infraestructuras', description: 'Reducir fugas y reforzar las reservas.', effects: { treasury: -1400, approval: 5, trust: 10, households: 8, companies: 5 } },
      { id: 'ration', title: 'Aplicar restricciones', description: 'Proteger el suministro con limitaciones temporales al consumo.', effects: { treasury: -150, approval: -7, trust: 4, households: -8, companies: -9 } },
      { id: 'subsidy', title: 'Compensar a productores', description: 'Ayudas inmediatas al sector agrario.', effects: { treasury: -900, approval: 2, trust: -1, households: -1, companies: 9 } }
    ]
  },
  {
    id: 'health', category: 'Servicios públicos', title: 'Listas de espera sanitarias',
    context: 'Aumentan las demoras en atención médica. Los presupuestos tienen recursos limitados para el siguiente ejercicio ficticio.',
    choices: [
      { id: 'staff', title: 'Reforzar las plantillas', description: 'Contratar personal y ampliar turnos.', effects: { treasury: -1300, approval: 11, trust: 8, households: 12, companies: -3 } },
      { id: 'digital', title: 'Modernizar gestión y citas', description: 'Priorizar sistemas y reorganización asistencial.', effects: { treasury: -650, approval: 5, trust: 6, households: 6, companies: 5 } },
      { id: 'freeze', title: 'Congelar nuevas partidas', description: 'Equilibrar las cuentas aceptando mayor malestar.', effects: { treasury: 400, approval: -13, trust: -11, households: -12, companies: 3 } }
    ]
  }
] as const

export function emptyDemoProgress(): DemoProgress {
  return { version: DEMO_MODEL_VERSION, decisions: [] }
}

function bounded(value: number): number {
  return Math.max(0, Math.min(100, value))
}

export function applyDemoDecision(progress: DemoProgress, caseId: string, optionId: string): DemoProgress {
  const current = evaluateDemo(progress)
  if (current.history.some(item => item.caseId === caseId)) throw new Error('ALREADY_DECIDED')
  const dossier = DEMO_CASES.find(item => item.id === caseId)
  const choice = dossier?.choices.find(item => item.id === optionId)
  if (!dossier || !choice) throw new Error('INVALID_OPTION')
  if (current.metrics.treasury + choice.effects.treasury < 0) throw new Error('INSUFFICIENT_TREASURY')
  return { version: DEMO_MODEL_VERSION, decisions: [...progress.decisions, { caseId, optionId }] }
}

export type DemoEvent = {
  caseId: string
  dossierTitle: string
  optionId: string
  optionTitle: string
  before: DemoMetrics
  after: DemoMetrics
  effects: DemoMetrics
}

export function evaluateDemo(progress: DemoProgress): { metrics: DemoMetrics; history: DemoEvent[] } {
  if (progress.version !== DEMO_MODEL_VERSION || !Array.isArray(progress.decisions) ||
      progress.decisions.length > DEMO_CASES.length) throw new Error('INVALID_DEMO_PROGRESS')
  const metrics: DemoMetrics = { ...INITIAL_METRICS }
  const history: DemoEvent[] = []
  const seen = new Set<string>()
  for (const step of progress.decisions) {
    const dossier = DEMO_CASES.find(item => item.id === step.caseId)
    const choice = dossier?.choices.find(item => item.id === step.optionId)
    if (!dossier || !choice || seen.has(step.caseId)) throw new Error('INVALID_DEMO_PROGRESS')
    seen.add(step.caseId)
    const before = { ...metrics }
    metrics.treasury += choice.effects.treasury
    if (metrics.treasury < 0) throw new Error('INVALID_DEMO_PROGRESS')
    for (const metric of ['approval', 'trust', 'households', 'companies'] as const) {
      metrics[metric] = bounded(metrics[metric] + choice.effects[metric])
    }
    history.push({
      caseId: dossier.id, dossierTitle: dossier.title, optionId: choice.id,
      optionTitle: choice.title, before, after: { ...metrics }, effects: choice.effects
    })
  }
  return { metrics, history }
}

export function parseDemoProgress(serialized: string | null): DemoProgress {
  if (!serialized || serialized.length > 4096) return emptyDemoProgress()
  try {
    const parsed: unknown = JSON.parse(serialized)
    if (typeof parsed !== 'object' || !parsed || !('version' in parsed) ||
        parsed.version !== DEMO_MODEL_VERSION || !('decisions' in parsed) ||
        !Array.isArray(parsed.decisions)) return emptyDemoProgress()
    const decisions: DemoDecision[] = []
    for (const decision of parsed.decisions) {
      if (typeof decision !== 'object' || !decision ||
          typeof decision.caseId !== 'string' || typeof decision.optionId !== 'string') {
        return emptyDemoProgress()
      }
      decisions.push({ caseId: decision.caseId, optionId: decision.optionId })
    }
    const progress: DemoProgress = { version: DEMO_MODEL_VERSION, decisions }
    evaluateDemo(progress) // Validate every ID, uniqueness and affordability.
    return progress
  } catch {
    return emptyDemoProgress()
  }
}

export function loadDemoProgress(): DemoProgress {
  try { return parseDemoProgress(window.localStorage.getItem(DEMO_STORAGE_KEY)) }
  catch { return emptyDemoProgress() }
}

export function saveDemoProgress(progress: DemoProgress): boolean {
  try {
    window.localStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(progress))
    return true
  } catch { return false }
}

export function clearDemoProgress(): boolean {
  try { window.localStorage.removeItem(DEMO_STORAGE_KEY); return true }
  catch { return false }
}
