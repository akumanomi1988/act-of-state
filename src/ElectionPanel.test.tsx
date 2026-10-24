import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElectionPanel from './ElectionPanel'
import type { ElectionState } from './lib/elections'

const mocks = vi.hoisted(() => ({
  fetchElectionState: vi.fn(), setPartyManifesto: vi.fn(), certifyMatchElection: vi.fn()
}))
vi.mock('./OpinionHistoryPanel', () => ({ default: () => <div>Historical polling panel fixture</div> }))
vi.mock('./lib/elections', () => ({
  fetchElectionState: mocks.fetchElectionState,
  setPartyManifesto: mocks.setPartyManifesto,
  certifyMatchElection: mocks.certifyMatchElection
}))
const matchId = '00000000-0000-4000-8000-000000000001'
const userId = '00000000-0000-4000-8000-000000000002'
const otherId = '00000000-0000-4000-8000-000000000003'
const projection = {
  modelVersion: 'electoral-cohorts-v1' as const,
  parties: [
    { userId, seatNo: 1, partyName: 'Civic Alliance', manifestoPolicy: 50,
      voteSharePct: 55, seats: 55 },
    { userId: otherId, seatNo: 2, partyName: 'Social Reform', manifestoPolicy: 25,
      voteSharePct: 45, seats: 45 }
  ],
  cohorts: [{ code: 'households', weight: 100, idealPolicy: 25, support: 50, trust: 50 }]
}
function state(canCertify = false): ElectionState {
  return {
    projection, nextDueOn: '2027-01-21', campaignClosesOn: '2027-01-14',
    canCertify, serverDay: canCertify ? '2027-01-21' : '2026-10-23', history: []
  }
}
const districts = [
  {code:'capital',label:'Distrito Capital',seats:25,households:75,residents:225,
    parties:[
      {userId,partyName:'Civic Alliance',voteSharePct:55,seats:14},
      {userId:otherId,partyName:'Social Reform',voteSharePct:45,seats:11}]},
  {code:'industrial',label:'Corredor Industrial',seats:20,households:60,residents:180,
    parties:[
      {userId,partyName:'Civic Alliance',voteSharePct:55,seats:11},
      {userId:otherId,partyName:'Social Reform',voteSharePct:45,seats:9}]},
  {code:'coastal',label:'Región Costera',seats:18,households:54,residents:162,
    parties:[
      {userId,partyName:'Civic Alliance',voteSharePct:55,seats:10},
      {userId:otherId,partyName:'Social Reform',voteSharePct:45,seats:8}]},
  {code:'agrarian',label:'Llanuras Agrarias',seats:15,households:45,residents:135,
    parties:[
      {userId,partyName:'Civic Alliance',voteSharePct:55,seats:8},
      {userId:otherId,partyName:'Social Reform',voteSharePct:45,seats:7}]},
  {code:'highland',label:'Territorios de Montaña',seats:12,households:36,residents:108,
    parties:[
      {userId,partyName:'Civic Alliance',voteSharePct:55,seats:7},
      {userId:otherId,partyName:'Social Reform',voteSharePct:45,seats:5}]},
  {code:'frontier',label:'Frontera Interior',seats:10,households:30,residents:90,
    parties:[
      {userId,partyName:'Civic Alliance',voteSharePct:55,seats:5},
      {userId:otherId,partyName:'Social Reform',voteSharePct:45,seats:5}]}
]
const onElectionCertified = vi.fn()

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchElectionState.mockResolvedValue(state())
  mocks.setPartyManifesto.mockResolvedValue(undefined)
  mocks.certifyMatchElection.mockResolvedValue({
    id: 'e1', winner_user_id: userId
  })
})
afterEach(cleanup)

describe('national election experience', () => {
  it('shows six territorial constituencies and the 100-seat allocation',async()=>{
    mocks.fetchElectionState.mockResolvedValue({
      ...state(),projection:{...projection,modelVersion:'electoral-districts-v1',
        districts,householdSampleSize:300}
    })
    render(<ElectionPanel matchId={matchId} userId={userId}
      active={true} onElectionCertified={onElectionCertified}/>)
    await screen.findByText(/Proyección si se votase hoy/)
    fireEvent.click(screen.getByText(/Explorar el escrutinio de seis circunscripciones/))
    expect(screen.getByRole('heading',{name:'Distrito Capital'})).toBeInTheDocument()
    expect(screen.getByRole('heading',{name:'Frontera Interior'})).toBeInTheDocument()
    expect(screen.getByText(/75 hogares · 225 integrantes/)).toBeInTheDocument()
  })


  it('shows deterministic vote projection and 100-seat distribution', async () => {
    render(<ElectionPanel matchId={matchId} userId={userId}
      active={true} onElectionCertified={onElectionCertified} />)
    await screen.findByText(/Proyección si se votase hoy/)
    expect(screen.getByText(/55.00% · 55 escaños/)).toBeInTheDocument()
    expect(screen.getByText(/45.00% · 45 escaños/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Celebrar elecciones' })).not.toBeInTheDocument()
  })

  it('saves the declared manifesto then reloads authoritative projections', async () => {
    render(<ElectionPanel matchId={matchId} userId={userId}
      active={true} onElectionCertified={onElectionCertified} />)
    const slider = await screen.findByRole('slider', { name: 'Posicionamiento electoral' })
    fireEvent.change(slider, { target: { value: '70' } })
    fireEvent.click(screen.getByRole('button', { name: 'Publicar programa' }))
    await waitFor(() => expect(mocks.setPartyManifesto).toHaveBeenCalledWith(matchId, 70))
    await waitFor(() => expect(mocks.fetchElectionState).toHaveBeenCalledTimes(2))
  })

  it('certifies elections only at maturity and refreshes the national government', async () => {
    mocks.fetchElectionState.mockResolvedValue(state(true))
    render(<ElectionPanel matchId={matchId} userId={userId}
      active={true} onElectionCertified={onElectionCertified} />)
    const button = await screen.findByRole('button', { name: 'Celebrar elecciones' })
    fireEvent.click(button)
    await waitFor(() => expect(mocks.certifyMatchElection).toHaveBeenCalledWith(matchId))
    await waitFor(() => expect(onElectionCertified).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('slider', { name: 'Posicionamiento electoral' })).toBeDisabled()
  })
})
