import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignPanel from './CampaignPanel'
import type { CampaignState } from './lib/campaign'

const mocks = vi.hoisted(() => ({
  fetchCampaignState: vi.fn(), launchPartyCampaign: vi.fn()
}))
vi.mock('./lib/campaign', () => ({
  fetchCampaignState: mocks.fetchCampaignState,
  launchPartyCampaign: mocks.launchPartyCampaign
}))

const matchId='00000000-0000-4000-8000-000000000001'
const userId='00000000-0000-4000-8000-000000000002'
const notify=vi.fn()
const full: CampaignState = {
  serverDay:'2026-10-24',weekStart:'2026-10-19',
  campaignClosesOn:'2027-01-15',available:true,usedThisWeek:false,
  cohorts:[{code:'workers',label:'Trabajadores',weight:60,
    idealPolicy:25,myInfluence:2}],
  recentActs:[]
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchCampaignState.mockResolvedValue(full)
  mocks.launchPartyCampaign.mockResolvedValue({
    id:'event-1',cohort_code:'workers',strategy:'dialogue'
  })
})
afterEach(cleanup)

describe('real campaign action boundary',() => {
  it('shows only authoritative cohort influence and permits weekly targeting',async()=>{
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    expect(await screen.findByRole("option",{name:"Trabajadores"})).toBeTruthy()
    expect(screen.getByText(/Tu influencia:/).textContent).toContain('2/20')
    expect(screen.getByLabelText('Acción política')).toBeTruthy()
  })

  it('submits exactly the selected strategy, confirms readback and locks the week',async()=>{
    mocks.fetchCampaignState.mockResolvedValueOnce(full).mockResolvedValueOnce({
      ...full,available:false,usedThisWeek:true,
      cohorts:[{...full.cohorts[0],myInfluence:5}],
      recentActs:[{id:'event-1',user_id:userId,party_name:'Alliance',
        week_start:full.weekStart,cohort_code:'workers',strategy:'dialogue',
        influence_delta:3,influence_after:5,model_version:'campaign-outreach-v1',
        created_at:'2026-10-24T12:00:00Z'}]
    })
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    await screen.findByRole("option",{name:"Trabajadores"})
    fireEvent.change(screen.getByLabelText('Acción política'),{target:{value:'policy_forum'}})
    fireEvent.click(screen.getByRole('button',{name:'Realizar campaña semanal'}))
    await waitFor(()=>expect(mocks.launchPartyCampaign).toHaveBeenCalledWith(
      matchId,'workers','policy_forum'))
    await screen.findByText(/Tu partido ya ha realizado su campaña/)
    expect(notify).toHaveBeenCalledOnce()
  })

  it('rejects server denial instead of faking an electoral gain',async()=>{
    mocks.launchPartyCampaign.mockRejectedValue(new Error('CAMPAIGN_WEEK_ALREADY_USED'))
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    await screen.findByRole("option",{name:"Trabajadores"})
    fireEvent.click(screen.getByRole('button',{name:'Realizar campaña semanal'}))
    await screen.findByRole('alert')
    expect(notify).not.toHaveBeenCalled()
  })

  it('never offers actions during lobby or electoral freeze',async()=>{
    mocks.fetchCampaignState.mockResolvedValue({...full,available:false,usedThisWeek:false})
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    await screen.findByText(/periodo electoral de reflexión/)
    expect(screen.queryByRole('button',{name:'Realizar campaña semanal'})).toBeNull()
  })
})
