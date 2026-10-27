import {beforeEach,describe,expect,it,vi} from 'vitest'
import {fetchFiscalState,validateFiscalState,type FiscalState} from './fiscal'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const governmentId='61000000-0000-4000-8000-000000000001'
const act={
 government_id:governmentId,week_start:'2026-10-19',
 settled_at:'2026-10-24T00:01:00+00:00',engine_version:'national-fiscal-v1' as const,
 policy_snapshot:{tax_rate:25},revenue_m_eur:2375,spending_m_eur:2420,
 balance_m_eur:-45,debt_issued_m_eur:0,debt_repaid_m_eur:0,
 treasury_after_m_eur:11955,debt_after_m_eur:0,gdp_index_after:100,
 unemployment_bp_after:700,inflation_bp_after:250
}
const data: FiscalState={
 governmentId,serverDay:'2026-10-24',currentWeek:'2026-10-19',
 canEdit:true,canRevise:false,projectedRevenueM:2375,projectedSpendingM:2420,
 policy:{government_id:governmentId,health:35,education:25,infrastructure:25,
   security:15,tax_rate:25,revised_this_week:true,revision_week:'2026-10-19',
   updated_at:'2026-10-24T08:00:00+00:00'},
 indicators:{treasuryM:11955,debtM:0,gdpIndex:100,unemploymentBp:700,
   inflationBp:250,approval:50,trust:50},history:[act]
}
beforeEach(()=>mocks.rpc.mockReset())
describe('server-owned fiscal evidence boundary',()=>{
 it('accepts correctly scoped, ordered server fiscal acts',async()=>{
  mocks.rpc.mockResolvedValue({data,error:null})
  expect((await fetchFiscalState(governmentId)).history).toHaveLength(1)
  expect(mocks.rpc).toHaveBeenCalledWith('get_fiscal_state',{p_government_id:governmentId})
 })
 it('rejects invalid dates, forged scope, unsafe policy and impossible balances',()=>{
  const malformed:unknown[]=[
   {...data,governmentId:'foreign'}, {...data,serverDay:'2026-02-30'},
   {...data,currentWeek:'2026-10-20'}, {...data,currentWeek:'2026-10-26'},
   {...data,policy:{...data.policy,government_id:'foreign'}},
   {...data,policy:{...data.policy,health:75}}, 
   {...data,policy:{...data.policy,updated_at:'invalid'}},
   {...data,indicators:{...data.indicators,trust:105}},
   {...data,history:[{...act,government_id:'foreign'}]},
   {...data,history:[{...act,week_start:'2026-10-21'}]},
   {...data,history:[{...act,week_start:'2026-11-02'}]},
   {...data,history:[{...act,engine_version:'unreviewed-v2'}]},
   {...data,history:[{...act,balance_m_eur:200}]},
   {...data,history:[{...act,debt_issued_m_eur:-1}]},
   {...data,history:[act,act]},
   {...data,history:[{...act,settled_at:'not-an-instant'}]}
  ]
  for(const candidate of malformed)
   expect(()=>validateFiscalState(candidate,governmentId)).toThrow('FISCAL_INVALID_RESPONSE')
 })
 it('passes through actual RPC denial, and rejects malformed successful responses',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'FISCAL_FORBIDDEN'}})
  await expect(fetchFiscalState(governmentId)).rejects.toEqual({message:'FISCAL_FORBIDDEN'})
  mocks.rpc.mockResolvedValueOnce({data:{...data,history:[{...act,government_id:'foreign'}]},error:null})
  await expect(fetchFiscalState(governmentId)).rejects.toThrow('FISCAL_INVALID_RESPONSE')
 })
})
