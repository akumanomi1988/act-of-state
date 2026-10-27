import {beforeEach,describe,expect,it,vi} from 'vitest'
import {
 fetchOpinionHistory,pollSegments,validateOpinionHistory,voteChange
} from './opinionPolls'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const mid='40000000-0000-4000-8000-000000000001'
const mine='40000000-0000-4000-8000-000000000002'
const other='40000000-0000-4000-8000-000000000003'
const p=(day:string,share:number)=>({
 day,capturedAt:day+'T01:00:00Z',modelVersion:'electoral-districts-v1',
 householdSampleSize:300,
 parties:[
  {userId:mine,partyName:'Civic',seatNo:1,manifestoPolicy:50,voteSharePct:share,seats:50},
  {userId:other,partyName:'Green',seatNo:2,manifestoPolicy:30,voteSharePct:100-share,seats:50}
 ],districts:[]
})
const history={matchId:mid,serverDay:'2026-10-24',fromDay:'2026-10-18',days:7,
 expectedDays:7,recordedDays:3,polls:[
  p('2026-10-20',52),p('2026-10-21',55),p('2026-10-24',53)
 ]}
beforeEach(()=>mocks.rpc.mockReset())
describe('immutable member-only opinion history',()=>{
 it('accepts bounded chronological server snapshots',async()=>{
  mocks.rpc.mockResolvedValue({data:history,error:null})
  const fetched=await fetchOpinionHistory(mid,7)
  expect(fetched.recordedDays).toBe(3)
  expect(mocks.rpc).toHaveBeenCalledWith('get_match_opinion_history',{
   p_match_id:mid,p_days:7})
  expect(voteChange(fetched.polls,mine)).toBe(1)
  expect(voteChange(fetched.polls,'absent')).toBeNull()
 })
 it('does not interpolate days for which no sample was recorded',()=>{
  const paths=pollSegments(history.polls,mine,history.fromDay,history.serverDay)
  expect(paths).toHaveLength(1)
  expect(paths[0].split('L')).toHaveLength(2)
  expect(pollSegments([history.polls[0]],mine,history.fromDay,history.serverDay)).toEqual([])
 })
 it('rejects mismatched match, invalid daily counts, duplicates and corrupted metrics',()=>{
  for(const bad of [
   {...history,matchId:'other'},
   {...history,recordedDays:2},
   {...history,polls:[history.polls[0],history.polls[0],history.polls[2]]},
   {...history,polls:[p('2026-10-20',200),...history.polls.slice(1)]},
   {...history,days:999},
   {...history,polls:[history.polls[1],history.polls[0],history.polls[2]]}
  ])expect(()=>validateOpinionHistory(bad,mid)).toThrow('OPINION_HISTORY_INVALID_RESPONSE')
 })
 it('rejects impossible calendar days, future samples and invalid windows',()=>{
  for (const bad of [
    {...history,serverDay:'2026-02-30'},
    {...history,fromDay:'2026-10-25'},
    {...history,fromDay:'2026-10-10'},
    {...history,expectedDays:8},
    {...history,expectedDays:2},
    {...history,polls:[p('2026-02-30',52),...history.polls.slice(1)]},
    {...history,polls:[{...history.polls[0],capturedAt:'2026-10-21T01:00:00Z'},...history.polls.slice(1)]},
    {...history,polls:[{...history.polls[0],capturedAt:'not-a-date'},...history.polls.slice(1)]}
  ]) expect(()=>validateOpinionHistory(bad,mid)).toThrow('OPINION_HISTORY_INVALID_RESPONSE')
 })
 it('rejects corrupted party, district and poll metadata without coercion',()=>{
  const first=history.polls[0]
  const corrupt=[
    {...first,modelVersion:'random-v99'},
    {...first,householdSampleSize:-1},
    {...first,parties:[{...first.parties[0],seats:-20},first.parties[1]]},
    {...first,parties:[{...first.parties[0],seatNo:11},first.parties[1]]},
    {...first,parties:[{...first.parties[0],manifestoPolicy:101},first.parties[1]]},
    {...first,parties:[{...first.parties[0],voteSharePct:NaN},first.parties[1]]},
    {...first,parties:[first.parties[0],{...first.parties[1],seatNo:1}]},
    {...first,districts:[{code:'capital',label:'Capital',seats:25,households:50,
      residents:150,parties:[{userId:mine,partyName:'Civic',voteSharePct:51,seats:26}]}]}
  ]
  for(const sample of corrupt)
    expect(()=>validateOpinionHistory({...history,polls:[sample,...history.polls.slice(1)]},mid))
      .toThrow('OPINION_HISTORY_INVALID_RESPONSE')
 })
 it('fails closed for denied RPCs',async()=>{
  mocks.rpc.mockResolvedValue({data:null,error:{message:'MATCH_FORBIDDEN'}})
  await expect(fetchOpinionHistory(mid)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
 })
})
