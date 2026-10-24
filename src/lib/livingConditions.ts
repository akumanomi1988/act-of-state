import { requireClient } from './game'

export type LivingWindow = 7 | 30 | 90
export interface LivingSummary {
  households: number
  residents: number
  economicSecurity: number
  serviceAccess: number
  wellbeing: number
  approvalBefore: number
  approvalAfter: number
  trustBefore: number
  trustAfter: number
}
export interface LivingSegment {
  dimension: 'income' | 'district'
  code: string
  households: number
  residents: number
  economicSecurity: number
  serviceAccess: number
  wellbeing: number
  support: number
}
export interface LivingRecord {
  day: string
  capturedAt: string
  modelVersion: 'living-conditions-v1'
  summary: LivingSummary
}
export interface LivingHistory {
  governmentId: string
  serverDay: string
  fromDay: string
  days: LivingWindow
  expectedDays: number
  recordedDays: number
  latest: (LivingRecord & {
    segments: LivingSegment[]
    inputs: {
      gdpIndex: number
      unemploymentBp: number
      inflationBp: number
      policy: { health: number; education: number; infrastructure: number; security: number; tax_rate: number }
    }
  }) | null
  history: LivingRecord[]
}

const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v)
const score = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100
const count = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0
const date = (v: unknown): v is string => typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v)) &&
  new Date(v).toISOString().slice(0, 10) === v
const scores = (v: Record<string, unknown>, keys: string[]) => keys.every(k => score(v[k]))
const summaryScores = ['economicSecurity', 'serviceAccess', 'wellbeing',
  'approvalBefore', 'approvalAfter', 'trustBefore', 'trustAfter'] as const
function record(v: unknown): v is LivingRecord {
  return object(v) && date(v.day) && typeof v.capturedAt === 'string' &&
    Number.isFinite(Date.parse(v.capturedAt)) && v.modelVersion === 'living-conditions-v1' &&
    object(v.summary) && v.summary.households === 300 &&
    count(v.summary.residents) && v.summary.residents >= 300 &&
    scores(v.summary, [...summaryScores])
}
export function validateLivingHistory(raw: unknown, governmentId: string, days: LivingWindow): LivingHistory {
  const fail = () => { throw new Error('LIVING_CONDITIONS_INVALID_RESPONSE') }
  if (!object(raw) || raw.governmentId !== governmentId || raw.days !== days ||
    !date(raw.serverDay) || !date(raw.fromDay) || raw.fromDay > raw.serverDay ||
    !count(raw.expectedDays) || raw.expectedDays > days ||
    !count(raw.recordedDays) || raw.recordedDays > raw.expectedDays ||
    !Array.isArray(raw.history) || raw.history.length !== raw.recordedDays) return fail()
  let previous = ''
  for (const entry of raw.history) {
    if (!record(entry) || entry.day <= previous || entry.day < raw.fromDay || entry.day > raw.serverDay) return fail()
    previous = entry.day
  }
  if (raw.latest !== null) {
    const latest = raw.latest
    if (!record(latest) || latest.day > raw.serverDay || !object(latest) ||
      !Array.isArray(latest.segments) || latest.segments.length !== 9 ||
      !object(latest.inputs) || !object(latest.inputs.policy)) return fail()
    const inputs = latest.inputs
    if (!['gdpIndex', 'unemploymentBp', 'inflationBp'].every(k =>
      typeof inputs[k] === 'number' && Number.isFinite(inputs[k]) && inputs[k] >= 0) ||
      !scores(inputs.policy as Record<string, unknown>, ['health', 'education', 'infrastructure', 'security', 'tax_rate'])) return fail()
    const seen = new Set<string>()
    for (const segment of latest.segments) {
      if (!object(segment) || !['income', 'district'].includes(String(segment.dimension)) ||
        typeof segment.code !== 'string' || !count(segment.households) || segment.households < 1 ||
        !count(segment.residents) || segment.residents < segment.households ||
        !scores(segment, ['economicSecurity', 'serviceAccess', 'wellbeing', 'support']) ||
        seen.has(segment.dimension + ':' + segment.code)) return fail()
      seen.add(segment.dimension + ':' + segment.code)
    }
    for (const dimension of ['income', 'district']) {
      const segments = latest.segments.filter(s => s.dimension === dimension)
      if (segments.length !== (dimension === 'income' ? 3 : 6) ||
        segments.reduce((n, s) => n + s.households, 0) !== 300 ||
        segments.reduce((n, s) => n + s.residents, 0) !== latest.summary.residents) return fail()
    }
    const last = raw.history.at(-1)
    if (last && (last.day !== latest.day ||
      [...summaryScores, 'households', 'residents'].some(k =>
        last.summary[k as keyof LivingSummary] !== latest.summary[k as keyof LivingSummary]))) return fail()
  } else if (raw.history.length || raw.expectedDays) return fail()
  return raw as unknown as LivingHistory
}

export async function fetchLivingConditions(governmentId: string, days: LivingWindow): Promise<LivingHistory> {
  const { data, error } = await requireClient().rpc('get_living_conditions', {
    p_government_id: governmentId, p_days: days
  })
  if (error) throw error
  return validateLivingHistory(data, governmentId, days)
}

export const livingLabels: Record<string, string> = {
  low: 'Ingresos bajos', middle: 'Ingresos medios', high: 'Ingresos altos',
  capital: 'Distrito Capital', industrial: 'Corredor Industrial', coastal: 'Región Costera',
  agrarian: 'Llanuras Agrarias', highland: 'Territorios de Montaña', frontier: 'Frontera Interior'
}
