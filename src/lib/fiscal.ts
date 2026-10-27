import { requireClient } from './game'
import { daySpan, isCount, isNonNegative, isScore, isTimestamp, isUtcDay } from './serverEvidence'

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

/**
 * Validate the complete fiscal evidence envelope before displaying balances or
 * joining it to societal/election history. RLS remains the authorization layer;
 * these checks catch malformed, stale/cross-government RPC projections.
 */
export function validateFiscalState(raw: unknown, governmentId: string): FiscalState {
  const fail = (): never => { throw new Error('FISCAL_INVALID_RESPONSE') }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail()
  const state = raw as Partial<FiscalState>
  const policy = state.policy
  const indicators = state.indicators
  if (state.governmentId !== governmentId ||
    !isUtcDay(state.serverDay) || !isUtcDay(state.currentWeek) ||
    state.currentWeek > state.serverDay ||
    new Date(state.currentWeek + 'T00:00:00Z').getUTCDay() !== 1 ||
    daySpan(state.currentWeek, state.serverDay) > 7 ||
    typeof state.canRevise !== 'boolean' || typeof state.canEdit !== 'boolean' ||
    !policy || typeof policy !== 'object' || policy.government_id !== governmentId ||
    typeof policy.revised_this_week !== 'boolean' ||
    !isUtcDay(policy.revision_week) || !isTimestamp(policy.updated_at) ||
    !indicators || typeof indicators !== 'object' ||
    !Array.isArray(state.history) || state.history.length > 12 ||
    !FISCAL_SECTORS.every(s => isCount(policy[s.id], 60) &&
      policy[s.id] >= 10) ||
    FISCAL_SECTORS.reduce((sum, sector) => sum + policy[sector.id], 0) !== 100 ||
    !isCount(policy.tax_rate, 45) || policy.tax_rate < 10 ||
    !isNonNegative(state.projectedRevenueM) ||
    !isNonNegative(state.projectedSpendingM) ||
    !isNonNegative(indicators.treasuryM) ||
    !isNonNegative(indicators.debtM) ||
    !isNonNegative(indicators.gdpIndex) ||
    !isNonNegative(indicators.unemploymentBp) ||
    !isNonNegative(indicators.inflationBp) ||
    !isScore(indicators.approval) || !isScore(indicators.trust)) return fail()

  // SQL get_fiscal_state returns newest-first immutable weekly acts, max 12.
  let previousWeek: string | null = null
  for (const act of state.history) {
    if (!act || act.government_id !== governmentId ||
      !isUtcDay(act.week_start) || act.week_start > state.serverDay ||
      new Date(act.week_start + 'T00:00:00Z').getUTCDay() !== 1 ||
      (previousWeek !== null && act.week_start >= previousWeek) ||
      !isTimestamp(act.settled_at) || act.engine_version !== 'national-fiscal-v1' ||
      !act.policy_snapshot || typeof act.policy_snapshot !== 'object' ||
      Array.isArray(act.policy_snapshot) ||
      !isNonNegative(act.revenue_m_eur) || !isNonNegative(act.spending_m_eur) ||
      typeof act.balance_m_eur !== 'number' || !Number.isFinite(act.balance_m_eur) ||
      Math.abs(act.revenue_m_eur - act.spending_m_eur - act.balance_m_eur) > 0.011 ||
      !isNonNegative(act.debt_issued_m_eur) || !isNonNegative(act.debt_repaid_m_eur) ||
      !isNonNegative(act.treasury_after_m_eur) || !isNonNegative(act.debt_after_m_eur) ||
      !isNonNegative(act.gdp_index_after) ||
      !isNonNegative(act.unemployment_bp_after) ||
      !isNonNegative(act.inflation_bp_after)) return fail()
    previousWeek = act.week_start
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
