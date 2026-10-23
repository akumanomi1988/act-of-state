import { requireClient } from './game'

export interface CoalitionMember {
  match_id: string
  user_id: string
  leader_id: string
  status: 'invited' | 'accepted' | 'declined' | 'left'
  updated_at: string
}
export interface ConfidenceMotion {
  id: string
  match_id: string
  proposer_id: string
  candidate_id: string
  incumbent_id: string
  status: 'open' | 'passed' | 'rejected'
  created_at: string
  closes_at: string
  closed_at: string | null
  rule_version: string
}
export interface ConfidenceVote {
  motion_id: string
  match_id: string
  user_id: string
  choice: 'yes' | 'no' | 'abstain'
  seat_weight: number
  created_at: string
}
export interface GovernanceState {
  hostUserId: string
  totalSeats: number
  coalitionSeats: number
  coalition: CoalitionMember[]
  motions: ConfidenceMotion[]
  votes: ConfidenceVote[]
  serverNow: string
}

async function invoke<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireClient().rpc(name, args)
  if (error) throw error
  if (data == null) throw new Error('GOVERNANCE_INVALID_RESPONSE')
  return data as T
}

export async function fetchGovernanceState(matchId: string): Promise<GovernanceState> {
  const value = await invoke<unknown>('get_governance_state', { p_match_id: matchId })
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('GOVERNANCE_INVALID_RESPONSE')
  }
  const state = value as Partial<GovernanceState>
  if (typeof state.hostUserId !== 'string' ||
    !Number.isInteger(state.totalSeats) || !Number.isInteger(state.coalitionSeats) ||
    !Array.isArray(state.coalition) || !Array.isArray(state.motions) ||
    !Array.isArray(state.votes) || typeof state.serverNow !== 'string') {
    throw new Error('GOVERNANCE_INVALID_RESPONSE')
  }
  return state as GovernanceState
}

export function inviteCoalitionPartner(matchId: string, partnerId: string) {
  return invoke<CoalitionMember>('invite_coalition_partner',
    { p_match_id: matchId, p_partner: partnerId })
}
export function respondCoalitionInvite(matchId: string, accept: boolean) {
  return invoke<CoalitionMember>('respond_coalition_invite',
    { p_match_id: matchId, p_accept: accept })
}
export function proposeConfidenceMotion(matchId: string, candidateId: string) {
  return invoke<ConfidenceMotion>('propose_confidence_motion',
    { p_match_id: matchId, p_candidate: candidateId })
}
export function castConfidenceVote(motionId: string, choice: ConfidenceVote['choice']) {
  return invoke<ConfidenceMotion>('cast_confidence_vote',
    { p_motion_id: motionId, p_choice: choice })
}
export function finalizeConfidenceMotion(motionId: string) {
  return invoke<ConfidenceMotion>('finalize_confidence_motion', { p_motion_id: motionId })
}
