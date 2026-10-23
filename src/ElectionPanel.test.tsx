import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ElectionPanel from './ElectionPanel'
import type { ElectionState } from './lib/elections'

const mocks = vi.hoisted(() => ({
  fetchElectionState: vi.fn(), setPartyManifesto: vi.fn(), certifyMatchElection: vi.fn()
}))
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
