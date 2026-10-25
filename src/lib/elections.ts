import { requireClient } from './game'

export interface ElectionParty {
  userId: string
  seatNo: number
  partyName: string
  manifestoPolicy: number
  campaignInfluenceTotal?: number
  voteSharePct: number
  seats: number
}

export interface ElectionCohort {
  code: string
  weight: number
  idealPolicy: number
  support: number
  trust: number
}

export interface ElectionDistrictParty {
  userId: string
  partyName: string
  voteSharePct: number
  seats: number
}

export interface ElectionDistrict {
  code: string
  label: string
  seats: number
  households: number
  residents: number
  parties: ElectionDistrictParty[]
}

export interface ElectionProjection {
  modelVersion: 'electoral-cohorts-v1' | 'electoral-cohorts-v2' | 'electoral-households-v1' | 'electoral-districts-v1' | 'electoral-districts-v2'
  householdSampleSize?: number
  districts?: ElectionDistrict[]
  parties: ElectionParty[]
  cohorts: ElectionCohort[]
}

export interface ElectionRecord {
  id: string
  match_id: string
  election_no: number
  scheduled_on: string
  certified_on: string
  incumbent_user_id: string
  winner_user_id: string
  model_version: 'electoral-cohorts-v1' | 'electoral-cohorts-v2' | 'electoral-households-v1' | 'electoral-districts-v1' | 'electoral-districts-v2'
  districts_snapshot?: ElectionDistrict[]
  population_snapshot: ElectionCohort[]
  parties_snapshot: ElectionParty[]
  created_at: string
}

export interface ElectionState {
  projection: ElectionProjection
  nextDueOn: string | null
  campaignClosesOn: string | null
  canCertify: boolean
  serverDay: string
  history: ElectionRecord[]
}

function isElectionState(value: unknown): value is ElectionState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const state = value as Partial<ElectionState>
  return !!state.projection && ['electoral-cohorts-v1','electoral-cohorts-v2','electoral-households-v1','electoral-districts-v1','electoral-districts-v2'].includes(state.projection.modelVersion) &&
    Array.isArray(state.projection.parties) &&
    Array.isArray(state.projection.cohorts) &&
    (!['electoral-districts-v1','electoral-districts-v2'].includes(state.projection.modelVersion) ||
      (Array.isArray(state.projection.districts) &&
       state.projection.districts.length === 6 &&
       state.projection.districts.reduce((total,d) => total + d.seats,0) === 100 &&
       state.projection.districts.every(d => d.code && d.label &&
         d.households > 0 && d.residents >= d.households &&
         Array.isArray(d.parties) &&
         d.parties.reduce((total,p) => total+p.seats,0) === d.seats))) &&
    Array.isArray(state.history) &&
    typeof state.canCertify === 'boolean' &&
    typeof state.serverDay === 'string'
}

export async function fetchElectionState(matchId: string): Promise<ElectionState> {
  const { data, error } = await requireClient().rpc('get_election_state', { p_match_id: matchId })
  if (error) throw error
  if (!isElectionState(data)) throw new Error('ELECTION_INVALID_RESPONSE')
  return data
}

export async function setPartyManifesto(matchId: string, policy: number): Promise<void> {
  if (!Number.isInteger(policy) || policy < 0 || policy > 100)
    throw new Error('ELECTION_INVALID_POLICY')
  const { error } = await requireClient().rpc('set_party_manifesto', {
    p_match_id: matchId, p_policy: policy
  })
  if (error) throw error
}

export async function certifyMatchElection(matchId: string): Promise<ElectionRecord> {
  const { data, error } = await requireClient().rpc('certify_match_election', {
    p_match_id: matchId
  })
  if (error) throw error
  if (!data || Array.isArray(data) || typeof data !== 'object' ||
    typeof (data as ElectionRecord).winner_user_id !== 'string')
    throw new Error('ELECTION_INVALID_RESPONSE')
  return data as ElectionRecord
}
