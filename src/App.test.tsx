import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DecisionEvent, GovernmentWorld } from './lib/types'
import App from './App'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
  startGovernment: vi.fn(),
  fetchWorld: vi.fn(),
  submitDecision: vi.fn()
}))

vi.mock('./lib/game', () => ({
  client: { auth: {
    getUser: mocks.getUser,
    onAuthStateChange: mocks.onAuthStateChange,
    signInWithOtp: mocks.signInWithOtp,
    signOut: mocks.signOut
  } },
  startGovernment: mocks.startGovernment,
  fetchWorld: mocks.fetchWorld,
  submitDecision: mocks.submitDecision,
  friendlyError: (error: unknown) => error instanceof Error ? error.message : String(error)
}))

let emitAuthChange: ((user: { id: string } | null) => void) | null = null

const government = {
  id: '00000000-0000-4000-8000-000000000001',
  owner_id: '00000000-0000-4000-8000-000000000002',
  country_name: 'República de Arcadia',
  treasury_m_eur: 12000,
  approval: 50, trust: 50,
  created_at: '2026-10-23T00:00:00Z',
  updated_at: '2026-10-23T00:00:00Z'
}
const event: DecisionEvent = {
  id: '00000000-0000-4000-8000-000000000003',
  government_id: government.id, dossier_id: 'energy-resilience',
  dossier_version: 1, option_id: 'household-support',
  dossier_title_snapshot: 'Plan de resiliencia energética',
  option_title_snapshot: 'Proteger a los hogares',
  engine_version: 'weighted-cohorts-v1',
  decided_on: '2026-10-23', created_at: '2026-10-23T00:00:00Z',
  parameters_snapshot: { treasury_delta_m_eur: -1400, policy_target: 25, response_intensity: 35, trust_base_delta: 2 },
  state_before: { treasury_m_eur: 12000, approval: 50, trust: 50 },
  state_after: { treasury_m_eur: 10600, approval: 62, trust: 58 },
  cohort_effects: [{ code: 'households', label: 'Hogares y trabajadores', population_weight: 65,
    support_before: 50, support_after: 68, trust_before: 50, trust_after: 61 }]
}
const initial: GovernmentWorld = {
  government, gameDay: '2026-10-23',
  dossiers: [{ id: 'energy-resilience', version: 1, title: 'Plan de resiliencia energética',
    context: 'Escenario ficticio de energía', category: 'Economía', release_kind: 'intro',
    available_from: null, available_until: null }],
  options: [{ dossier_id: 'energy-resilience', dossier_version: 1, id: 'household-support',
    title: 'Proteger a los hogares', description: 'Transferencias focalizadas',
    treasury_delta_m_eur: -1400, policy_target: 25, response_intensity: 35, trust_base_delta: 2 }],
  cohorts: [{ id: 'c1', government_id: government.id, code: 'households',
    label: 'Hogares y trabajadores', population_weight: 65, ideal_policy: 25, support: 50, trust: 50 }],
  events: []
}
const decided: GovernmentWorld = {
  ...initial,
  government: { ...government, ...event.state_after },
  events: [event],
  cohorts: initial.cohorts.map(cohort => ({ ...cohort, support: 68, trust: 61 }))
}

afterEach(() => cleanup())

beforeEach(() => {
  vi.resetAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user: { id: government.owner_id } }, error: null })
  emitAuthChange = null
  mocks.onAuthStateChange.mockImplementation((callback: (event: string, session: { user: { id: string } } | null) => void) => {
    emitAuthChange = user => callback('SIGNED_IN', user ? { user } : null)
    return { data: { subscription: { unsubscribe: vi.fn() } } }
  })
  mocks.startGovernment.mockResolvedValue(government)
  mocks.submitDecision.mockResolvedValue(event)
})

function reviewAndSign() {
  fireEvent.click(screen.getByRole('button', { name: 'Revisar decisión' }))
  fireEvent.click(screen.getByRole('button', { name: 'Firmar y ejecutar decisión' }))
}

