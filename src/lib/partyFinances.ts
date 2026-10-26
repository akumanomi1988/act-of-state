import { requireClient } from './game'
import type { CampaignStrategy } from './campaign'

export interface PartySpendReceipt {
  id: string
  weekStart: string
  strategy: CampaignStrategy
  costCredits: number
  cohortCode: string
  campaignEventId: string
}

export interface PartyFinanceState {
  matchId: string
  serverDay: string
  weekStart: string
  financeModel: 'equal-public-weekly-v1'
  active: boolean
  earnedCredits: number
  spentCredits: number
  availableCredits: number
  costs: Record<CampaignStrategy, number>
  recentSpending: PartySpendReceipt[]
}

/** Untrusted RPC payload must not power an affordability gate if malformed. */
export function parsePartyFinanceState(raw: unknown, matchId: string): PartyFinanceState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw Error('PARTY_FINANCE_INVALID_RESPONSE')
  const state = raw as Partial<PartyFinanceState>
  const int = (value: unknown) => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0
  const date = (value: unknown) => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
  const costs = state.costs
  const valid = state.matchId === matchId
    && state.financeModel === 'equal-public-weekly-v1'
    && typeof state.active === 'boolean'
    && date(state.serverDay) && date(state.weekStart)
    && int(state.earnedCredits) && int(state.spentCredits)
    && int(state.availableCredits)
    && state.availableCredits === Math.max(0, state.earnedCredits! - state.spentCredits!)
    && costs?.dialogue === 4 && costs.field_visit === 7 && costs.policy_forum === 10
    && Array.isArray(state.recentSpending) && state.recentSpending.length <= 20
    && state.recentSpending.every(item => item && typeof item.id === 'string'
      && item.id.length > 0 && typeof item.campaignEventId === 'string'
      && item.campaignEventId.length > 0 && date(item.weekStart)
      && typeof item.cohortCode === 'string' && item.cohortCode.length > 0
      && (item.strategy === 'dialogue' || item.strategy === 'field_visit' || item.strategy === 'policy_forum')
      && item.costCredits === costs[item.strategy])
  if (!valid) throw Error('PARTY_FINANCE_INVALID_RESPONSE')
  return state as PartyFinanceState
}

export async function fetchPartyFinances(matchId: string): Promise<PartyFinanceState> {
  const { data, error } = await requireClient().rpc('get_party_finances', { p_match_id: matchId })
  if (error) throw error
  return parsePartyFinanceState(data, matchId)
}

