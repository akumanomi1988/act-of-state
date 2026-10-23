import { requireClient } from './game'

export type FiscalSector = 'health' | 'education' | 'infrastructure' | 'security'
export const FISCAL_SECTORS: readonly { id: FiscalSector; label: string }[] = [
  { id: 'health', label: 'Sanidad' },
  { id: 'education', label: 'Educación' },
  { id: 'infrastructure', label: 'Infraestructuras' },
  { id: 'security', label: 'Seguridad' }
]

export interface FiscalPolicy {
  government_id: string
  health: number
  education: number
  infrastructure: number
  security: number
  tax_rate: number
  revised_this_week: boolean
  revision_week: string
  updated_at: string
}
export interface FiscalIndicators {
  treasuryM: number
  debtM: number
  gdpIndex: number
  unemploymentBp: number
  inflationBp: number
  approval: number
  trust: number
}
export interface FiscalAct {
  government_id: string
  week_start: string
  settled_at: string
  engine_version: 'national-fiscal-v1'
  policy_snapshot: Record<string, unknown>
  revenue_m_eur: number
  spending_m_eur: number
  balance_m_eur: number
  debt_issued_m_eur: number
  debt_repaid_m_eur: number
  treasury_after_m_eur: number
  debt_after_m_eur: number
  gdp_index_after: number
  unemployment_bp_after: number
  inflation_bp_after: number
}
export interface FiscalState {
  governmentId: string
  serverDay: string
  currentWeek: string
  canRevise: boolean
  canEdit: boolean
  policy: FiscalPolicy
  projectedRevenueM: number
  projectedSpendingM: number
  indicators: FiscalIndicators
  history: FiscalAct[]
}

function isFiniteNonNegative(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
}
export function validateFiscalState(raw: unknown, governmentId: string): FiscalState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('FISCAL_INVALID_RESPONSE')
  const state = raw as Partial<FiscalState>
  const policy = state.policy
  const indicators = state.indicators
  if (state.governmentId !== governmentId ||
    typeof state.serverDay !== 'string' || typeof state.currentWeek !== 'string' ||
    typeof state.canRevise !== 'boolean' || typeof state.canEdit !== 'boolean' ||
    !policy || !indicators || !Array.isArray(state.history) ||
    !FISCAL_SECTORS.every(s => Number.isInteger(policy[s.id]) &&
      policy[s.id] >= 10 && policy[s.id] <= 60) ||
    FISCAL_SECTORS.reduce((sum,sector) => sum+policy[sector.id],0) !== 100 ||
    !Number.isInteger(policy.tax_rate) || policy.tax_rate < 10 || policy.tax_rate > 45 ||
    !isFiniteNonNegative(state.projectedRevenueM) ||
    !isFiniteNonNegative(state.projectedSpendingM) ||
    !isFiniteNonNegative(indicators.treasuryM) ||
    !isFiniteNonNegative(indicators.debtM) ||
    !isFiniteNonNegative(indicators.gdpIndex) ||
    !isFiniteNonNegative(indicators.unemploymentBp) ||
    !isFiniteNonNegative(indicators.inflationBp) ||
    !state.history.every(entry =>
      typeof entry.week_start === 'string' &&
      Number.isFinite(entry.balance_m_eur) &&
      isFiniteNonNegative(entry.treasury_after_m_eur))) {
    throw new Error('FISCAL_INVALID_RESPONSE')
  }
  return state as FiscalState
}

export async function fetchFiscalState(governmentId: string): Promise<FiscalState> {
  const { data, error } = await requireClient().rpc('get_fiscal_state',
    { p_government_id: governmentId })
  if (error) throw error
  return validateFiscalState(data, governmentId)
}

export async function setFiscalPolicy(
  governmentId: string, policy: Pick<FiscalPolicy,
    FiscalSector | 'tax_rate'>
): Promise<FiscalPolicy> {
  if (!FISCAL_SECTORS.every(s => Number.isInteger(policy[s.id])) ||
    FISCAL_SECTORS.reduce((sum,s) => sum+policy[s.id],0) !== 100 ||
    !Number.isInteger(policy.tax_rate)) throw new Error('FISCAL_INVALID_ALLOCATION')
  const { data, error } = await requireClient().rpc('set_fiscal_policy', {
    p_government_id: governmentId,
    p_health: policy.health,
    p_education: policy.education,
    p_infrastructure: policy.infrastructure,
    p_security: policy.security,
    p_tax_rate: policy.tax_rate
  })
  if (error) throw error
  if (!data || typeof data !== 'object' || Array.isArray(data))
    throw new Error('FISCAL_INVALID_RESPONSE')
  return data as FiscalPolicy
}
