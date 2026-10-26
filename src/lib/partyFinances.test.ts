import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPartyFinances, parsePartyFinanceState } from './partyFinances'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const matchId='00000000-0000-4000-8000-000000000123'
const state={
  matchId,serverDay:'2026-10-26',weekStart:'2026-10-26',
  financeModel:'equal-public-weekly-v1',active:true,
  earnedCredits:12,spentCredits:10,availableCredits:2,
  costs:{dialogue:4,field_visit:7,policy_forum:10},
  recentSpending:[{id:'receipt-1',campaignEventId:'event-1',weekStart:'2026-10-26',
    strategy:'policy_forum',costCredits:10,cohortCode:'workers'}]
}
beforeEach(()=>mocks.rpc.mockReset())
describe('server-authored fictional party budget',()=>{
  it('loads a party finance snapshot scoped to its match',async()=>{
    mocks.rpc.mockResolvedValue({data:state,error:null})
    await expect(fetchPartyFinances(matchId)).resolves.toMatchObject({availableCredits:2})
    expect(mocks.rpc).toHaveBeenCalledWith('get_party_finances',{p_match_id:matchId})
  })
  it('rejects tampered balance, costs, match, receipts or version',()=>{
    const invalid=[
      {...state,matchId:'other'},
      {...state,financeModel:'v0'},
      {...state,availableCredits:120},
      {...state,availableCredits:-1},
      {...state,costs:{...state.costs,policy_forum:1}},
      {...state,recentSpending:[{...state.recentSpending[0],costCredits:0}]},
      {...state,recentSpending:[{...state.recentSpending[0],strategy:'gift'}]},
      {...state,earnedCredits:NaN},
      {...state,recentSpending:null}
    ]
    for(const value of invalid) expect(()=>parsePartyFinanceState(value,matchId)).toThrow(
      'PARTY_FINANCE_INVALID_RESPONSE')
  })
  it('propagates authenticated RPC permission errors',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:new Error('MATCH_FORBIDDEN')})
    await expect(fetchPartyFinances(matchId)).rejects.toThrow('MATCH_FORBIDDEN')
  })
})

