import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchDiplomacy, parseDiplomacyState } from './diplomacy'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const governmentId='55000000-0000-4000-8000-000000000011'
const baseline={
  governmentId,modelVersion:'diplomacy-v1',
  blocs:[
    {id:'europe',label:'Europa',relation:64,tradeIndex:102,signedEffects:1},
    {id:'asia',label:'Asia',relation:47,tradeIndex:99,signedEffects:1},
    {id:'usa',label:'Estados Unidos',relation:52,tradeIndex:100,signedEffects:1}
  ],
  recentEffects:[{eventId:'signature',bloc:'europe',dossierId:'diplomacy-europe',
    optionId:'europe-social-treaty',title:'Pacto político con Europa',
    choice:'Tratado de movilidad social',relationDelta:14,tradeDelta:2,
    signedAt:'2026-10-26T09:00:00Z'}]
}
beforeEach(()=>mocks.rpc.mockReset())
describe('signed geopolitical diplomacy contract',()=>{
  it('reads the authenticated authoritative state',async()=>{
    mocks.rpc.mockResolvedValue({data:baseline,error:null})
    await expect(fetchDiplomacy(governmentId)).resolves.toEqual(baseline)
    expect(mocks.rpc).toHaveBeenCalledWith('get_diplomacy_state',{p_government_id:governmentId})
  })
  it('rejects forged ordering, values, model and identity',()=>{
    const bad=[
      {...baseline,governmentId:'wrong'},
      {...baseline,modelVersion:'diplomacy-unknown'},
      {...baseline,blocs:baseline.blocs.slice(1)},
      {...baseline,blocs:[...baseline.blocs].reverse()},
      {...baseline,blocs:[{...baseline.blocs[0],relation:999},...baseline.blocs.slice(1)]},
      {...baseline,recentEffects:[{...baseline.recentEffects[0],tradeDelta:50}]},
      {...baseline,recentEffects:[{...baseline.recentEffects[0],signedAt:'garbage'}]}
    ]
    bad.forEach(value=>expect(()=>parseDiplomacyState(value,governmentId))
      .toThrow('DIPLOMACY_INVALID_RESPONSE'))
  })
  it('propagates forbidden cross-government reads',async()=>{
    mocks.rpc.mockResolvedValue({data:null,error:new Error('DIPLOMACY_FORBIDDEN')})
    await expect(fetchDiplomacy(governmentId)).rejects.toThrow('DIPLOMACY_FORBIDDEN')
  })
})

