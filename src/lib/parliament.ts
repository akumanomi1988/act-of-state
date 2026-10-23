import { requireClient } from './game'

export type ParliamentChoice = 'yes' | 'no' | 'abstain'
export type ParliamentStatus = 'open' | 'passed' | 'rejected'

export interface ParliamentBill {
  id: string
  match_id: string
  dossier_id: string
  dossier_version: number
  option_id: string
  proposed_by: string
  status: ParliamentStatus
  rule_version: 'parliament-majority-v1' | 'parliament-mandates-v2'
  created_at: string
  closes_at: string
  closed_at: string | null
}

export interface ParliamentVote {
  bill_id: string
  match_id: string
  user_id: string
  choice: ParliamentChoice
  seat_weight: number
  created_at: string
}

export interface ParliamentState {
  bills: ParliamentBill[]
  votes: ParliamentVote[]
  serverNow: string
}

async function rpc<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireClient().rpc(name, args)
  if (error) throw error
  if (data == null) throw new Error('PARLIAMENT_INVALID_RESPONSE')
  return data as T
}

export async function fetchParliamentState(matchId: string): Promise<ParliamentState> {
  const data = await rpc<unknown>('get_parliament_state', { p_match_id: matchId })
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('PARLIAMENT_INVALID_RESPONSE')
  }
  const state = data as Partial<ParliamentState>
  if (!Array.isArray(state.bills) || !Array.isArray(state.votes) ||
      typeof state.serverNow !== 'string') {
    throw new Error('PARLIAMENT_INVALID_RESPONSE')
  }
  return state as ParliamentState
}

export function proposeParliamentBill(
  matchId: string, dossierId: string, dossierVersion: number, optionId: string
): Promise<ParliamentBill> {
  return rpc('propose_parliament_bill', {
    p_match_id: matchId, p_dossier_id: dossierId,
    p_dossier_version: dossierVersion, p_option_id: optionId
  })
}

export function castParliamentVote(
  billId: string, choice: ParliamentChoice
): Promise<ParliamentBill> {
  return rpc('cast_parliament_vote', { p_bill_id: billId, p_choice: choice })
}

export function finalizeParliamentBill(billId: string): Promise<ParliamentBill> {
  return rpc('finalize_parliament_bill', { p_bill_id: billId })
}
