import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import PublicMatchPanel from './PublicMatchPanel'
import type { PublicLobby } from './lib/matchmaking'

const mocked = vi.hoisted(() => ({ listPublicLobbies: vi.fn() }))
vi.mock('./lib/matchmaking',()=>({ listPublicLobbies: mocked.listPublicLobbies }))

const first: PublicLobby = {
  id:'c0000000-0000-4000-8000-000000000001',title:'Cámara regional',
  player_count:4,open_seats:6,created_at:'2026-10-24T09:00:00Z'
}
beforeEach(()=>{ vi.clearAllMocks(); mocked.listPublicLobbies.mockResolvedValue([first]) })
afterEach(cleanup)

describe('public matchmaking UI',()=>{
  it('shows availability and joins only with a valid party name',async()=>{
    const join=vi.fn().mockResolvedValue(undefined)
    render(<PublicMatchPanel identity="user-1" disabled={false} onJoin={join}/>)
    expect(await screen.findByText('Cámara regional')).toBeInTheDocument()
    expect(screen.getByText('4/10 partidos · 6 plazas libres')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Cámara regional/}))
    const submit=screen.getByRole('button',{name:'Unirme a la asamblea'})
    expect(submit).toBeDisabled()
    fireEvent.change(screen.getByRole('textbox',{name:'Nombre del partido para partida pública'}),
      {target:{value:'Coalición Reformista'}})
    fireEvent.click(submit)
    await waitFor(()=>expect(join).toHaveBeenCalledWith(first.id,'Coalición Reformista'))
  })

  it('does not carry any lobby data across account switching',async()=>{
    const {rerender}=render(<PublicMatchPanel identity="user-1" disabled={false} onJoin={vi.fn()}/>)
    await screen.findByText('Cámara regional')
    mocked.listPublicLobbies.mockResolvedValueOnce([])
    rerender(<PublicMatchPanel identity="user-2" disabled={false} onJoin={vi.fn()}/>)
    expect(await screen.findByText(/Ahora mismo no hay partidas públicas/)).toBeInTheDocument()
    expect(screen.queryByText('Cámara regional')).not.toBeInTheDocument()
  })

  it('reports discovery failures without leaking stale lobbies',async()=>{
    mocked.listPublicLobbies.mockRejectedValueOnce(new Error('denied'))
    render(<PublicMatchPanel identity="user-1" disabled={false} onJoin={vi.fn()}/>)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No se pudo consultar el tablón de partidas')
    expect(screen.queryByText('Cámara regional')).not.toBeInTheDocument()
  })
})
