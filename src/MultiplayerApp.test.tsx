import { within, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { MatchWorld } from './lib/multiplayer'
import MultiplayerApp from './MultiplayerApp'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), onAuthStateChange: vi.fn(), signInWithOtp: vi.fn(),
  signOut: vi.fn(), listMyMatches: vi.fn(), createMatch: vi.fn(),
  joinMatch: vi.fn(), startMatch: vi.fn(), fetchMatchWorld: vi.fn(),
  recordMatchStance: vi.fn(), submitDecision: vi.fn(),
  setMatchVisibility: vi.fn(),setMatchReady:vi.fn(),
  setMatchReadinessRequirement:vi.fn(),leaveLobby:vi.fn(),
  mandateApproved: { value: true }
}))

vi.mock('./WeeklyAccountabilityPanel', () => ({ default: () => <div>Legislature history fixture</div> }))
vi.mock('./ActionInboxPanel', () => ({ default: () => <div>Political action inbox fixture</div> }))
vi.mock('./PopulationPanel', () => ({ default: () => null }))
vi.mock('./LivingConditionsPanel', () => ({ default: () => null }))
vi.mock('./PublicMatchPanel', () => ({ default: () => <div>Public lobby test fixture</div> }))
vi.mock('./lib/matchmaking', () => ({ setMatchVisibility: mocks.setMatchVisibility,
  joinPublicLobby: vi.fn() }))

vi.mock('./lib/lobby',async importOriginal=>({
  ...await importOriginal<typeof import('./lib/lobby')>(),
  setMatchReady:mocks.setMatchReady,
  setMatchReadinessRequirement:mocks.setMatchReadinessRequirement,
  leaveLobby:mocks.leaveLobby
}))
vi.mock('./FiscalPanel', () => ({ default: () => <div>National fiscal panel fixture</div> }))

vi.mock('./lib/game', () => ({
  client: { auth: {
    getUser: mocks.getUser, onAuthStateChange: mocks.onAuthStateChange,
    signInWithOtp: mocks.signInWithOtp, signOut: mocks.signOut
  } },
  submitDecision: mocks.submitDecision,
  friendlyError: (error: unknown) => error instanceof Error ? error.message : String(error)
}))
vi.mock('./lib/multiplayer', () => ({
  listMyMatches: mocks.listMyMatches, createMatch: mocks.createMatch,
  joinMatch: mocks.joinMatch, startMatch: mocks.startMatch,
  fetchMatchWorld: mocks.fetchMatchWorld, recordMatchStance: mocks.recordMatchStance,
  matchError: (error: unknown) => error instanceof Error ? error.message : String(error)
}))

vi.mock('./ElectionPanel', () => ({ default: () => <div>Electoral mandate test fixture</div> }))

vi.mock('./ParliamentPanel', async () => {
  const { useEffect } = await import('react')
  return { default: ({ onMandateChange }: {
    onMandateChange: (value: string | null) => void
  }) => {
    useEffect(() => {
      onMandateChange(mocks.mandateApproved.value ? 'household-support' : null)
    }, [onMandateChange])
    return <div>Parliamentary mandate test fixture</div>
  } }
})

const hostId = '00000000-0000-4000-8000-000000000001'
const guestId = '00000000-0000-4000-8000-000000000002'
const governmentId = '00000000-0000-4000-8000-000000000003'
const matchId = '00000000-0000-4000-8000-000000000004'
const dossierId = 'energy-resilience'
const optionId = 'household-support'
let signedInAs = hostId

