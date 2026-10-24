import {requireClient} from './game'
import type {ElectionDistrict,ElectionParty} from './elections'

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
function day(value:unknown):value is string {
 return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&
  !Number.isNaN(Date.parse(value+'T00:00:00Z'))
}
function party(value:unknown):value is ElectionParty {
 return obj(value)&&typeof value.userId==='string'&&
  typeof value.partyName==='string'&&Number.isInteger(value.seatNo)&&
  Number.isInteger(value.seats)&&Number.isInteger(value.manifestoPolicy)&&
  typeof value.voteSharePct==='number'&&Number.isFinite(value.voteSharePct)&&
  value.voteSharePct>=0&&value.voteSharePct<=100
}
function district(value:unknown):value is ElectionDistrict {
 return obj(value)&&typeof value.code==='string'&&typeof value.label==='string'&&
  Number.isInteger(value.seats)&&Number.isInteger(value.households)&&
  Number.isInteger(value.residents)&&Array.isArray(value.parties)&&
  value.parties.every(p=>obj(p)&&typeof p.userId==='string'&&
   typeof p.partyName==='string'&&typeof p.voteSharePct==='number'&&
   Number.isFinite(p.voteSharePct)&&p.voteSharePct>=0&&p.voteSharePct<=100&&
   Number.isInteger(p.seats))
}
function poll(value:unknown):value is OpinionPoll {
 return obj(value)&&day(value.day)&&typeof value.capturedAt==='string'&&
  typeof value.modelVersion==='string'&&
  (value.householdSampleSize===null||Number.isInteger(value.householdSampleSize))&&
  Array.isArray(value.parties)&&value.parties.length>=2&&value.parties.length<=10&&
  value.parties.every(party)&&
  new Set(value.parties.map((p:ElectionParty)=>p.userId)).size===value.parties.length&&
  Array.isArray(value.districts)&&value.districts.length<=6&&
  value.districts.every(district)
}
export function validateOpinionHistory(raw:unknown,matchId:string):OpinionHistory {
 if(!obj(raw)||raw.matchId!==matchId||!day(raw.serverDay)||!day(raw.fromDay)||
  !Number.isInteger(raw.days)||Number(raw.days)<7||Number(raw.days)>90||
  !Number.isInteger(raw.expectedDays)||Number(raw.expectedDays)<0||
  !Number.isInteger(raw.recordedDays)||!Array.isArray(raw.polls)||
  raw.polls.length>90||raw.recordedDays!==raw.polls.length||
  Number(raw.recordedDays)>Number(raw.expectedDays)||!raw.polls.every(poll))
   throw new Error('OPINION_HISTORY_INVALID_RESPONSE')
 const dates=(raw.polls as OpinionPoll[]).map(x=>x.day)
 if(dates.some((d,i)=>d<(raw.fromDay as string)||d>(raw.serverDay as string)||
  (i>0&&d<=dates[i-1])))throw new Error('OPINION_HISTORY_INVALID_RESPONSE')
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
