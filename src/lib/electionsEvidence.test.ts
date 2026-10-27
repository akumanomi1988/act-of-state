import {beforeEach,describe,expect,it,vi} from 'vitest'
import {certifyMatchElection,fetchElectionState,validateElectionState} from './elections'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const match='40000000-0000-4000-8000-000000000001'
const a='40000000-0000-4000-8000-000000000002',b='40000000-0000-4000-8000-000000000003'
const parties=[
 {userId:a,seatNo:1,partyName:'Civic',manifestoPolicy:50,voteSharePct:54,seats:54},
 {userId:b,seatNo:2,partyName:'Reform',manifestoPolicy:20,voteSharePct:46,seats:46}
]
const cohorts=[{code:'workers',weight:100,idealPolicy:40,support:53,trust:49}]
const districts=[
 ['capital',25,14],['industrial',20,11],['coastal',18,10],
 ['agrarian',15,8],['highland',12,6],['frontier',10,5]
].map(([code,seats,mine])=>({
 code,label:String(code),seats,households:50,residents:150,
 parties:[{userId:a,partyName:'Civic',voteSharePct:54,seats:mine},
 {userId:b,partyName:'Reform',voteSharePct:46,seats:Number(seats)-Number(mine)}]
}))
const projection={modelVersion:'electoral-districts-v2',householdSampleSize:300,parties,cohorts,districts}
const election={
 id:'e1',match_id:match,election_no:1,scheduled_on:'2026-10-20',
 certified_on:'2026-10-20',incumbent_user_id:a,winner_user_id:a,
 model_version:'electoral-districts-v2',districts_snapshot:districts,
 population_snapshot:cohorts,parties_snapshot:parties,created_at:'2026-10-20T12:00:00Z'
}
const valid={projection,nextDueOn:'2027-01-18',campaignClosesOn:'2027-01-11',
 canCertify:false,serverDay:'2026-10-24',history:[election]}
beforeEach(()=>mocks.rpc.mockReset())
describe('electoral authority and historical certificate boundary',()=>{
 it('accepts six districts with 100 independently apportioned seats and immutable acts',async()=>{
  mocks.rpc.mockResolvedValue({data:valid,error:null})
  const state=await fetchElectionState(match)
  expect(state.history[0].winner_user_id).toBe(a)
  expect(state.projection.parties.reduce((n,p)=>n+p.seats,0)).toBe(100)
 })
 it('rejects inconsistent totals, invalid dates and corrupted certificate histories',()=>{
  const broken=[
   {...valid,serverDay:'2026-02-30'}, {...valid,nextDueOn:'2027-01-55'},
   {...valid,campaignClosesOn:'2027-01-12'}, {...valid,canCertify:true},
   {...valid,projection:{...projection,parties:[{...parties[0],seats:55},parties[1]]}},
   {...valid,projection:{...projection,parties:[parties[0],{...parties[1],seatNo:1}]}},
   {...valid,projection:{...projection,districts:[...districts.slice(0,5)]}},
   {...valid,projection:{...projection,districts:[{...districts[0],seats:24},...districts.slice(1)]}},
   {...valid,projection:{...projection,districts:[{...districts[0],parties:[
      {...districts[0].parties[0],seats:25},districts[0].parties[1]]},...districts.slice(1)]}},
   {...valid,history:[{...election,match_id:'wrong'}]},
   {...valid,history:[{...election,winner_user_id:'not-in-certificate'}]},
   {...valid,history:[{...election,certified_on:'2026-02-30'}]},
   {...valid,history:[{...election,created_at:'not-a-timestamp'}]},
   {...valid,history:[election,election]}
  ]
  for(const response of broken)
    expect(()=>validateElectionState(response,match)).toThrow('ELECTION_INVALID_RESPONSE')
 })
 it('allows older cohort-version certificates without modern district snapshots',()=>{
  const old={...election,model_version:'electoral-cohorts-v1',
    parties_snapshot:parties,population_snapshot:cohorts,districts_snapshot:[]}
  expect(validateElectionState({...valid,history:[old]},match).history).toHaveLength(1)
 })
 it('rejects wrong-match certification and malformed successful RPCs',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:{...election,match_id:'other'},error:null})
  await expect(certifyMatchElection(match)).rejects.toThrow('ELECTION_INVALID_RESPONSE')
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'MATCH_FORBIDDEN'}})
  await expect(fetchElectionState(match)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
 })
})
