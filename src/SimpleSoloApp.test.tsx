import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SimpleSoloApp from './SimpleSoloApp'
import { GUEST_STORAGE_KEY, INTRO_CASES } from './lib/simpleGame'

vi.mock('./lib/game', () => ({
  client: null,
  fetchWorld: vi.fn(),
  friendlyError: (error: unknown) => error instanceof Error ? error.message : String(error),
  startGovernment: vi.fn(),
  submitDecision: vi.fn()
}))
vi.mock('./AccountSecurity', () => ({ default: () => null }))
vi.mock('./AuthGateway', () => ({ default: () => null }))
beforeEach(() => { window.localStorage.clear(); vi.restoreAllMocks() })
afterEach(() => { cleanup(); window.localStorage.clear() })

describe('the simplified homepage', () => {
  it('offers a real interactive political dilemma without any account or manual', async () => {
    render(<SimpleSoloApp />)
    const region = await screen.findByTestId('simple-dilemma')
    expect(within(region).getByRole('heading', { name: INTRO_CASES[0].title })).toBeInTheDocument()
    expect(within(region).getByRole('button', { name: 'Tomar esta decisión' })).toBeDisabled()
    expect(within(region).getAllByRole('button', { pressed: false })).toHaveLength(3)
    expect(screen.getByText(/DECISIÓN 1 DE 12/)).toBeInTheDocument()
    expect(screen.queryByText('Presupuesto del Estado')).not.toBeInTheDocument()
  })

  it('takes one choice, shows consequences, and exposes the next dilemma immediately', async () => {
    render(<SimpleSoloApp />)
    const first = await screen.findByTestId('simple-dilemma')
    fireEvent.click(within(first).getByRole('button', { name: /Proteger a los hogares/ }))
    fireEvent.click(within(first).getByRole('button', { name: 'Tomar esta decisión' }))
    const outcome = screen.getByTestId('simple-outcome')
    expect(outcome).toHaveTextContent('El Gobierno pone en marcha')
    expect(outcome).toHaveTextContent('Popularidad')
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toContain('energy-resilience')
    fireEvent.click(within(outcome).getByRole('button', { name: 'Siguiente decisión' }))
    expect(screen.getByRole('heading', { name: INTRO_CASES[1].title })).toBeInTheDocument()
    expect(screen.getByText(/DECISIÓN 2 DE 12/)).toBeInTheDocument()
  })

  it('resumes an anonymous campaign after reload without losing the save', async () => {
    const first = render(<SimpleSoloApp />)
    const current = await screen.findByTestId('simple-dilemma')
    fireEvent.click(within(current).getByRole('button', { name: /Proteger a los hogares/ }))
    fireEvent.click(within(current).getByRole('button', { name: 'Tomar esta decisión' }))
    first.unmount()
    render(<SimpleSoloApp />)
    expect(await screen.findByRole('heading', { name: INTRO_CASES[1].title })).toBeInTheDocument()
    expect(screen.getByText(/DECISIÓN 2 DE 12/)).toBeInTheDocument()
  })

  it('keeps history and advanced political controls away from normal gameplay', async () => {
    render(<SimpleSoloApp />)
    await screen.findByTestId('simple-dilemma')
    fireEvent.click(screen.getByRole('button', { name: 'Historia' }))
    expect(screen.getByRole('heading', { name: 'Así has gobernado' })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    expect(screen.getByRole('link', { name: /Modo avanzado/ })).toHaveAttribute('href', '/advanced')
    expect(screen.getByRole('link', { name: /Partida parlamentaria/ })).toHaveAttribute('href', '/multiplayer')
  })

  it('finishes a full first mandate and offers a fictional election score', async () => {
    render(<SimpleSoloApp />)
    await screen.findByTestId('simple-dilemma')
    for (let index = 0; index < INTRO_CASES.length; index++) {
      const dossier = screen.getByTestId('simple-dilemma')
      fireEvent.click(within(dossier).getAllByRole('button', { pressed: false })[2])
      fireEvent.click(within(dossier).getByRole('button', { name: 'Tomar esta decisión' }))
      fireEvent.click(screen.getByRole('button', {
        name: index === INTRO_CASES.length - 1 ? 'Ver las elecciones' : 'Siguiente decisión'
      }))
    }
    expect(screen.getByTestId('simple-election')).toHaveTextContent('Voto estimado')
    expect(screen.getByTestId('simple-election')).toHaveTextContent('50%')
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toContain(INTRO_CASES.at(-1)!.id)
  })

  it('requires confirmation before resetting a saved guest campaign', async () => {
    render(<SimpleSoloApp />)
    const first = await screen.findByTestId('simple-dilemma')
    fireEvent.click(within(first).getAllByRole('button', { pressed: false })[0])
    fireEvent.click(within(first).getByRole('button', { name: 'Tomar esta decisión' }))
    window.localStorage.setItem('another-game', 'keep')
    fireEvent.click(screen.getByRole('button', { name: 'Menú' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar partida de invitado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).not.toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Reiniciar partida de invitado' }))
    fireEvent.click(screen.getByRole('button', { name: 'Sí, borrar partida' }))
    await waitFor(() => expect(screen.getByTestId('simple-dilemma')).toBeInTheDocument())
    expect(window.localStorage.getItem(GUEST_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem('another-game')).toBe('keep')
  })
})
