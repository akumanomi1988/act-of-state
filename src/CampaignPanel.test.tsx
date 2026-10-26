import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CampaignPanel from './CampaignPanel'
import type { CampaignState } from './lib/campaign'
import type { PartyFinanceState } from './lib/partyFinances'

const mocks = vi.hoisted(() => ({
  fetchCampaignState: vi.fn(), launchPartyCampaign: vi.fn(), fetchPartyFinances: vi.fn()
}))
vi.mock('./lib/campaign', () => ({
  fetchCampaignState: mocks.fetchCampaignState,
  launchPartyCampaign: mocks.launchPartyCampaign
}))

vi.mock('./lib/partyFinances',()=>({fetchPartyFinances:mocks.fetchPartyFinances}))

const matchId='00000000-0000-4000-8000-000000000001'
const userId='00000000-0000-4000-8000-000000000002'
const notify=vi.fn()
const full: CampaignState = {
  serverDay:'2026-10-24',weekStart:'2026-10-19',
  campaignClosesOn:'2027-01-15',available:true,usedThisWeek:false,
  influenceModel:'campaign-decay-v2',
  cohorts:[{code:'workers',label:'Trabajadores',weight:60,
    idealPolicy:25,myInfluence:2,nextDecayOn:'2026-10-31'}],
  recentActs:[]
}
const finances: PartyFinanceState = {
  matchId,serverDay:'2026-10-24',weekStart:'2026-10-19',
  financeModel:'equal-public-weekly-v1',active:true,
  earnedCredits:12,spentCredits:0,availableCredits:12,
  costs:{dialogue:4,field_visit:7,policy_forum:10},recentSpending:[]
}
const spent: PartyFinanceState = {
  ...finances,spentCredits:10,availableCredits:2,
  recentSpending:[{id:'receipt-1',weekStart:'2026-10-19',strategy:'policy_forum',
    cohortCode:'workers',costCredits:10,campaignEventId:'event-1'}]
}
beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchCampaignState.mockResolvedValue(full)
  mocks.fetchPartyFinances.mockResolvedValue(finances)
  mocks.launchPartyCampaign.mockResolvedValue({
    id:'event-1',cohort_code:'workers',strategy:'dialogue'
  })
})
afterEach(cleanup)

describe('real campaign action boundary',() => {
  it('shows only authoritative cohort influence and permits weekly targeting',async()=>{
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    expect(await screen.findByRole("option",{name:"Trabajadores"})).toBeTruthy()
    expect(screen.getByText(/Influencia efectiva actual:/).textContent).toContain('2/20')
    expect(screen.getByLabelText('Acción política')).toBeTruthy()
    expect(screen.getByText('Próximo desgaste: 2026-10-31 (UTC)')).toBeInTheDocument()
    expect(screen.getByText(/La influencia que cuenta para encuestas y urnas/)).toBeInTheDocument()
  })

  it('submits exactly the selected strategy, confirms readback and locks the week',async()=>{
    mocks.fetchPartyFinances.mockResolvedValueOnce(finances).mockResolvedValueOnce(spent)
    mocks.fetchCampaignState.mockResolvedValueOnce(full).mockResolvedValueOnce({
      ...full,available:false,usedThisWeek:true,
      cohorts:[{...full.cohorts[0],myInfluence:5}],
      recentActs:[{id:'event-1',user_id:userId,party_name:'Alliance',
        week_start:full.weekStart,cohort_code:'workers',strategy:'policy_forum',
        influence_delta:3,influence_after:5,model_version:'campaign-decay-v2',
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

  it('displays public funding and blocks unaffordable actions before mutation',async()=>{
    mocks.fetchPartyFinances.mockResolvedValue({...finances,availableCredits:5,
      spentCredits:7})
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    await screen.findByText(/Financiación pública ficticia/)
    fireEvent.change(screen.getByLabelText('Acción política'),{target:{value:'policy_forum'}})
    expect(screen.getByRole('button',{name:'Realizar campaña semanal'})).toBeDisabled()
    expect(screen.getByText(/Créditos insuficientes/)).toBeInTheDocument()
    expect(mocks.launchPartyCampaign).not.toHaveBeenCalled()
    fireEvent.change(screen.getByLabelText('Acción política'),{target:{value:'dialogue'}})
    expect(screen.getByRole('button',{name:'Realizar campaña semanal'})).toBeEnabled()
  })

  it('does not confirm a campaign without an authoritative expense receipt',async()=>{
    mocks.fetchCampaignState.mockResolvedValueOnce(full).mockResolvedValueOnce({
      ...full,available:false,usedThisWeek:true,
      recentActs:[{id:'event-1',user_id:userId,party_name:'Alliance',
        week_start:full.weekStart,cohort_code:'workers',strategy:'dialogue',
        influence_delta:3,influence_after:3,model_version:'campaign-decay-v2',
        created_at:'2026-10-24T12:00:00Z'}]
    })
    render(<CampaignPanel matchId={matchId} userId={userId} active onCampaignRecorded={notify}/>)
    await screen.findByRole('option',{name:'Trabajadores'})
    fireEvent.click(screen.getByRole('button',{name:'Realizar campaña semanal'}))
    await screen.findByText(/todavía no está confirmada en los registros/)
    expect(notify).not.toHaveBeenCalled()
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