function world(status: 'lobby' | 'active', count: number, owner = hostId, decided = false): MatchWorld {
  const players = Array.from({ length: count }, (_, i) => ({
    match_id: matchId, user_id: i === 0 ? hostId : i === 1 ? guestId :
      '00000000-0000-4000-8000-' + String(i + 1).padStart(12, '0'),
    seat_no: i + 1, party_name: 'Party ' + (i + 1),
    manifesto_policy: 50, mandate_seats: 10,
    joined_at: '2026-10-23T00:00:00Z', is_ready:false
  }))
  return {
    match: { id: matchId, title: 'Legislature of Arcadia', status,
      host_user_id: hostId, government_id: governmentId,
      invite_code: 'abcdef0123456789abcdef0123456789',
      created_at: '2026-10-23T00:00:00Z',
      started_at: status === 'active' ? '2026-10-23T00:00:00Z' : null,
      is_public:false,readiness_required:false,max_players: 10 },
    me: players.find(p => p.user_id === owner) ?? players[0],
    gameDay: '2026-10-23',
    players,
    government: { id: governmentId, owner_id: hostId,
      country_name: 'Republic of Arcadia', treasury_m_eur: decided ? 10600 : 12000,
      approval: decided ? 62 : 50, trust: decided ? 58 : 50,
      created_at: '2026-10-23T00:00:00Z', updated_at: '2026-10-23T00:00:00Z' },
    cohorts: [{ id: 'c1', government_id: governmentId, code: 'households',
      label: 'Households', population_weight: 100, ideal_policy: 25,
      support: decided ? 68 : 50, trust: decided ? 61 : 50 }],
    dossiers: [{ id: dossierId, version: 1, title: 'Energy resilience plan',
      context: 'Fictional energy policy scenario', category: 'Economy',
      release_kind: 'intro', available_from: null, available_until: null }],
    options: [{ dossier_id: dossierId, dossier_version: 1, id: optionId,
      title: 'Protect households', description: 'Targeted transfers',
      treasury_delta_m_eur: -1400, policy_target: 25,
      response_intensity: 35, trust_base_delta: 2 }],
    stances: [],
    events: decided ? [{
      id: 'event-1', government_id: governmentId, dossier_id: dossierId,
      dossier_version: 1, option_id: optionId,
      dossier_title_snapshot: 'Energy resilience plan',
      option_title_snapshot: 'Protect households',
      engine_version: 'weighted-cohorts-v1', decided_on: '2026-10-23',
      created_at: '2026-10-23T00:00:00Z',
      state_before: { treasury_m_eur: 12000, approval: 50, trust: 50 },
      state_after: { treasury_m_eur: 10600, approval: 62, trust: 58 },
      parameters_snapshot: { treasury_delta_m_eur: -1400,
        policy_target: 25, response_intensity: 35, trust_base_delta: 2 },
      cohort_effects: [{ code: 'households', label: 'Households',
        population_weight: 100, support_before: 50,
        support_after: 68, trust_before: 50, trust_after: 61 }]
    }] : []
  }
}

function currentSummary(status: 'lobby' | 'active' = 'active', count = 10) {
  return [{ id: matchId, title: 'Legislature of Arcadia', status,
    host_user_id: hostId, government_id: governmentId,
    seat_no: signedInAs === hostId ? 1 : 2,
    party_name: signedInAs === hostId ? 'Party 1' : 'Party 2',
    player_count: count, created_at: '2026-10-23T00:00:00Z' }]
}

beforeEach(() => {
  vi.resetAllMocks()
  signedInAs = hostId
  mocks.mandateApproved.value = true
  mocks.getUser.mockResolvedValue({ data: { user: { id: hostId } }, error: null })
  mocks.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } }
  })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.listMyMatches.mockResolvedValue([])
  mocks.fetchMatchWorld.mockResolvedValue(world('active', 10))
  mocks.createMatch.mockResolvedValue({ id: matchId })
  mocks.joinMatch.mockResolvedValue({ match_id: matchId })
  mocks.startMatch.mockResolvedValue(undefined)
  mocks.recordMatchStance.mockResolvedValue({ policy_affinity: 65 })
  mocks.submitDecision.mockResolvedValue({})
  mocks.setMatchVisibility.mockResolvedValue(undefined)
  mocks.setMatchReady.mockResolvedValue(undefined)
  mocks.setMatchReadinessRequirement.mockResolvedValue(undefined)
  mocks.leaveLobby.mockResolvedValue(undefined)
})
afterEach(cleanup)

