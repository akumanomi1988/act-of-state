import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fetchMatchWorld,fetchMatchCalendar,validateMatchWorld,validateMatchCalendar} from './multiplayer'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const mid='70000000-0000-4000-8000-000000000001'
const gid='70000000-0000-4000-8000-000000000002'
const u1='70000000-0000-4000-8000-000000000003'
const u2='70000000-0000-4000-8000-000000000004'
const party=(user_id:string,seat_no:number)=>({
 match_id:mid,user_id,seat_no,party_name:'Party '+seat_no,
 manifesto_policy:50,mandate_seats:seat_no===1?55:45,
 is_ready:true,joined_at:'2026-10-20T09:00:00Z'
})
const p1=party(u1,1),p2=party(u2,2)
const government={
 id:gid,owner_id:u1,country_name:'Arcadia',treasury_m_eur:10000,
 approval:55,trust:50,created_at:'2026-10-20T08:00:00Z',
 updated_at:'2026-10-24T10:00:00Z'
}
const dossier={id:'founding-energy',version:1,title:'Energy policy',
 context:'A government must prioritize energy and trade',
 category:'Economy',release_kind:'intro',
 available_from:null,available_until:null}
const option={dossier_id:'founding-energy',dossier_version:1,id:'fund',
 title:'Fund renewables',description:'Commit to new infrastructure',
 treasury_delta_m_eur:-100,policy_target:45,response_intensity:35,trust_base_delta:1}
const world={
 match:{id:mid,title:'National parliament',status:'active',
   host_user_id:u1,government_id:gid,invite_code:'abcdefabcdefabcdefabcdefabcdefab',
   created_at:'2026-10-20T09:00:00Z',started_at:'2026-10-20T10:00:00Z',
   max_players:10,is_public:false,readiness_required:true},
 me:p1,gameDay:'2026-10-24',players:[p1,p2],government,
 cohorts:[{id:'c1',government_id:gid,code:'households',label:'Households',
   population_weight:100,ideal_policy:50,support:50,trust:50}],
 dossiers:[dossier],options:[option],
 events:[{id:'e1',government_id:gid,dossier_id:'archived-old-policy'}],
 stances:[{match_id:mid,user_id:u2,dossier_id:'archived-old-policy',
   option_id:'approved',dossier_version:1,policy_affinity:55}]
}
const calendar={
 gameDay:'2026-10-24',monday:'2026-10-19',friday:'2026-10-23',
 fridayReached:true,weeklyPublished:true,weeklyTotal:4,weeklyResolved:2,
 latestFriday:{match_id:mid,week_start:'2026-10-12',
   closed_at:'2026-10-18T02:15:00Z',dossiers_published:4,
   decisions_resolved:2,treasury_delta_m_eur:-250,
   treasury_at_friday_m_eur:9750,approval_at_friday:55,trust_at_friday:50,
   engine_version:'friday-ledger-v1'}
}
beforeEach(()=>mocks.rpc.mockReset())
describe('one authoritative multiplayer identity/snapshot boundary',()=>{
 it('accepts a real scoped match with archived stances from previous weeks',async()=>{
   mocks.rpc.mockResolvedValue({data:world,error:null})
   expect((await fetchMatchWorld(mid)).players).toHaveLength(2)
 })
 it('rejects another government, participant, seat, dossier or record scope',()=>{
   const broken=[
     {...world,match:{...world.match,id:'other'}},
     {...world,match:{...world.match,government_id:'foreign'}},
     {...world,match:{...world.match,host_user_id:'foreign'}},
     {...world,me:{...p1,user_id:'foreign'}},
     {...world,players:[p1,{...p2,user_id:u1}]},
     {...world,players:[p1,{...p2,seat_no:1}]},
     {...world,players:[p1,{...p2,match_id:'foreign'}]},
     {...world,cohorts:[{...world.cohorts[0],government_id:'foreign'}]},
     {...world,events:[{...world.events[0],government_id:'foreign'}]},
     {...world,stances:[{...world.stances[0],user_id:'foreign'}]},
     {...world,options:[{...option,dossier_id:'unrelated'}]},
     {...world,dossiers:[dossier,dossier]},
     {...world,gameDay:'2026-02-30'}
   ]
   for(const invalid of broken)
     expect(()=>validateMatchWorld(invalid,mid)).toThrow('MATCH_INVALID_RESPONSE')
 })
 it('fails closed when the RPC is denied or returns a foreign world',async()=>{
   mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'MATCH_FORBIDDEN'}})
   await expect(fetchMatchWorld(mid)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
   mocks.rpc.mockResolvedValueOnce({data:{...world,me:{...p1,user_id:'foreign'}},error:null})
   await expect(fetchMatchWorld(mid)).rejects.toThrow('MATCH_INVALID_RESPONSE')
 })
 it('accepts server UTC calendar plus immutable Friday closure',async()=>{
   mocks.rpc.mockResolvedValueOnce({data:calendar,error:null})
   expect((await fetchMatchCalendar(mid)).latestFriday?.decisions_resolved).toBe(2)
 })
 it('rejects forged or contradictory Friday certificates',()=>{
   const incorrect=[
    {...calendar,friday:'2026-10-24'},
    {...calendar,monday:'2026-10-20'},
    {...calendar,gameDay:'2026-02-30'},
    {...calendar,weeklyResolved:5},
    {...calendar,weeklyPublished:false},
    {...calendar,fridayReached:false},
    {...calendar,latestFriday:{...calendar.latestFriday,match_id:'foreign'}},
    {...calendar,latestFriday:{...calendar.latestFriday,week_start:'2026-10-13'}},
    {...calendar,latestFriday:{...calendar.latestFriday,approval_at_friday:200}},
    {...calendar,latestFriday:{...calendar.latestFriday,closed_at:'not-a-timestamp'}}
   ]
   for(const invalid of incorrect)
     expect(()=>validateMatchCalendar(invalid,mid)).toThrow('CALENDAR_INVALID_RESPONSE')
 })
})
