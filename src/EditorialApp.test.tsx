import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import EditorialApp from './EditorialApp'
import { newEditorialDossier, nextMondayUtc, type EditorialDossier } from './lib/editorial'

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(), onAuthStateChange: vi.fn(), signInWithOtp: vi.fn(),
  signOut: vi.fn(), fetchEditorialRole: vi.fn(), fetchEditorialWeek: vi.fn(),
  saveEditorialWeek: vi.fn(), publishEditorialWeek: vi.fn(),
  fetchEditorialReviews: vi.fn(), reviewEditorialSlot: vi.fn(),
  fetchEditorialStaff: vi.fn(), manageEditorialStaff: vi.fn()
}))

vi.mock('./lib/game', () => ({
  client: { auth: {
    getUser: mocks.getUser, onAuthStateChange: mocks.onAuthStateChange,
    signInWithOtp: mocks.signInWithOtp, signOut: mocks.signOut
  } },
  friendlyError: (error: unknown) => error instanceof Error ? error.message : String(error)
}))

vi.mock('./lib/editorial', async importOriginal => ({
  ...await importOriginal<typeof import('./lib/editorial')>(),
  fetchEditorialRole: mocks.fetchEditorialRole,
  fetchEditorialWeek: mocks.fetchEditorialWeek,
  saveEditorialWeek: mocks.saveEditorialWeek,
  publishEditorialWeek: mocks.publishEditorialWeek
}))

vi.mock('./lib/editorialOperations',()=>({
  fetchEditorialReviews:mocks.fetchEditorialReviews,
  reviewEditorialSlot:mocks.reviewEditorialSlot,
  fetchEditorialStaff:mocks.fetchEditorialStaff,
  manageEditorialStaff:mocks.manageEditorialStaff
}))
const sourcing = vi.hoisted(() => ({ discover: vi.fn() }))
vi.mock('./lib/weeklySourcing', async importOriginal => ({
  ...await importOriginal<typeof import('./lib/weeklySourcing')>(),
  discoverWeeklySources: sourcing.discover
}))

vi.mock('./NewsDiscoveryPanel', () => ({
  default: ({ onPick, disabled }: {
    onPick: (article: { title: string; url: string; source: string; publishedAt: string }) => void
    disabled: boolean
  }) => <button type="button" disabled={disabled} onClick={() => onPick({
    title: 'Verifiable public news citation',
    url: 'https://elpais.com/espana/2026-10-23/source',
    source: 'EL PAÍS · España',
    publishedAt: '2026-10-23T12:00:00Z'
  })}>Importar referencia probada</button>
}))

const user = { id: '10000000-0000-4000-8000-000000000082' }
const week = nextMondayUtc()

function completeDraft(): EditorialDossier[] {
  return Array.from({ length: 10 }, (_, i) => ({
    ...newEditorialDossier(week, i + 1),
    title: 'Housing policy decision ' + (i + 1),
    context: 'A sufficiently detailed fictional policy dilemma with economic and social trade-offs.',
    category: 'Housing',
    source_url: 'https://example.invalid/editorial-test-' + (i + 1),
    source_title: 'Synthetic source reference ' + (i + 1),
    source_published_at: '2024-01-01T00:00:00Z',
    options: [
      { id: 'option-a', title: 'Approve reform', description: 'Approve a limited reform package.',
        treasury_delta_m_eur: -100, policy_target: 30, response_intensity: 25, trust_base_delta: 2 },
      { id: 'option-b', title: 'Maintain policy', description: 'Maintain the existing legal position.',
        treasury_delta_m_eur: 0, policy_target: 70, response_intensity: 15, trust_base_delta: -1 }
    ]
  }))
}

function snapshot(draft: EditorialDossier[], revision = 1, status: 'draft' | 'published' = 'draft') {
  return { week_start: week, revision, status, draft,
    updated_at: '2026-10-23T00:00:00Z',
    published_at: status === 'published' ? '2026-10-23T00:00:00Z' : null }
}

beforeEach(() => {
  vi.clearAllMocks()
  mocks.getUser.mockResolvedValue({ data: { user }, error: null })
  mocks.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } })
  mocks.signOut.mockResolvedValue({ error: null })
  mocks.fetchEditorialWeek.mockResolvedValue(null)
  mocks.fetchEditorialReviews.mockResolvedValue([])
  mocks.fetchEditorialStaff.mockResolvedValue([])
  const t = new Date().toISOString()
  const feeds = ['elpais-spain','elpais-economy','guardian-politics',
    'guardian-world','bbc-politics','bbc-business'] as const
  const hosts = ['elpais.com','elpais.com','www.theguardian.com',
    'www.theguardian.com','www.bbc.com','www.bbc.com']
  sourcing.discover.mockResolvedValue({
    successfulFeeds:6,unavailableFeeds:0,
    articles:feeds.flatMap((feedId,f)=>[0,1,2].map(n=>({
      feedId,title:'Actual public news headline '+f+' '+n,
      source:'Public news '+f,url:'https://'+hosts[f]+'/sector/'+f+'/'+n,
      publishedAt:t
    })))
  })
})
afterEach(cleanup)

