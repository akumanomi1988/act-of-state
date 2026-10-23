import { cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MatchCalendarPanel from './MatchCalendarPanel'
import type { MatchCalendar } from './lib/multiplayer'

const mocks = vi.hoisted(() => ({ fetchMatchCalendar: vi.fn() }))
vi.mock('./lib/multiplayer', () => ({
  fetchMatchCalendar: mocks.fetchMatchCalendar,
  matchError: (error: unknown) => error instanceof Error ? error.message : String(error)
}))

const matchId = '00000000-0000-4000-8000-000000000010'
const calendar: MatchCalendar = {
  gameDay: '2026-10-23', monday: '2026-10-19', friday: '2026-10-23',
  fridayReached: true, weeklyPublished: true, weeklyTotal: 10, weeklyResolved: 7,
  latestFriday: {
    match_id: matchId, week_start: '2026-10-12', closed_at: '2026-10-17T00:05:00Z',
    dossiers_published: 10, decisions_resolved: 8,
    treasury_delta_m_eur: -600, treasury_at_friday_m_eur: 11400,
    approval_at_friday: 54, trust_at_friday: 52, engine_version: 'friday-ledger-v1'
  }
}

beforeEach(() => {
  vi.resetAllMocks()
  mocks.fetchMatchCalendar.mockResolvedValue(calendar)
})
afterEach(cleanup)

describe('shared political calendar', () => {
  it('shows the Monday agenda and immutable Friday settlement', async () => {
    render(<MatchCalendarPanel matchId={matchId} />)
    expect(await screen.findByText(/7 de 10 expedientes resueltos/)).toBeInTheDocument()
    expect(screen.getByText(/ÚLTIMO VIERNES CERRADO/)).toBeInTheDocument()
    expect(screen.getByText(/8 decisiones/)).toBeInTheDocument()
    expect(screen.getByText(/cierre definitivo se registra el sábado/)).toBeInTheDocument()
    expect(mocks.fetchMatchCalendar).toHaveBeenCalledWith(matchId)
  })

  it('does not present unpublished dossiers as available', async () => {
    mocks.fetchMatchCalendar.mockResolvedValue({
      ...calendar, weeklyPublished: false, weeklyTotal: 0, weeklyResolved: 0,
      latestFriday: null
    })
    render(<MatchCalendarPanel matchId={matchId} />)
    expect(await screen.findByText(/aún no está aprobada/)).toBeInTheDocument()
    expect(screen.queryByText(/ÚLTIMO VIERNES CERRADO/)).not.toBeInTheDocument()
  })

  it('surfaces calendar errors without inventing a valid state', async () => {
    mocks.fetchMatchCalendar.mockRejectedValue(new Error('NETWORK_UNAVAILABLE'))
    render(<MatchCalendarPanel matchId={matchId} />)
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('NETWORK_UNAVAILABLE'))
  })
})
