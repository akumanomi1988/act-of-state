import { describe, expect, it } from 'vitest'
import type { MatchWorld, MatchCalendar } from './multiplayer'
import type { ParliamentBill, ParliamentVote, ParliamentState } from './parliament'
import type { DecisionEvent, Dossier } from './types'
import { buildWeeklyMission } from './weeklyCommand'

const host='00000000-0000-4000-8000-000000000001'
const guest='00000000-0000-4000-8000-000000000002'
const monday='2026-10-26'
function dossier(i:number):Dossier {
  return {id:'weekly-'+i,version:1,title:'Expediente '+i,context:'Fictitious test scenario',
    category:'Instituciones',release_kind:'weekly',available_from:monday,
    available_until:'2026-10-30'}
}
const calendar:MatchCalendar = {gameDay:'2026-10-27',monday,friday:'2026-10-30',
  fridayReached:false,weeklyPublished:true,weeklyTotal:10,weeklyResolved:0,
  latestFriday:null}
const parliament:ParliamentState={serverNow:'2026-10-27T12:00:00Z',bills:[],votes:[]}
function bill(id:string, status:'open'|'passed'|'rejected'='open'):ParliamentBill {
  return {id:'bill-'+id,match_id:'m',dossier_id:id,dossier_version:1,
    option_id:'act',proposed_by:host,status,rule_version:'parliament-mandates-v2',
    created_at:'2026-10-26T12:00:00Z',closes_at:'2026-10-30T12:00:00Z',
    closed_at:status==='open'?null:'2026-10-27T12:00:00Z'}
}
function vote(bill_id:string,user_id=guest):ParliamentVote {
  return {bill_id,match_id:'m',user_id,choice:'yes',seat_weight:10,
    created_at:'2026-10-27T12:00:00Z'}
}
const decision = (id:string):DecisionEvent=>({
  id:'event-'+id,government_id:'g',dossier_id:id,dossier_version:1,option_id:'act',
  dossier_title_snapshot:id,option_title_snapshot:'Act',
  engine_version:'weighted-cohorts-v1',decided_on:'2026-10-27',
  created_at:'2026-10-27T12:00:00Z',cohort_effects:[],
  parameters_snapshot:{treasury_delta_m_eur:-100,policy_target:50,
    response_intensity:30,trust_base_delta:2},
  state_before:{treasury_m_eur:12000,approval:50,trust:50},
  state_after:{treasury_m_eur:11900,approval:52,trust:52}
})
function world():MatchWorld{
  return {match:{id:'m',title:'Legislatura',status:'active',host_user_id:host,
    government_id:'g',invite_code:'a'.repeat(32),created_at:'2026-10-26',
    started_at:'2026-10-26',is_public:false,readiness_required:false,max_players:10},
    me:{match_id:'m',user_id:host,seat_no:1,party_name:'Gobierno',
      manifesto_policy:50,mandate_seats:55,joined_at:'2026-10-26',is_ready:true},
    gameDay:'2026-10-27',players:[],government:{id:'g',owner_id:host,
      country_name:'Arcadia',treasury_m_eur:12000,approval:50,trust:50,
      created_at:'2026-10-26',updated_at:'2026-10-26'},
    cohorts:[],dossiers:Array.from({length:10},(_,i)=>dossier(i+1)),
    options:[],stances:[],events:[]}
}

describe('weekly political mission from authoritative records',()=>{
  it('tracks ten editorial items without treating publication as a policy act',()=>{
    const report=buildWeeklyMission(world(),parliament,calendar,host)
    expect(report).toMatchObject({available:10,expected:10,signed:0,
      stances:0,votes:0,pending:10,isCabinet:true,overdue:false})
    expect(report.rows).toHaveLength(10)
    expect(report.next?.action).toBe('stance')
  })
  it('separates individual stance from recorded roll-call vote and official signature',()=>{
    const w=world()
    w.stances=[{match_id:'m',user_id:guest,dossier_id:'weekly-1',dossier_version:1,
      option_id:'act',policy_affinity:50,engine_version:'policy-affinity-v1',
      created_at:'2026-10-27'}]
    const state={...parliament,bills:[bill('weekly-1')],votes:[vote('bill-weekly-1',guest)]}
    const a=buildWeeklyMission(w,state,calendar,guest)
    expect(a.rows.find(x=>x.dossier.id==='weekly-1')).toMatchObject({
      action:'awaiting-votes',hasStance:true,hasVote:true,signed:false})
    expect(a.signed).toBe(0)
    expect(a.votes).toBe(1)
  })
  it('prioritizes government signature over open votes then proposed policies',()=>{
    const w=world()
    w.stances=[{match_id:'m',user_id:host,dossier_id:'weekly-3',dossier_version:1,
      option_id:'act',policy_affinity:50,engine_version:'policy-affinity-v1',
      created_at:'2026-10-27'}]
    const state={...parliament,bills:[bill('weekly-2'),bill('weekly-1','passed')]}
    const report=buildWeeklyMission(w,state,calendar,host)
    expect(report.next?.dossier.id).toBe('weekly-1')
    expect(report.rows.slice(0,3).map(x=>x.action)).toEqual(['sign','vote','propose'])
  })
  it('opposition never receives a cabinet signature even if legislation passes',()=>{
    const p={...parliament,bills:[bill('weekly-1','passed')]}
    const report=buildWeeklyMission(world(),p,calendar,guest)
    expect(report.rows.find(x=>x.dossier.id==='weekly-1')?.action)
      .toBe('awaiting-signature')
    expect(report.rows.every(x=>x.action!=='sign'&&x.action!=='propose')).toBe(true)
  })
  it('does not count a passed law as signed before an immutable event exists',()=>{
    const w=world();const p={...parliament,bills:[bill('weekly-1','passed')]}
    expect(buildWeeklyMission(w,p,calendar,host).signed).toBe(0)
    w.events=[decision('weekly-1')]
    const result=buildWeeklyMission(w,p,calendar,host)
    expect(result.signed).toBe(1)
    expect(result.rows.find(x=>x.dossier.id==='weekly-1')?.action).toBe('signed')
  })
  it('does not leak next-week or fiction dossiers into this published slate',()=>{
    const w=world()
    w.dossiers.push({...dossier(11),available_from:'2026-11-02'})
    w.dossiers.push({...dossier(12),release_kind:'intro',available_from:null,
      available_until:null})
    const result=buildWeeklyMission(w,parliament,calendar,host)
    expect(result.available).toBe(10)
    expect(result.rows.every(x=>x.dossier.available_from===monday)).toBe(true)
  })
  it('blocks actions after Friday, including when a historical bill remains open',()=>{
    const late={...calendar,gameDay:'2026-11-01',fridayReached:true}
    const result=buildWeeklyMission(world(),
      {...parliament,bills:[bill('weekly-1')]},late,host)
    expect(result.next).toBeNull()
    expect(result.pending).toBe(0)
    expect(result.rows.every(x=>x.action==='expired')).toBe(true)
    expect(result.overdue).toBe(true)
  })
  it('never interprets ten invented fictional dossiers as editorial publication',()=>{
    const w=world()
    w.dossiers=w.dossiers.map(d=>({...d,release_kind:'intro',
      available_from:null,available_until:null}))
    const missing={...calendar,weeklyPublished:false,weeklyTotal:0}
    const result=buildWeeklyMission(w,parliament,missing,host)
    expect(result).toMatchObject({published:false,expected:0,available:0,pending:0})
    expect(result.next).toBeNull()
  })
})
