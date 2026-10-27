import {requireClient} from './game'
import {isCount,isScore,isTimestamp,isUtcDay,daySpan} from './serverEvidence'

export interface WeeklyDossierReport {
  id:string
  title:string
  category:string
  sourceTitle:string
  sourceUrl:string
  positions:number
  decision:null|{
    optionId:string
    decidedOn:string
    treasuryDelta:number
    approval:string
    trust:string
  }
  bill:null|{
    status:'open'|'passed'|'rejected'
    closesAt:string
    yesVotes:number
    noVotes:number
    abstentions:number
  }
}
export interface WeeklyPartyReport {
  seatNo:number
  partyName:string
  positions:number
  votes:number
}
export interface FridayAct {
  week_start:string
  dossiers_published:number
  decisions_resolved:number
  treasury_delta_m_eur:number
  treasury_at_friday_m_eur:number
  approval_at_friday:number
  trust_at_friday:number
}
export interface WeeklyReport {
  weekStart:string
  friday:string
  status:'live'|'closed'|'awaiting-settlement'
  published:boolean
  dossiers:WeeklyDossierReport[]
  parties:WeeklyPartyReport[]
  fridayAct:FridayAct|null
  elections:{certifiedOn:string,electionNo:number,winnerParty:string}[]
}
export interface AccountabilityHistory {
  serverDay:string
  weeks:WeeklyReport[]
}
function record(value:unknown):value is Record<string,unknown>{
 return value!==null&&typeof value==='object'&&!Array.isArray(value)
}
const str=(x:unknown)=>typeof x==='string'&&x.trim().length>0
function isDossier(value:unknown,weekStart:string,friday:string):value is WeeklyDossierReport {
 if(!record(value)||!str(value.id)||!str(value.title)||
    !str(value.category)||!str(value.sourceTitle)||
    typeof value.sourceUrl!=='string'||!/^https:\/\/[^\s]+$/.test(value.sourceUrl)||
    !isCount(value.positions,10))return false
 if(value.decision!==null){
   if(!record(value.decision)||!str(value.decision.optionId)||
     !isUtcDay(value.decision.decidedOn)||
     value.decision.decidedOn<weekStart||value.decision.decidedOn>friday||
     typeof value.decision.treasuryDelta!=='number'||
     !Number.isFinite(value.decision.treasuryDelta)||
     !isScore(Number(value.decision.approval))||
     !isScore(Number(value.decision.trust)))return false
 }
 if(value.bill!==null){
   if(!record(value.bill)||!['open','passed','rejected'].includes(String(value.bill.status))||
     !isTimestamp(value.bill.closesAt)||!isCount(value.bill.yesVotes,10)||
     !isCount(value.bill.noVotes,10)||!isCount(value.bill.abstentions,10)||
     Number(value.bill.yesVotes)+Number(value.bill.noVotes)+Number(value.bill.abstentions)>10)return false
 }
 return true
}
function isWeek(value:unknown,serverDay:string):value is WeeklyReport{
 if(!record(value)||!isUtcDay(value.weekStart)||!isUtcDay(value.friday)||
   new Date(value.weekStart+'T00:00:00Z').getUTCDay()!==1||
   daySpan(value.weekStart,value.friday)!==5||
   value.weekStart>serverDay||typeof value.published!=='boolean'||
   !['live','closed','awaiting-settlement'].includes(String(value.status))||
   !Array.isArray(value.dossiers)||value.dossiers.length>10||
   !Array.isArray(value.parties)||value.parties.length>10||
   !Array.isArray(value.elections)||value.elections.length>12)return false
 if(value.status==='closed'&&value.fridayAct===null)return false
 if(value.status!=='closed'&&value.fridayAct!==null)return false
 if(!value.published&&value.dossiers.length!==0)return false
 if(!value.dossiers.every(d=>isDossier(d,String(value.weekStart),String(value.friday)))||
   new Set((value.dossiers as WeeklyDossierReport[]).map(d=>d.id)).size!==value.dossiers.length)return false
 if(!value.parties.every(p=>record(p)&&str(p.partyName)&&
   isCount(p.seatNo,10)&&p.seatNo>0&&isCount(p.positions,10)&&isCount(p.votes,10))||
   new Set((value.parties as WeeklyPartyReport[]).map(p=>p.seatNo)).size!==value.parties.length)return false
 if(value.fridayAct!==null){
   const a=value.fridayAct
   if(!record(a)||a.week_start!==value.weekStart||
     !isCount(a.dossiers_published,10)||!isCount(a.decisions_resolved,10)||
     a.decisions_resolved>a.dossiers_published||
     typeof a.treasury_delta_m_eur!=='number'||!Number.isFinite(a.treasury_delta_m_eur)||
     typeof a.treasury_at_friday_m_eur!=='number'||!Number.isFinite(a.treasury_at_friday_m_eur)||
     a.treasury_at_friday_m_eur<0||!isScore(a.approval_at_friday)||
     !isScore(a.trust_at_friday))return false
 }
 const weekStart=value.weekStart as string
 return value.elections.every(e=>record(e)&&
   isUtcDay(e.certifiedOn)&&e.certifiedOn>=weekStart&&
   e.certifiedOn<=serverDay&&daySpan(weekStart,e.certifiedOn)<=7&&
   isCount(e.electionNo,1000000)&&e.electionNo>0&&str(e.winnerParty))
}
export function validateWeeklyAccountability(
 raw:unknown,weeks:number
):AccountabilityHistory{
 const fail=():never=>{throw new Error('MATCH_WEEKLY_HISTORY_INVALID')}
 if(!record(raw)||!isUtcDay(raw.serverDay)||!Array.isArray(raw.weeks)||
   raw.weeks.length>weeks)return fail()
 let previous=''
 for(const week of raw.weeks){
   if(!isWeek(week,raw.serverDay)||
     (previous!=='' && (week.weekStart>=previous ||
       daySpan(week.weekStart,previous)<8)))return fail()
   previous=week.weekStart
 }
 return raw as unknown as AccountabilityHistory
}

export async function fetchWeeklyAccountability(
  matchId:string,weeks=8
):Promise<AccountabilityHistory>{
  if(!Number.isInteger(weeks)||weeks<1||weeks>12)
    throw new Error('MATCH_WEEK_RANGE_INVALID')
  const {data,error}=await requireClient().rpc('get_match_weekly_accountability',{
    p_match_id:matchId,p_weeks:weeks
  })
  if(error)throw error
  return validateWeeklyAccountability(data,weeks)
}