describe('browser decision flow with controlled Supabase adapter', () => {
  it('requires review before signature and displays only authored fiscal inputs', async () => {
    mocks.fetchWorld.mockResolvedValue(initial)
    render(<App />)
    const review = await screen.findByRole('button', { name: 'Revisar decisión' })
    expect(review).toBeDisabled()
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    expect(review).toBeEnabled()
    fireEvent.click(review)
    const summary = screen.getByTestId('decision-review')
    expect(summary).toHaveTextContent('Proteger a los hogares')
    expect(summary).toHaveTextContent('-1.400 M€')
    expect(summary).toHaveTextContent('12.000 M€')
    expect(summary).toHaveTextContent('Parámetro editorial')
    expect(mocks.submitDecision).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a elegir' }))
    expect(screen.queryByTestId('decision-review')).not.toBeInTheDocument()
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('invalidates the signature review when the selected option changes', async () => {
    const alternative = {
      ...initial.options[0], id: 'infrastructure', title: 'Invertir en infraestructuras',
      description: 'Red eléctrica', treasury_delta_m_eur: -2400
    }
    mocks.fetchWorld.mockResolvedValue({ ...initial, options: [...initial.options, alternative] })
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar decisión' }))
    expect(screen.getByTestId('decision-review')).toHaveTextContent('-1.400 M€')
    fireEvent.click(screen.getByLabelText(/Invertir en infraestructuras/))
    expect(screen.queryByTestId('decision-review')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Revisar decisión' }))
    expect(screen.getByTestId('decision-review')).toHaveTextContent('-2.400 M€')
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('selects a choice, calls the backend, and displays reloaded persisted impact', async () => {
    mocks.fetchWorld.mockResolvedValueOnce(initial).mockResolvedValueOnce(decided)
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    await waitFor(() => expect(mocks.submitDecision)
      .toHaveBeenCalledWith(government.id, 'energy-resilience', 1, 'household-support'))
    const outcome = await screen.findByTestId('persisted-outcome')
    expect(outcome).toHaveTextContent('10.600 M€')
    expect(outcome).toHaveTextContent('62%')
    expect(mocks.fetchWorld).toHaveBeenCalledTimes(2)
  })

  it('recovers a committed decision after the RPC response is lost', async () => {
    mocks.fetchWorld.mockResolvedValueOnce(initial).mockResolvedValueOnce(decided)
    mocks.submitDecision.mockRejectedValue(new Error('Network request failed'))
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    const outcome = await screen.findByTestId('persisted-outcome')
    expect(outcome).toHaveTextContent('10.600 M€')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
  })

  it('blocks another signature until an uncertain read-after-write is reconciled', async () => {
    mocks.fetchWorld.mockResolvedValueOnce(initial)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(decided)
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    const retry = await screen.findByRole('button', { name: 'Reintentar sincronización' })
    expect(screen.getByRole('button', { name: 'Firmar y ejecutar decisión' })).toBeDisabled()
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
    fireEvent.click(retry)
    const outcome = await screen.findByTestId('persisted-outcome')
    expect(outcome).toHaveTextContent('10.600 M€')
    expect(screen.queryByRole('button', { name: 'Reintentar sincronización' })).not.toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
  })

  it('preserves a rejected decision error when no event was committed', async () => {
    mocks.fetchWorld.mockResolvedValue(initial)
    mocks.submitDecision.mockRejectedValue(new Error('INVALID_OPTION'))
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    expect(await screen.findByRole('alert')).toHaveTextContent('INVALID_OPTION')
    expect(await screen.findByRole('button', { name: 'Reintentar sincronización' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Firmar y ejecutar decisión' })).toBeDisabled()
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
  })

  it('requires a fresh snapshot after an ambiguous RPC failure with no visible event', async () => {
    mocks.fetchWorld.mockResolvedValue(initial)
    mocks.submitDecision.mockRejectedValue(new Error('Network request failed'))
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    const retry = await screen.findByRole('button', { name: 'Reintentar sincronización' })
    expect(screen.getByRole('button', { name: 'Firmar y ejecutar decisión' })).toBeDisabled()
    fireEvent.click(retry)
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Reintentar sincronización' }))
      .not.toBeInTheDocument())
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    expect(screen.getByRole('button', { name: 'Revisar decisión' })).toBeEnabled()
    expect(screen.queryByRole('button', { name: 'Firmar y ejecutar decisión' })).not.toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
  })

  it('recovers the previous decision on a fresh session without resubmitting', async () => {
    mocks.fetchWorld.mockResolvedValue(decided)
    render(<App />)
    const outcome = await screen.findByTestId('persisted-outcome')
    expect(outcome).toHaveTextContent('10.600 M€')
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('preserves readable decision history after the editorial dossier expires', async () => {
    mocks.fetchWorld.mockResolvedValue({
      ...decided,
      dossiers: [],
      options: []
    })
    render(<App />)
    await screen.findByText('No hay expedientes disponibles.')
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Proteger a los hogares/ }))
    const outcome = await screen.findByTestId('persisted-outcome')
    expect(outcome).toHaveTextContent('10.600 M€')
    expect(outcome).toHaveTextContent('62%')
    expect(outcome).toHaveTextContent('Hogares y trabajadores')
    expect(screen.getByText(/Plan de resiliencia energética · 2026-10-23/))
      .toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Volver a la agenda' }))
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('surfaces an authorization error without displaying another government', async () => {
    mocks.startGovernment.mockRejectedValue(new Error('GOVERNMENT_NOT_FOUND_OR_FORBIDDEN'))
    render(<App />)
    expect(await screen.findByRole('alert')).toHaveTextContent('GOVERNMENT_NOT_FOUND_OR_FORBIDDEN')
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
  })
  it('hides the previous account world after an account switch and retries a failed bootstrap', async () => {
    const otherId = '00000000-0000-4000-8000-000000000099'
    const otherGovernment = {
      ...government,
      id: '00000000-0000-4000-8000-000000000098',
      owner_id: otherId,
      country_name: 'República de Borealia'
    }
    const otherWorld: GovernmentWorld = {
      ...initial, government: otherGovernment, dossiers: [], options: [], cohorts: [], events: []
    }
    mocks.startGovernment.mockResolvedValueOnce(government)
      .mockRejectedValueOnce(new Error('Network unavailable'))
      .mockResolvedValueOnce(otherGovernment)
    mocks.fetchWorld.mockResolvedValueOnce(initial).mockResolvedValueOnce(otherWorld)
    render(<App />)
    await screen.findByRole('button', { name: /Plan de resiliencia energética/ })

    await act(async () => { emitAuthChange?.({ id: otherId }) })
    const retry = await screen.findByRole('button', { name: 'Reintentar acceso al gobierno' })
    expect(screen.queryByRole('button', { name: /Plan de resiliencia energética/ })).not.toBeInTheDocument()
    expect(screen.queryByText('12.000 M€')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Firmar y ejecutar decisión' })).not.toBeInTheDocument()
    fireEvent.click(retry)
    await screen.findByText('República de Borealia')
    expect(mocks.startGovernment).toHaveBeenCalledTimes(3)
  })

  it('ignores an old account decision readback after another account signs in', async () => {
    const otherId = '00000000-0000-4000-8000-000000000099'
    const otherGovernment = {
      ...government,
      id: '00000000-0000-4000-8000-000000000098',
      owner_id: otherId,
      country_name: 'República de Borealia'
    }
    const otherWorld: GovernmentWorld = {
      ...initial, government: otherGovernment, dossiers: [], options: [], cohorts: [], events: []
    }
    let resolveOldSnapshot!: (snapshot: GovernmentWorld) => void
    const oldSnapshot = new Promise<GovernmentWorld>(resolve => { resolveOldSnapshot = resolve })
    mocks.startGovernment.mockResolvedValueOnce(government).mockResolvedValueOnce(otherGovernment)
    mocks.fetchWorld.mockResolvedValueOnce(initial)
      .mockReturnValueOnce(oldSnapshot)
      .mockResolvedValueOnce(otherWorld)
    render(<App />)
    await screen.findByRole('button', { name: 'Revisar decisión' })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    await waitFor(() => expect(mocks.fetchWorld).toHaveBeenCalledTimes(2))

    await act(async () => { emitAuthChange?.({ id: otherId }) })
    await screen.findByText('República de Borealia')
    await act(async () => { resolveOldSnapshot(decided) })
    expect(screen.getByText('República de Borealia')).toBeInTheDocument()
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Plan de resiliencia energética/ })).not.toBeInTheDocument()
  })

})
