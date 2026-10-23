import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import NewsDiscoveryPanel from './NewsDiscoveryPanel'

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('./lib/game', () => ({ requireClient: () => ({ functions: { invoke: mocks.invoke } }) }))

const article = {
  title: 'Government announces major policy review',
  url: 'https://www.theguardian.com/politics/2026/oct/23/policy-review',
  source: 'The Guardian · UK politics',
  publishedAt: '2026-10-23T12:00:00Z'
}

beforeEach(() => {
  mocks.invoke.mockReset()
  mocks.invoke.mockResolvedValue({ data: { articles: [article], fetchedAt: '2026-10-23T12:00:00Z' }, error: null })
})
afterEach(cleanup)

describe('trusted editorial news discovery', () => {
  it('only fetches after an explicit editor action and links source metadata', async () => {
    const onPick = vi.fn()
    render(<NewsDiscoveryPanel onPick={onPick} disabled={false} usedUrls={[]} />)
    expect(mocks.invoke).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Consultar titulares' }))
    expect(await screen.findByText(article.title)).toBeInTheDocument()
    expect(mocks.invoke).toHaveBeenCalledWith('news-discovery?feed=elpais-spain', { method: 'GET' })
    fireEvent.click(screen.getByRole('button', { name: 'Vincular fuente' }))
    expect(onPick).toHaveBeenCalledWith(article)
  })

  it('prevents duplicate source selection across dossiers', async () => {
    render(<NewsDiscoveryPanel onPick={vi.fn()} disabled={false} usedUrls={[article.url]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar titulares' }))
    expect(await screen.findByRole('button', { name: 'Ya seleccionada' })).toBeDisabled()
  })

  it('does not let readonly published drafts request or modify sources', () => {
    render(<NewsDiscoveryPanel onPick={vi.fn()} disabled={true} usedUrls={[]} />)
    expect(screen.getByRole('button', { name: 'Consultar titulares' })).toBeDisabled()
    expect(mocks.invoke).not.toHaveBeenCalled()
  })

  it('rejects malformed or insecure article metadata', async () => {
    mocks.invoke.mockResolvedValue({ data: { articles: [
      { ...article, url: 'javascript:alert(1)' },
      { ...article, publishedAt: 'not-a-date' },
      article
    ], fetchedAt: '2026-10-23T12:00:00Z' }, error: null })
    render(<NewsDiscoveryPanel onPick={vi.fn()} disabled={false} usedUrls={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar titulares' }))
    await waitFor(() => expect(screen.getAllByRole('button', { name: 'Vincular fuente' })).toHaveLength(1))
  })

  it('shows an error without fabricating news when provider fails', async () => {
    mocks.invoke.mockRejectedValue(new Error('UPSTREAM_UNAVAILABLE'))
    render(<NewsDiscoveryPanel onPick={vi.fn()} disabled={false} usedUrls={[]} />)
    fireEvent.click(screen.getByRole('button', { name: 'Consultar titulares' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudieron consultar las noticias')
    expect(screen.queryByRole('button', { name: 'Vincular fuente' })).not.toBeInTheDocument()
  })
})
