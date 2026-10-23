import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ParliamentPanel from './ParliamentPanel'
import type { ParliamentState } from './lib/parliament'

const mocks = vi.hoisted(() => ({
  fetchParliamentState: vi.fn(), proposeParliamentBill: vi.fn(),
  castParliamentVote: vi.fn(), finalizeParliamentBill: vi.fn()
}))
vi.mock('./lib/parliament', () => ({
  fetchParliamentState: mocks.fetchParliamentState,
  proposeParliamentBill: mocks.proposeParliamentBill,
  castParliamentVote: mocks.castParliamentVote,
  finalizeParliamentBill: mocks.finalizeParliamentBill
}))

const host = '00000000-0000-4000-8000-000000000001'
const guest = '00000000-0000-4000-8000-000000000002'
const matchId = '00000000-0000-4000-8000-000000000003'
const billId = '00000000-0000-4000-8000-000000000004'
const options = [{
  dossier_id: 'energy-resilience', dossier_version: 1, id: 'household-support',
  title: 'Protect households', description: 'Transfers',
  treasury_delta_m_eur: -1400, policy_target: 25,
  response_intensity: 35, trust_base_delta: 2
}]
const players = [host, guest].map((user_id, i) => ({
  match_id: matchId, user_id, seat_no: i + 1, party_name: 'Party ' + (i + 1),
  manifesto_policy: 50, mandate_seats: 10,
  joined_at: '2026-10-23T00:00:00Z'
}))
const bill = {
  id: billId, match_id: matchId, dossier_id: 'energy-resilience',
  dossier_version: 1, option_id: 'household-support', proposed_by: host,
  status: 'open' as const, rule_version: 'parliament-majority-v1' as const,
  created_at: '2026-10-23T00:00:00Z', closes_at: '2026-10-24T00:00:00Z',
  closed_at: null
}
function state(status?: 'open' | 'passed' | 'rejected'): ParliamentState {
  return { bills: status ? [{ ...bill, status }] : [],
    votes: [], serverNow: '2026-10-23T12:00:00Z' }
}
const onMandateChange = vi.fn()
const base = {
  matchId, dossierId: 'energy-resilience', dossierVersion: 1,
  options, selectedOptionId: 'household-support', userId: host,
  players, host: true, decided: false, onMandateChange
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchParliamentState.mockResolvedValue(state())
  mocks.proposeParliamentBill.mockResolvedValue(bill)
  mocks.castParliamentVote.mockResolvedValue(bill)
  mocks.finalizeParliamentBill.mockResolvedValue(bill)
})
afterEach(cleanup)

describe('binding parliamentary workflow', () => {
  it('lets the host table a bill and reconcile the authoritative response', async () => {
    render(<ParliamentPanel {...base} />)
    const propose = await screen.findByRole('button', {
      name: 'Someter la opción seleccionada a votación'
    })
    fireEvent.click(propose)
    await waitFor(() => expect(mocks.proposeParliamentBill).toHaveBeenCalledWith(
      matchId, 'energy-resilience', 1, 'household-support'))
    expect(onMandateChange).toHaveBeenCalledWith(null)
  })

  it('lets an opposition member cast an immutable vote', async () => {
    mocks.fetchParliamentState.mockResolvedValue(state('open'))
    render(<ParliamentPanel {...base} host={false} userId={guest} />)
    const yes = await screen.findByRole('button', { name: 'A favor' })
    fireEvent.click(yes)
    await waitFor(() => expect(mocks.castParliamentVote).toHaveBeenCalledWith(
      billId, 'yes'))
  })

  it('exposes only a persisted passed bill as an executable mandate', async () => {
    mocks.fetchParliamentState.mockResolvedValue(state('passed'))
    render(<ParliamentPanel {...base} />)
    await screen.findByText(/Mandato aprobado:/)
    expect(onMandateChange).toHaveBeenCalledWith('household-support')
    expect(screen.queryByRole('button', {
      name: 'Someter la opción seleccionada a votación'
    })).not.toBeInTheDocument()
  })
})
