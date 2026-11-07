import { within, act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

vi.mock('./PopulationPanel', () => ({ default: () => null }))
vi.mock('./LivingConditionsPanel', () => ({ default: () => null }))

vi.mock('./FiscalPanel', () => ({ default: () => <div>National fiscal panel fixture</div> }))

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
  calendar: { weekStart: '2026-10-19', friday: '2026-10-23', dayOfWeek: 5,
    fridayReached: true, weeklyTotal: 0, weeklyResolved: 0, weeklyTreasuryDeltaM: 0 },
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
  it('starts directly with decisions and keeps agenda and country one tap away',async()=>{
    mocks.fetchWorld.mockResolvedValue(initial)
    render(<App/>)
    await screen.findByRole('heading',{name:'Plan de resiliencia energética'})
    const nav=screen.getByRole('navigation',{name:'Navegación del gobierno'})
    expect(nav.getAttribute('class')).toContain('mobile-focus-nav')
    expect(nav.querySelector('[aria-current="page"]')).toHaveTextContent('Decidir')
    const root=nav.closest('.solo-workspace')
    expect(root).toHaveAttribute('data-mobile-screen','decide')
    fireEvent.click(screen.getByRole('button',{name:'Expedientes'}))
    expect(root).toHaveAttribute('data-mobile-screen','agenda')
    fireEvent.click(screen.getByRole('button',{name:'Mi país'}))
    expect(root).toHaveAttribute('data-mobile-screen','status')
    const insightNav=screen.getByRole('navigation',{name:'Apartados de Mi país'})
    expect(insightNav).toHaveTextContent('Resumen')
    fireEvent.click(within(insightNav).getByRole('button',{name:'Población'}))
    expect(root).toHaveAttribute('data-mobile-detail','people')
    fireEvent.click(within(insightNav).getByRole('button',{name:'Economía'}))
    expect(root).toHaveAttribute('data-mobile-detail','economy')
    fireEvent.click(within(insightNav).getByRole('button',{name:'Historial'}))
    expect(root).toHaveAttribute('data-mobile-detail','history')
    fireEvent.click(within(insightNav).getByRole('button',{name:'Resumen'}))
    expect(root).toHaveAttribute('data-mobile-detail','overview')
    fireEvent.click(screen.getByRole('button',{name:'Decidir'}))
    expect(root).toHaveAttribute('data-mobile-screen','decide')
  })

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

  it('plays two distinct dossiers consecutively and reloads cumulative persisted history', async () => {
    const waterDossier: GovernmentWorld['dossiers'][number] = {
      id: 'water-security', version: 1, title: 'Plan de seguridad hídrica',
      context: 'Escenario ficticio de sequía', category: 'Territorio y recursos',
      release_kind: 'intro', available_from: null, available_until: null
    }
    const waterOption: GovernmentWorld['options'][number] = {
      dossier_id: 'water-security', dossier_version: 1, id: 'industrial-reuse',
      title: 'Modernizar el uso industrial del agua', description: 'Recirculación industrial',
      treasury_delta_m_eur: -950, policy_target: 75, response_intensity: 30, trust_base_delta: 0
    }
    const waterEvent: DecisionEvent = {
      ...event, id: '00000000-0000-4000-8000-000000000004',
      dossier_id: 'water-security', option_id: 'industrial-reuse',
      dossier_title_snapshot: waterDossier.title, option_title_snapshot: waterOption.title,
      parameters_snapshot: { treasury_delta_m_eur: -950, policy_target: 75, response_intensity: 30, trust_base_delta: 0 },
      state_before: event.state_after, state_after: { treasury_m_eur: 9650, approval: 67, trust: 61 },
      cohort_effects: [
        { code: 'households', label: 'Hogares y trabajadores', population_weight: 65,
          support_before: 68, support_after: 68, trust_before: 61, trust_after: 61 },
        { code: 'industry', label: 'Industria y emprendedores', population_weight: 35,
          support_before: 50, support_after: 65, trust_before: 52, trust_after: 60 }
      ]
    }
    const industry = { id: 'c2', government_id: government.id, code: 'industry',
      label: 'Industria y emprendedores', population_weight: 35, ideal_policy: 75,
      support: 50, trust: 50 }
    const before: GovernmentWorld = {
      ...initial, dossiers: [...initial.dossiers, waterDossier],
      options: [...initial.options, waterOption], cohorts: [...initial.cohorts, industry]
    }
    const afterEnergy: GovernmentWorld = {
      ...before, government: { ...government, ...event.state_after },
      events: [event],
      cohorts: [
        { ...before.cohorts[0], support: 68, trust: 61 },
        { ...industry, trust: 52 }
      ]
    }
    const afterWater: GovernmentWorld = {
      ...afterEnergy, government: { ...government, ...waterEvent.state_after },
      events: [event, waterEvent],
      cohorts: [
        { ...before.cohorts[0], support: 68, trust: 61 },
        { ...industry, support: 65, trust: 60 }
      ]
    }
    mocks.fetchWorld.mockResolvedValueOnce(before)
      .mockResolvedValueOnce(afterEnergy).mockResolvedValueOnce(afterWater)
    mocks.submitDecision.mockResolvedValueOnce(event).mockResolvedValueOnce(waterEvent)

    render(<App />)
    await screen.findByRole('button', { name: /Plan de seguridad hídrica/ })
    fireEvent.click(screen.getByLabelText(/Proteger a los hogares/))
    reviewAndSign()
    expect(await screen.findByTestId('persisted-outcome')).toHaveTextContent('10.600 M€')

    fireEvent.click(screen.getByRole('button', { name: /Plan de seguridad hídrica/ }))
    expect(screen.queryByTestId('persisted-outcome')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText(/Modernizar el uso industrial del agua/))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar decisión' }))
    expect(screen.getByTestId('decision-review')).toHaveTextContent('10.600 M€')
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y ejecutar decisión' }))

    const outcome = await screen.findByTestId('persisted-outcome')
    await waitFor(() => expect(outcome).toHaveTextContent('9.650 M€'))
    expect(outcome).toHaveTextContent('67%')
    expect(outcome).toHaveTextContent('61%')
    expect(mocks.submitDecision).toHaveBeenNthCalledWith(
      1, government.id, 'energy-resilience', 1, 'household-support')
    expect(mocks.submitDecision).toHaveBeenNthCalledWith(
      2, government.id, 'water-security', 1, 'industrial-reuse')
    expect(mocks.fetchWorld).toHaveBeenCalledTimes(3)
    expect(screen.getByText(/Plan de resiliencia energética · 2026-10-23/)).toBeInTheDocument()
    expect(screen.getByText(/Plan de seguridad hídrica · 2026-10-23/)).toBeInTheDocument()
  })

  it('renders the server weekly milestone and cited editorial dossier without inventing results', async () => {
    const weekly: GovernmentWorld['dossiers'][number] = {
      id: 'weekly-test-1', version: 1, title: 'Expediente semanal de prueba',
      context: 'Contexto editorial de prueba', category: 'Instituciones',
      release_kind: 'weekly', available_from: '2026-10-19', available_until: null,
      source_url: 'https://example.invalid/weekly-fixture-1',
      source_title: 'Fuente editorial de prueba',
      source_published_at: '2026-10-20T00:00:00Z'
    }
    const weeklyOption: GovernmentWorld['options'][number] = {
      dossier_id: weekly.id, dossier_version: 1, id: 'act',
      title: 'Actuar', description: 'Opción editorial de prueba',
      treasury_delta_m_eur: -100, policy_target: 50,
      response_intensity: 10, trust_base_delta: 0
    }
    mocks.fetchWorld.mockResolvedValue({
      ...initial,
      calendar: { ...initial.calendar, weeklyTotal: 1 },
      dossiers: [...initial.dossiers, weekly],
      options: [...initial.options, weeklyOption]
    })
    render(<App />)
    await screen.findByRole('button', { name: /Expediente semanal de prueba/ })
    const calendar = screen.getByRole('region', { name: 'Ciclo político semanal' })
    expect(calendar).toHaveTextContent('2026-10-19')
    expect(calendar).toHaveTextContent('2026-10-23')
    expect(calendar).toHaveTextContent('0 / 1')
    expect(calendar).toHaveTextContent('Hito del viernes alcanzado')
    expect(screen.getByRole('progressbar', { name: 'Expedientes semanales resueltos' }))
      .toHaveAttribute('aria-valuemax', '1')
    fireEvent.click(screen.getByRole('button', { name: /Expediente semanal de prueba/ }))
    expect(screen.getByRole('link', { name: /Fuente editorial de prueba/ }))
      .toHaveAttribute('href', 'https://example.invalid/weekly-fixture-1')
    expect(screen.queryByText(/ESCENARIO FICTICIO, NO NOTICIA ACTUAL/)).not.toBeInTheDocument()
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

})