describe('editorial workbench', () => {
  it('prepares a ten-reference Monday agenda, but never auto-saves or auto-publishes',async()=>{
    mocks.fetchEditorialRole.mockResolvedValue('publisher')
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    fireEvent.click(screen.getByRole('button',{name:'Preparar 10 fuentes automáticamente'}))
    await waitFor(()=>expect(sourcing.discover).toHaveBeenCalledOnce())
    await screen.findByText(/Se han preparado 10 referencias/)
    expect(screen.getByRole('progressbar',{name:'Expedientes preparados'}))
      .toHaveAttribute('aria-valuenow','0')
    expect(mocks.saveEditorialWeek).not.toHaveBeenCalled()
    expect(mocks.publishEditorialWeek).not.toHaveBeenCalled()
    expect(screen.getByRole('button',{name:'Revisar publicación'})).toBeDisabled()
    expect((screen.getByRole('textbox',{name:'Título político'}) as HTMLInputElement)
      .value).toContain('Debate institucional:')
  })

  it('prepares ten fictional options without auto-publishing or overwriting citation metadata',async()=>{
    mocks.fetchEditorialRole.mockResolvedValue('editor')
    render(<EditorialApp/>)
    await screen.findByText('Ficha de decisión')
    fireEvent.click(screen.getByRole('button',{name:'Preparar 10 fuentes automáticamente'}))
    await screen.findByText(/Se han preparado 10 referencias/)
    fireEvent.click(screen.getByRole('button',{name:'Preparar diez escenarios políticos'}))
    expect((screen.getByRole('textbox',{name:'Contexto y dilema'}) as HTMLTextAreaElement)
      .value).toContain('hipotético')
    expect(screen.getByRole('textbox',{name:'Decisión option-a'}))
      .toHaveValue('Impulsar una intervención pública')
    expect(screen.queryByRole('button',{name:'Revisar publicación'})).not.toBeInTheDocument()
    expect(mocks.saveEditorialWeek).not.toHaveBeenCalled()
  })

  it('reports failed sources without mutating the active editorial slate',async()=>{
    mocks.fetchEditorialRole.mockResolvedValue('editor')
    sourcing.discover.mockResolvedValue({articles:[],successfulFeeds:0,unavailableFeeds:6})
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    fireEvent.click(screen.getByRole('button',{name:'Preparar 10 fuentes automáticamente'}))
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No hay fuentes RSS disponibles')
    expect(screen.getByRole('textbox',{name:'Título político'})).toHaveValue('')
    expect(mocks.saveEditorialWeek).not.toHaveBeenCalled()
  })

  it('denies a signed-in account without trusted staff membership', async () => {
    mocks.fetchEditorialRole.mockResolvedValue(null)
    render(<EditorialApp />)
    expect(await screen.findByText('Acceso denegado')).toBeInTheDocument()
    expect(mocks.fetchEditorialWeek).not.toHaveBeenCalled()
    expect(mocks.saveEditorialWeek).not.toHaveBeenCalled()
    expect(mocks.publishEditorialWeek).not.toHaveBeenCalled()
  })

  it('saves edited data through the persistent revisioned API', async () => {
    mocks.fetchEditorialRole.mockResolvedValue('editor')
    mocks.saveEditorialWeek.mockImplementation(async (_target: string, revision: number,
      dossiers: EditorialDossier[]) => snapshot(dossiers, revision + 1))
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    fireEvent.change(screen.getByRole('textbox', { name: 'Título político' }),
      { target: { value: 'A binding energy decision' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(mocks.saveEditorialWeek).toHaveBeenCalledTimes(1))
    const [savedWeek, revision, dossiers] = mocks.saveEditorialWeek.mock.calls[0]
    expect(savedWeek).toBe(week)
    expect(revision).toBe(0)
    expect(dossiers).toHaveLength(10)
    expect(dossiers[0].title).toBe('A binding energy decision')
    expect(await screen.findByText(/Borrador guardado en el servidor/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Revisar publicación' })).not.toBeInTheDocument()
  })

  it('imports only source metadata into a draft and requires explicit save', async () => {
    mocks.fetchEditorialRole.mockResolvedValue('editor')
    mocks.saveEditorialWeek.mockImplementation(async (_target: string, revision: number,
      dossiers: EditorialDossier[]) => snapshot(dossiers, revision + 1))
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    fireEvent.click(screen.getByRole('button', { name: 'Importar referencia probada' }))
    expect(screen.getByRole('textbox', { name: 'Título de la fuente' }))
      .toHaveValue('Verifiable public news citation')
    expect(screen.getByRole('textbox', { name: 'Enlace a la fuente' }))
      .toHaveValue('https://elpais.com/espana/2026-10-23/source')
    expect(mocks.saveEditorialWeek).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    await waitFor(() => expect(mocks.saveEditorialWeek).toHaveBeenCalledTimes(1))
    const submitted = mocks.saveEditorialWeek.mock.calls[0][2] as EditorialDossier[]
    expect(submitted[0].source_published_at).toBe('2026-10-23T12:00:00Z')
    expect(submitted[0].context).toBe('')
    expect(submitted[0].options.every(option => option.title === '')).toBe(true)
  })

  it('blocks publication until all ten dossiers pass validation', async () => {
    mocks.fetchEditorialRole.mockResolvedValue('publisher')
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    expect(screen.getByRole('progressbar', { name: 'Expedientes preparados' }))
      .toHaveAttribute('aria-valuenow', '0')
    expect(screen.getByRole('button', { name: 'Revisar publicación' })).toBeDisabled()
    expect(mocks.publishEditorialWeek).not.toHaveBeenCalled()
  })

  it('requires ten publisher reviews before allowing final publication',async()=>{
    const draft=completeDraft()
    mocks.fetchEditorialRole.mockResolvedValue('publisher')
    mocks.fetchEditorialWeek.mockResolvedValue(snapshot(draft,4))
    mocks.reviewEditorialSlot.mockResolvedValue(undefined)
    render(<EditorialApp/>)
    await screen.findByText('Ficha de decisión')
    expect(screen.getByRole('button',{name:'Revisar publicación'})).toBeDisabled()
    fireEvent.click(screen.getByRole('button',{
      name:'Aprobar expediente tras contrastar la fuente'
    }))
    await waitFor(()=>expect(mocks.reviewEditorialSlot).toHaveBeenCalledWith(
      week,4,draft[0].id,true))
    expect(mocks.publishEditorialWeek).not.toHaveBeenCalled()
  })

  it('does not permit a publisher to approve their own saved revision',async()=>{
    const draft=completeDraft()
    mocks.fetchEditorialRole.mockResolvedValue('publisher')
    mocks.fetchEditorialWeek.mockResolvedValue({
      ...snapshot(draft,4),updated_by:user.id
    })
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    expect(screen.getByText(/no puedes aprobar tu propio borrador/)).toBeInTheDocument()
    expect(screen.getByRole('button',{
      name:'Aprobar expediente tras contrastar la fuente'
    })).toBeDisabled()
    expect(mocks.reviewEditorialSlot).not.toHaveBeenCalled()
    expect(mocks.publishEditorialWeek).not.toHaveBeenCalled()
  })

  it('disables final publication even if an old self-authored slate has ten attestations',async()=>{
    const draft=completeDraft()
    mocks.fetchEditorialRole.mockResolvedValue('publisher')
    mocks.fetchEditorialWeek.mockResolvedValue({
      ...snapshot(draft,7),updated_by:user.id
    })
    mocks.fetchEditorialReviews.mockResolvedValue(draft.map(d=>({
      dossier_id:d.id,reviewed_by:user.id,reviewed_at:new Date().toISOString()
    })))
    render(<EditorialApp/>)
    await waitFor(()=>expect(screen.getByRole('progressbar',{
      name:'Expedientes preparados'
    })).toHaveAttribute('aria-valuenow','10'))
    await waitFor(()=>expect(screen.getByRole('button',{
      name:'Revisar publicación'
    })).toBeDisabled())
    expect(screen.getByText(/otra cuenta autorizada debe verificar/)).toBeInTheDocument()
    expect(mocks.publishEditorialWeek).not.toHaveBeenCalled()
  })

  it('publishes a persisted complete revision, then locks the forms', async () => {
    const draft = completeDraft()
    mocks.fetchEditorialRole.mockResolvedValue('publisher')
    mocks.fetchEditorialWeek.mockResolvedValueOnce(snapshot(draft, 4))
      .mockResolvedValueOnce(snapshot(draft, 5, 'published'))
    mocks.publishEditorialWeek.mockResolvedValue(snapshot(draft, 5, 'published'))
    mocks.fetchEditorialReviews.mockResolvedValue(draft.map(d=>({
      dossier_id:d.id,reviewed_by:user.id,reviewed_at:new Date().toISOString()
    })))
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    await waitFor(() => expect(screen.getByRole('progressbar', { name: 'Expedientes preparados' }))
      .toHaveAttribute('aria-valuenow', '10'))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar publicación' }))
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar y publicar' }))
    await waitFor(() => expect(mocks.publishEditorialWeek).toHaveBeenCalledWith(week, 4))
    expect(await screen.findByText(/Agenda publicada y aprobada/)).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Título político' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Revisar publicación' })).not.toBeInTheDocument()
  })

  it('preserves unsaved edits when optimistic concurrency detects another editor', async () => {
    mocks.fetchEditorialRole.mockResolvedValue('editor')
    mocks.saveEditorialWeek.mockRejectedValue(new Error('EDITORIAL_REVISION_CONFLICT'))
    render(<EditorialApp />)
    await screen.findByText('Ficha de decisión')
    fireEvent.change(screen.getByRole('textbox', { name: 'Título político' }),
      { target: { value: 'Original local editorial work' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Otro editor ha guardado cambios')
    expect(screen.getByRole('textbox', { name: 'Título político' }))
      .toHaveValue('Original local editorial work')
  })
})
