import { requireClient } from './game'
import {daySpan,isCount,isScore,isTimestamp,isUtcDay} from './serverEvidence'

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

const electionModels = new Set([
  'electoral-cohorts-v1','electoral-cohorts-v2','electoral-households-v1',
  'electoral-districts-v1','electoral-districts-v2'
])
const obj=(v:unknown):v is Record<string,unknown> =>
  v!==null && typeof v==='object' && !Array.isArray(v)
const nonempty=(v:unknown):v is string=>typeof v==='string' && v.trim().length>0

function validParty(v:unknown):v is ElectionParty {
  return obj(v) && nonempty(v.userId) && nonempty(v.partyName) &&
    isCount(v.seatNo,10) && v.seatNo>0 && isCount(v.seats,100) &&
    isCount(v.manifestoPolicy,100) && isScore(v.voteSharePct) &&
    (v.campaignInfluenceTotal===undefined ||
      (typeof v.campaignInfluenceTotal==='number' &&
       Number.isFinite(v.campaignInfluenceTotal) && v.campaignInfluenceTotal>=0))
}
function validCohort(v:unknown):v is ElectionCohort {
  return obj(v) && nonempty(v.code) && isScore(v.weight) &&
    isScore(v.idealPolicy) && isScore(v.support) && isScore(v.trust)
}
function validDistrict(v:unknown):v is ElectionDistrict {
  if(!obj(v) || !nonempty(v.code) || !nonempty(v.label) ||
     !isCount(v.seats,100) || v.seats<1 ||
     !isCount(v.households,1000000) || v.households<1 ||
     !isCount(v.residents,10000000) || v.residents<v.households ||
     !Array.isArray(v.parties) || v.parties.length<2 ||
     v.parties.length>10) return false
  const ids=new Set<string>()
  return v.parties.every(p=>{
    if(!obj(p)||!nonempty(p.userId)||!nonempty(p.partyName)||
      !isScore(p.voteSharePct)||!isCount(p.seats,Number(v.seats))||
      ids.has(p.userId))return false
    ids.add(p.userId);return true
  }) && v.parties.reduce((sum:number,p:ElectionDistrictParty)=>sum+p.seats,0)===v.seats
}
function validProjection(v:unknown):v is ElectionProjection {
  if(!obj(v) || !electionModels.has(String(v.modelVersion)) ||
    !Array.isArray(v.parties) || v.parties.length<2 || v.parties.length>10 ||
    !v.parties.every(validParty) ||
    v.parties.reduce((sum:number,p:ElectionParty)=>sum+p.seats,0)!==100 ||
    !Array.isArray(v.cohorts) || !v.cohorts.length ||
    !v.cohorts.every(validCohort)) return false
  const parties=v.parties as ElectionParty[]
  if(new Set(parties.map(p=>p.userId)).size!==parties.length ||
    new Set(parties.map(p=>p.seatNo)).size!==parties.length ||
    new Set((v.cohorts as ElectionCohort[]).map(c=>c.code)).size!==v.cohorts.length) return false
  if(!String(v.modelVersion).startsWith('electoral-districts-'))return true
  if(!isCount(v.householdSampleSize,1000000) || v.householdSampleSize<1 ||
    !Array.isArray(v.districts) || v.districts.length!==6 ||
    !v.districts.every(validDistrict) ||
    new Set((v.districts as ElectionDistrict[]).map(d=>d.code)).size!==6 ||
    v.districts.reduce((sum:number,d:ElectionDistrict)=>sum+d.seats,0)!==100) return false
  const seats=new Map(parties.map(p=>[p.userId,0]))
  for(const district of v.districts as ElectionDistrict[]) {
    if(district.parties.length!==parties.length ||
      district.parties.some(p=>!seats.has(p.userId)))return false
    for(const p of district.parties)seats.set(p.userId,(seats.get(p.userId)??0)+p.seats)
  }
  return parties.every(p=>seats.get(p.userId)===p.seats)
}

export function validateElectionState(raw:unknown,matchId:string):ElectionState {
  const fail=():never=>{throw new Error('ELECTION_INVALID_RESPONSE')}
  if(!obj(raw) || !isUtcDay(raw.serverDay) ||
    typeof raw.canCertify!=='boolean' ||
    (raw.nextDueOn!==null&&!isUtcDay(raw.nextDueOn)) ||
    (raw.campaignClosesOn!==null&&!isUtcDay(raw.campaignClosesOn)) ||
    (raw.nextDueOn===null)!==(raw.campaignClosesOn===null) ||
    (raw.nextDueOn!==null && raw.campaignClosesOn!==null &&
      daySpan(raw.campaignClosesOn,raw.nextDueOn)!==8) ||
    (raw.canCertify && (raw.nextDueOn===null || raw.serverDay<raw.nextDueOn)) ||
    !validProjection(raw.projection) || !Array.isArray(raw.history))return fail()
  let previous=Number.POSITIVE_INFINITY
  for(const act of raw.history) {
    if(!obj(act) || act.match_id!==matchId || !nonempty(act.id) ||
      !isCount(act.election_no,1000000) || act.election_no<1 ||
      act.election_no>=previous || !isUtcDay(act.scheduled_on) ||
      !isUtcDay(act.certified_on) || act.certified_on<act.scheduled_on ||
      act.certified_on>raw.serverDay || !nonempty(act.incumbent_user_id) ||
      !nonempty(act.winner_user_id) || !electionModels.has(String(act.model_version)) ||
      !isTimestamp(act.created_at) || !validProjection({
        modelVersion:act.model_version,
        parties:act.parties_snapshot,
        cohorts:act.population_snapshot,
        ...(String(act.model_version).startsWith('electoral-districts-')?
          {districts:act.districts_snapshot,householdSampleSize:300}: {})
      }) || !(act.parties_snapshot as ElectionParty[]).some(p=>p.userId===act.winner_user_id))return fail()
    previous=act.election_no
  }
  return raw as unknown as ElectionState
}

export async function fetchElectionState(matchId: string): Promise<ElectionState> {
  const { data, error } = await requireClient().rpc('get_election_state', { p_match_id: matchId })
  if (error) throw error
  return validateElectionState(data,matchId)
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
  // The command response is not enough to certify the UI result. The caller
  // also reloads the authoritative projection and winner before announcing it.
  if(!obj(data)||data.match_id!==matchId||
    !isCount(data.election_no,1000000)||data.election_no<1||
    !nonempty(data.winner_user_id)||!nonempty(data.incumbent_user_id)||
    !isUtcDay(data.certified_on)||!isUtcDay(data.scheduled_on)||
    data.certified_on<data.scheduled_on||!isTimestamp(data.created_at))
    throw new Error('ELECTION_INVALID_RESPONSE')
  return data as unknown as ElectionRecord
}
