import {describe,it,expect,vi,beforeEach} from 'vitest'
import {fetchWeeklyAccountability,validateWeeklyAccountability} from './weeklyAccountability'
const mocked=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocked.rpc})}))
const id='80000000-0000-4000-8000-000000000009'
function week() {
 return { weekStart:'2026-10-19',friday:'2026-10-23',status:'closed',
  published:true,
  dossiers:[{
    id:'energy-2026',title:'Electricity independence',category:'Economía',
    sourceTitle:'Verifiable source',sourceUrl:'https://example.com/report',
    positions:3,decision:{optionId:'subsidize',decidedOn:'2026-10-21',
      treasuryDelta:-120,approval:'52',trust:'51'},
    bill:{status:'passed',closesAt:'2026-10-23T18:00:00Z',
      yesVotes:4,noVotes:2,abstentions:1}
  }],
  parties:[{seatNo:1,partyName:'New Government',positions:1,votes:1}],
  fridayAct:{week_start:'2026-10-19',dossiers_published:1,
   decisions_resolved:1,treasury_delta_m_eur:-120,
   treasury_at_friday_m_eur:11880,approval_at_friday:52,trust_at_friday:51},
  elections:[{certifiedOn:'2026-10-23',electionNo:1,winnerParty:'New Government'}]
 }
}
beforeEach(()=>vi.resetAllMocks())
describe('official weekly legislature report client',()=>{
 it('accepts a fully certified multi-system week',async()=>{
  mocked.rpc.mockResolvedValue({data:{serverDay:'2026-10-24',weeks:[week()]},error:null})
  const report=await fetchWeeklyAccountability(id)
  expect(report.weeks[0].fridayAct?.decisions_resolved).toBe(1)
  expect(report.weeks[0].dossiers[0].bill?.yesVotes).toBe(4)
  expect(mocked.rpc).toHaveBeenCalledWith('get_match_weekly_accountability',{
   p_match_id:id,p_weeks:8
  })
 })
 it('fails closed on future/unapproved leaks or malformed bill data',async()=>{
  const entry=week()
  mocked.rpc.mockResolvedValueOnce({data:{serverDay:'2026-10-24',weeks:[
   {...entry,published:false}
  ]},error:null})
  await expect(fetchWeeklyAccountability(id)).rejects.toThrow('MATCH_WEEKLY_HISTORY_INVALID')
  mocked.rpc.mockResolvedValueOnce({data:{serverDay:'2026-10-24',weeks:[
   {...entry,dossiers:[{...entry.dossiers[0],bill:{
    ...entry.dossiers[0].bill,yesVotes:'spoof'
   }}]}
  ]},error:null})
  await expect(fetchWeeklyAccountability(id)).rejects.toThrow('MATCH_WEEKLY_HISTORY_INVALID')
  expect(mocked.rpc).toHaveBeenCalledTimes(2)
 })
 it('rejects forged weeks, impossible clocks, collisions and out-of-range acts',()=>{
  const good={serverDay:'2026-10-24',weeks:[week()]}
  const base=week()
  const incorrect=[
    {...good,serverDay:'2026-02-30'},
    {...good,weeks:[{...base,friday:'2026-10-24'}]},
    {...good,weeks:[{...base,weekStart:'2026-10-20'}]},
    {...good,weeks:[{...base,fridayAct:null}]},
    {...good,weeks:[{...base,parties:[base.parties[0],base.parties[0]]}]},
    {...good,weeks:[{...base,dossiers:[base.dossiers[0],base.dossiers[0]]}]},
    {...good,weeks:[{...base,fridayAct:{...base.fridayAct,trust_at_friday:101}}]},
    {...good,weeks:[{...base,fridayAct:{...base.fridayAct,decisions_resolved:11}}]},
    {...good,weeks:[{...base,dossiers:[{...base.dossiers[0],decision:{
      ...base.dossiers[0].decision,decidedOn:'2026-10-25'}}]}]},
    {...good,weeks:[{...base,dossiers:[{...base.dossiers[0],bill:{
      ...base.dossiers[0].bill,yesVotes:9,noVotes:8}}]}]},
    {...good,weeks:[{...base,elections:[{...base.elections[0],certifiedOn:'2026-11-02'}]}]},
    {...good,weeks:[base,base]}
  ]
  for(const response of incorrect)
    expect(()=>validateWeeklyAccountability(response,8)).toThrow('MATCH_WEEKLY_HISTORY_INVALID')
 })
 it('rejects nonbounded queries before the network and reports authorization errors',async()=>{
  await expect(fetchWeeklyAccountability(id,50)).rejects.toThrow('MATCH_WEEK_RANGE_INVALID')
  expect(mocked.rpc).not.toHaveBeenCalled()
  mocked.rpc.mockResolvedValueOnce({data:null,error:{message:'MATCH_FORBIDDEN'}})
  await expect(fetchWeeklyAccountability(id)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
 })
})