describe('ten-party multiplayer assembly', () => {
  it('isolates multiplayer mobile tasks without changing the authoritative world',async()=>{
    mocks.listMyMatches.mockResolvedValue(currentSummary('active',2))
    mocks.fetchMatchWorld.mockResolvedValue(world('active',2))
    render(<MultiplayerApp/>)
    const nav=await screen.findByRole('navigation',{name:'Navegación de la asamblea'})
    await screen.findByRole('heading',{name:'Legislature of Arcadia'})
    const workspace=nav.nextElementSibling
    expect(workspace).toHaveAttribute('data-mobile-screen','decide')
    for(const [label,id] of [['Partidas','matches'],['Asamblea','activity'],
      ['Elecciones','elections'],['Mi país','status'],['Jugar','decide']] as const){
      fireEvent.click(screen.getByRole('button',{name:label}))
      expect(workspace).toHaveAttribute('data-mobile-screen',id)
    }
    fireEvent.click(screen.getByRole('button',{name:'Mi país'}))
    const statusNav=screen.getByRole('navigation',{name:'Apartados de Mi país'})
    expect(statusNav).toHaveTextContent('Economía')
    fireEvent.click(within(statusNav).getByRole('button',{name:'Población'}))
    expect(workspace).toHaveAttribute('data-mobile-detail','people')
    fireEvent.click(within(statusNav).getByRole('button',{name:'Historial'}))
    expect(workspace).toHaveAttribute('data-mobile-detail','history')
    fireEvent.click(screen.getByRole('button',{name:'Asamblea'}))
    const activityNav=screen.getByRole('navigation',{name:'Apartados de la asamblea'})
    expect(activityNav).toHaveTextContent('Avisos')
    fireEvent.click(within(activityNav).getByRole('button',{name:'Partidos'}))
    expect(workspace).toHaveAttribute('data-mobile-activity','parties')
    fireEvent.click(within(activityNav).getByRole('button',{name:'Instituciones'}))
    expect(workspace).toHaveAttribute('data-mobile-activity','institution')
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('coordinates ten-party readiness and blocks the host while anyone is pending',async()=>{
    const fixture=world('lobby',3)
    fixture.match.readiness_required=true
    fixture.players[0].is_ready=true
    fixture.players[1].is_ready=true
    mocks.listMyMatches.mockResolvedValue(currentSummary('lobby',3))
    mocks.fetchMatchWorld.mockResolvedValue(fixture)
    render(<MultiplayerApp/>)
    await screen.findByText('Convocatoria abierta')
    expect(screen.getByText(/2 de 3 partidos preparados/)).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Comenzar legislatura'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{name:'Retirar preparación'}))
    await waitFor(()=>expect(mocks.setMatchReady).toHaveBeenCalledWith(matchId,false))
    expect(mocks.startMatch).not.toHaveBeenCalled()
    expect(screen.getByRole('button',{name:'Desactivar confirmación'})).toBeInTheDocument()
  })

  it('allows non-host to leave the lobby, without displaying any government activation',async()=>{
    signedInAs=guestId
    mocks.getUser.mockResolvedValue({data:{user:{id:guestId}},error:null})
    mocks.listMyMatches.mockResolvedValue(currentSummary('lobby',2))
    mocks.fetchMatchWorld.mockResolvedValue(world('lobby',2,guestId))
    render(<MultiplayerApp/>)
    await screen.findByText('Convocatoria abierta')
    expect(screen.queryByRole('button',{name:'Comenzar legislatura'})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Abandonar convocatoria'}))
    await waitFor(()=>expect(mocks.leaveLobby).toHaveBeenCalledWith(matchId))
  })


  it('creates a match through the backend and does not invent a local world', async () => {
    render(<MultiplayerApp />)
    await screen.findByText('No perteneces a ninguna partida todavía.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre de la partida' }),
      { target: { value: 'Legislature of Arcadia' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Nombre del partido anfitrión' }),
      { target: { value: 'Civic Alliance' } })
    fireEvent.click(screen.getByRole('button', { name: 'Fundar partida' }))
    await waitFor(() => expect(mocks.createMatch).toHaveBeenCalledWith(
      'Legislature of Arcadia', 'Civic Alliance'))
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('joins a match by invite through the backend', async () => {
    render(<MultiplayerApp />)
    await screen.findByText('No perteneces a ninguna partida todavía.')
    fireEvent.change(screen.getByRole('textbox', { name: 'Código de invitación' }),
      { target: { value: 'abcdef0123456789abcdef0123456789' } })
    fireEvent.change(screen.getByRole('textbox', { name: 'Partido invitado' }),
      { target: { value: 'Reform Party' } })
    fireEvent.click(screen.getByRole('button', { name: 'Ocupar escaño' }))
    await waitFor(() => expect(mocks.joinMatch).toHaveBeenCalledWith(
      'abcdef0123456789abcdef0123456789', 'Reform Party'))
  })

  it('allows only the host to advertise a lobby as discoverable',async()=>{
    mocks.listMyMatches.mockResolvedValue(currentSummary('lobby',2))
    mocks.fetchMatchWorld.mockResolvedValue(world('lobby',2))
    render(<MultiplayerApp/>)
    expect(await screen.findByRole('button',{name:'Publicar partida'})).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Publicar partida'}))
    await waitFor(()=>expect(mocks.setMatchVisibility).toHaveBeenCalledWith(matchId,true))
  })

  it('renders ten persistent seats and server-calculated national indicators', async () => {
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    render(<MultiplayerApp />)
    expect(await screen.findByText('Legislature of Arcadia', { selector: 'h1' }))
      .toBeInTheDocument()
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
    expect(screen.getByText('12.000 M€')).toBeInTheDocument()
    expect(screen.getByText('Energy resilience plan', { selector: 'h3' }))
      .toBeInTheDocument()
    expect(screen.getAllByText('Party 1').length).toBeGreaterThan(0)
    expect(screen.getByText('Party 10')).toBeInTheDocument()
  })

  it('limits national decisions to the host while allowing opposition stances', async () => {
    signedInAs = guestId
    mocks.getUser.mockResolvedValue({ data: { user: { id: guestId } }, error: null })
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    mocks.fetchMatchWorld.mockResolvedValue(world('active', 10, guestId))
    render(<MultiplayerApp />)
    await screen.findByText('Energy resilience plan', { selector: 'h3' })
    expect(screen.queryByRole('button', { name: 'Revisar decisión de gobierno' }))
      .not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: /Protect households/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Fijar posición del partido' }))
    await waitFor(() => expect(mocks.recordMatchStance).toHaveBeenCalledWith(
      matchId, dossierId, 1, optionId))
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })

  it('only permits lobby start with two players and invokes the server', async () => {
    mocks.listMyMatches.mockResolvedValue(currentSummary('lobby', 2))
    mocks.fetchMatchWorld.mockResolvedValue(world('lobby', 2))
    render(<MultiplayerApp />)
    const button = await screen.findByRole('button', { name: 'Comenzar legislatura' })
    expect(button).toBeEnabled()
    fireEvent.click(button)
    await waitFor(() => expect(mocks.startMatch).toHaveBeenCalledWith(matchId))
  })

  it('reconciles a government decision against the persisted shared result', async () => {
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    mocks.fetchMatchWorld.mockResolvedValueOnce(world('active', 10))
      .mockResolvedValue(world('active', 10, hostId, true))
    render(<MultiplayerApp />)
    await screen.findByText('Energy resilience plan', { selector: 'h3' })
    fireEvent.click(screen.getByRole('radio', { name: /Protect households/ }))
    const review = screen.getByRole('button', { name: 'Revisar decisión de gobierno' })
    await waitFor(() => expect(review).toBeEnabled())
    fireEvent.click(review)
    fireEvent.click(screen.getByRole('button', { name: 'Firmar y ejecutar' }))
    await waitFor(() => expect(mocks.submitDecision).toHaveBeenCalledWith(
      governmentId, dossierId, 1, optionId))
    expect(await screen.findByText('10.600 M€')).toBeInTheDocument()
    expect(screen.getByText(/Los diez partidos comparten el nuevo estado nacional/))
      .toBeInTheDocument()
  })
  it('blocks a host cabinet signature until Parliament approves the selected option', async () => {
    mocks.mandateApproved.value = false
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    render(<MultiplayerApp />)
    await screen.findByText('Energy resilience plan', { selector: 'h3' })
    fireEvent.click(screen.getByRole('radio', { name: /Protect households/ }))
    expect(screen.getByRole('button', { name: 'Revisar decisión de gobierno' }))
      .toBeDisabled()
    expect(mocks.submitDecision).not.toHaveBeenCalled()
  })
  it('recovers a signed act after the acknowledgement is lost without resubmitting',async()=>{
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    mocks.submitDecision.mockRejectedValueOnce(new Error('transport dropped'))
    mocks.fetchMatchWorld.mockResolvedValueOnce(world('active',10))
      .mockResolvedValue(world('active',10,hostId,true))
    render(<MultiplayerApp/>)
    await screen.findByText('Energy resilience plan',{selector:'h3'})
    fireEvent.click(screen.getByRole('radio',{name:/Protect households/}))
    await waitFor(()=>expect(screen.getByRole('button',
      {name:'Revisar decisión de gobierno'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Revisar decisión de gobierno'}))
    fireEvent.click(screen.getByRole('button',{name:'Firmar y ejecutar'}))
    expect(await screen.findByText(/Firma confirmada en el servidor/)).toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button',{name:'Firmar y ejecutar'})).not.toBeInTheDocument()
  })

  it('locks an ambiguous signature until a user-triggered authoritative refresh',async()=>{
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    mocks.submitDecision.mockRejectedValueOnce(new Error('network response lost'))
    mocks.fetchMatchWorld.mockResolvedValue(world('active',10))
    render(<MultiplayerApp/>)
    await screen.findByText('Energy resilience plan',{selector:'h3'})
    fireEvent.click(screen.getByRole('radio',{name:/Protect households/}))
    await waitFor(()=>expect(screen.getByRole('button',
      {name:'Revisar decisión de gobierno'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Revisar decisión de gobierno'}))
    fireEvent.click(screen.getByRole('button',{name:'Firmar y ejecutar'}))
    const sync = await screen.findByRole('button',{name:'Sincronizar firma pendiente'})
    expect(sync).toBeInTheDocument()
    expect(screen.getByRole('button',{name:'Firmar y ejecutar'})).toBeDisabled()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
    fireEvent.click(sync)
    expect(await screen.findByText(/Sin firma registrada en el estado oficial/))
      .toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
  })

  it('never announces a different signed option as successful execution',async()=>{
    mocks.listMyMatches.mockResolvedValue(currentSummary())
    const conflicting = world('active',10,hostId,true)
    conflicting.events[0].option_id='other'
    mocks.fetchMatchWorld.mockResolvedValueOnce(world('active',10))
      .mockResolvedValue(conflicting)
    render(<MultiplayerApp/>)
    await screen.findByText('Energy resilience plan',{selector:'h3'})
    fireEvent.click(screen.getByRole('radio',{name:/Protect households/}))
    await waitFor(()=>expect(screen.getByRole('button',
      {name:'Revisar decisión de gobierno'})).toBeEnabled())
    fireEvent.click(screen.getByRole('button',{name:'Revisar decisión de gobierno'}))
    fireEvent.click(screen.getByRole('button',{name:'Firmar y ejecutar'}))
    expect(await screen.findByText(/El servidor registra una opción diferente/))
      .toBeInTheDocument()
    expect(screen.queryByText(/Firma confirmada en el servidor/)).not.toBeInTheDocument()
    expect(mocks.submitDecision).toHaveBeenCalledTimes(1)
  })

})
