import {requireClient} from './game'
import type {ElectionDistrict,ElectionParty} from './elections'
import {daySpan,isCount,isScore,isTimestamp,isUtcDay} from './serverEvidence'

export interface OpinionPoll {
 day:string
 capturedAt:string
 modelVersion:string
 householdSampleSize:number|null
 parties:ElectionParty[]
 districts:ElectionDistrict[]
}
export interface OpinionHistory {
 matchId:string
 serverDay:string
 fromDay:string
 days:number
 expectedDays:number
 recordedDays:number
 polls:OpinionPoll[]
}
function obj(value:unknown):value is Record<string,unknown> {
 return value!==null&&typeof value==='object'&&!Array.isArray(value)
}
const modelVersions = new Set([
 'electoral-cohorts-v1','electoral-cohorts-v2','electoral-households-v1',
 'electoral-districts-v1','electoral-districts-v2'
])
function party(value:unknown):value is ElectionParty {
 return obj(value) && typeof value.userId==='string' && value.userId.length>0 &&
  typeof value.partyName==='string' && value.partyName.length>0 &&
  isCount(value.seatNo,10) && value.seatNo>0 && isCount(value.seats,100) &&
  isCount(value.manifestoPolicy,100) && isScore(value.voteSharePct) &&
  (value.campaignInfluenceTotal===undefined ||
   (typeof value.campaignInfluenceTotal==='number' &&
    Number.isFinite(value.campaignInfluenceTotal) && value.campaignInfluenceTotal>=0))
}
function district(value:unknown):value is ElectionDistrict {
 if(!obj(value) || typeof value.code!=='string' || !value.code ||
   typeof value.label!=='string' || !value.label ||
   !isCount(value.seats,100) || value.seats<1 ||
   !isCount(value.households,1000000) || value.households<1 ||
   !isCount(value.residents,10000000) || value.residents<value.households ||
   !Array.isArray(value.parties) || !value.parties.length || value.parties.length>10) return false
 const seen=new Set<string>()
 return value.parties.every(p=>obj(p) &&
  typeof p.userId==='string' && p.userId.length>0 &&
  typeof p.partyName==='string' && p.partyName.length>0 &&
  isScore(p.voteSharePct) && isCount(p.seats,Number(value.seats)) &&
  !seen.has(p.userId) && !!seen.add(p.userId))
}
function poll(value:unknown):value is OpinionPoll {
 if (!obj(value) || !isUtcDay(value.day) || !isTimestamp(value.capturedAt) ||
   new Date(value.capturedAt).toISOString().slice(0,10)!==value.day ||
   !modelVersions.has(String(value.modelVersion)) ||
   (value.householdSampleSize!==null && !isCount(value.householdSampleSize,1000000)) ||
   !Array.isArray(value.parties) || value.parties.length<2 || value.parties.length>10 ||
   !value.parties.every(party) ||
   new Set(value.parties.map((p:ElectionParty)=>p.userId)).size!==value.parties.length ||
   new Set(value.parties.map((p:ElectionParty)=>p.seatNo)).size!==value.parties.length ||
   !Array.isArray(value.districts) || value.districts.length>6 ||
   !value.districts.every(district)) return false
 return new Set(value.districts.map((d:ElectionDistrict)=>d.code)).size===value.districts.length
}
/** Reject untrusted or internally inconsistent historical samples before UI use. */
export function validateOpinionHistory(raw:unknown,matchId:string):OpinionHistory {
 const fail=():never=>{throw new Error('OPINION_HISTORY_INVALID_RESPONSE')}
 if (!obj(raw) || raw.matchId!==matchId ||
   !isUtcDay(raw.serverDay) || !isUtcDay(raw.fromDay) ||
   raw.fromDay>raw.serverDay ||
   !isCount(raw.days,90) || raw.days<7 ||
   daySpan(raw.fromDay,raw.serverDay)>raw.days ||
   !isCount(raw.expectedDays,Number(raw.days)) ||
   raw.expectedDays>daySpan(raw.fromDay,raw.serverDay) ||
   !isCount(raw.recordedDays,Number(raw.expectedDays)) ||
   !Array.isArray(raw.polls) || raw.polls.length!==raw.recordedDays ||
   !raw.polls.every(poll)) return fail()
 let previous=''
 for(const sample of raw.polls as OpinionPoll[]) {
   if (sample.day<=previous || sample.day<(raw.fromDay as string) ||
       sample.day>(raw.serverDay as string)) return fail()
   previous=sample.day
 }
 return raw as unknown as OpinionHistory
}

export async function fetchOpinionHistory(
 matchId:string,days:7|30|90=30
):Promise<OpinionHistory> {
 const {data,error}=await requireClient().rpc('get_match_opinion_history',{
  p_match_id:matchId,p_days:days
 })
 if(error)throw error
 return validateOpinionHistory(data,matchId)
}
export function voteChange(polls:OpinionPoll[],userId:string):number|null {
 if(polls.length<2)return null
 const first=polls[0].parties.find(p=>p.userId===userId)
 const last=polls[polls.length-1].parties.find(p=>p.userId===userId)
 return first&&last?Math.round((last.voteSharePct-first.voteSharePct)*100)/100:null
}
export function pollSegments(polls:OpinionPoll[],userId:string,fromDay:string,serverDay:string):string[] {
 const start=Date.parse(fromDay+'T00:00:00Z'),end=Date.parse(serverDay+'T00:00:00Z')
 const width=Math.max(1,(end-start)/86400000)
 let streak:{day:number,share:number}[]=[]
 const paths:string[]=[]
 function push(){
  if(streak.length>=2)paths.push(streak.map((p,i)=>
   (i===0?'M':'L')+' '+(8+284*(p.day-start)/86400000/width).toFixed(1)+
   ' '+(72-p.share*.62).toFixed(1)).join(' '))
  streak=[]
 }
 for(const item of polls){
  const p=item.parties.find(q=>q.userId===userId)
  const d=Date.parse(item.day+'T00:00:00Z')
  if(!p){push();continue}
  if(streak.length&&d-streak[streak.length-1].day!==86400000)push()
  streak.push({day:d,share:p.voteSharePct})
 }
 push()
 return paths
}
