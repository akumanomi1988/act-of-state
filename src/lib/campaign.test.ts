import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchCampaignState, launchPartyCampaign } from './campaign'

const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const matchId='90000000-0000-4000-8000-000000000048'
const baseline={
  serverDay:'2026-10-25',weekStart:'2026-10-19',
  campaignClosesOn:'2027-01-07',available:true,usedThisWeek:false,
  influenceModel:'campaign-decay-v2',
  cohorts:[{code:'workers',label:'Trabajadores',weight:60,idealPolicy:30,
    myInfluence:7,nextDecayOn:'2026-10-31'},
    {code:'rural',label:'Rural',weight:40,idealPolicy:65,
      myInfluence:0,nextDecayOn:null}],
  recentActs:[]
}
beforeEach(()=>mocks.rpc.mockReset())
describe('server-authored electoral persuasion contract',()=>{
  it('accepts current model support and effective UTC expiry dates only',async()=>{
    mocks.rpc.mockResolvedValue({data:baseline,error:null})
    const result=await fetchCampaignState(matchId)
    expect(result.influenceModel).toBe('campaign-decay-v2')
    expect(result.cohorts).toHaveLength(2)
    expect(result.cohorts[0]).toMatchObject({myInfluence:7,nextDecayOn:'2026-10-31'})
    expect(mocks.rpc).toHaveBeenCalledWith('get_campaign_state',{p_match_id:matchId})
  })
  it('fails closed if a proxy supplies missing, negative or unversioned campaign effects',async()=>{
    for(const value of [
      {...baseline,influenceModel:'campaign-outreach-v1'},
      {...baseline,cohorts:null},
      {...baseline,cohorts:[{...baseline.cohorts[0],myInfluence:21}]},
      {...baseline,cohorts:[{...baseline.cohorts[0],myInfluence:-1}]},
      {...baseline,cohorts:[{...baseline.cohorts[0],nextDecayOn:'tomorrow'}]},
      {...baseline,cohorts:[{code:'workers',myInfluence:3}]}
    ]){
      mocks.rpc.mockResolvedValueOnce({data:value,error:null})
      await expect(fetchCampaignState(matchId)).rejects.toThrow('CAMPAIGN_INVALID_RESPONSE')
    }
  })
  it('allows only bounded campaign choices and sends no client-computed influence',async()=>{
    await expect(launchPartyCampaign(matchId,'rural','cheat' as never))
      .rejects.toThrow('CAMPAIGN_INVALID_INPUT')
    expect(mocks.rpc).not.toHaveBeenCalled()
    mocks.rpc.mockResolvedValueOnce({data:{
      id:'event',cohort_code:'rural',strategy:'policy_forum',
      model_version:'campaign-decay-v2',influence_after:5,influence_delta:5
    },error:null})
    const result=await launchPartyCampaign(matchId,'rural','policy_forum')
    expect(result.model_version).toBe('campaign-decay-v2')
    expect(mocks.rpc).toHaveBeenCalledWith('launch_campaign',{
      p_match_id:matchId,p_cohort:'rural',p_strategy:'policy_forum'
    })
  })
  it('propagates server access denials without fabricating political gains',async()=>{
    mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'MATCH_FORBIDDEN'}})
    await expect(fetchCampaignState(matchId)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
  })
})
