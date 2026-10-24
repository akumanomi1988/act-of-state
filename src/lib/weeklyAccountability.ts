import {requireClient} from './game'

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
const datePattern=/^\d{4}-\d{2}-\d{2}$/
function record(value:unknown):value is Record<string,unknown>{
  return !!value && typeof value==='object' && !Array.isArray(value)
}
function nonnegative(value:unknown){return Number.isInteger(value)&&Number(value)>=0}
function isDossier(value:unknown):value is WeeklyDossierReport {
  if(!record(value)||typeof value.id!=='string'||typeof value.title!=='string'||
    typeof value.category!=='string'||typeof value.sourceTitle!=='string'||
    typeof value.sourceUrl!=='string'||!/^https:\/\/[^\s]+$/.test(value.sourceUrl)||
    !nonnegative(value.positions)||Number(value.positions)>10)return false
  if(value.decision!==null&&(!record(value.decision)||
    typeof value.decision.optionId!=='string'||
    typeof value.decision.decidedOn!=='string'||
    !Number.isFinite(value.decision.treasuryDelta)))return false
  if(value.bill!==null&&(!record(value.bill)||
    !['open','passed','rejected'].includes(String(value.bill.status))||
    !nonnegative(value.bill.yesVotes)||!nonnegative(value.bill.noVotes)||
    !nonnegative(value.bill.abstentions)))return false
  return true
}
function isWeek(value:unknown):value is WeeklyReport{
  if(!record(value)||typeof value.weekStart!=='string'||
    !datePattern.test(value.weekStart)||typeof value.friday!=='string'||
    !datePattern.test(value.friday)||typeof value.published!=='boolean'||
    !['live','closed','awaiting-settlement'].includes(String(value.status))||
    !Array.isArray(value.dossiers)||value.dossiers.length>10||
    !value.dossiers.every(isDossier)||!Array.isArray(value.parties)||
    value.parties.length>10||!value.parties.every(p=>record(p)&&
      typeof p.partyName==='string'&&nonnegative(p.seatNo)&&Number(p.seatNo)<=10&&
      nonnegative(p.positions)&&nonnegative(p.votes))||
    !Array.isArray(value.elections)||value.elections.length>12)return false
  if(!value.published&&value.dossiers.length!==0)return false
  if(value.fridayAct!==null&&(!record(value.fridayAct)||
    value.fridayAct.week_start!==value.weekStart||
    !nonnegative(value.fridayAct.dossiers_published)||
    !nonnegative(value.fridayAct.decisions_resolved)||
    !Number.isFinite(value.fridayAct.treasury_delta_m_eur)||
    !Number.isFinite(value.fridayAct.treasury_at_friday_m_eur)))return false
  if(value.status==='closed'&&value.fridayAct===null)return false
  return true
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
  if(!record(data)||typeof data.serverDay!=='string'||
    !datePattern.test(data.serverDay)||!Array.isArray(data.weeks)||
    data.weeks.length>weeks||!data.weeks.every(isWeek))
    throw new Error('MATCH_WEEKLY_HISTORY_INVALID')
  return data as unknown as AccountabilityHistory
}
