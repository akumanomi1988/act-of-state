import {cleanup, fireEvent, render, screen, within} from '@testing-library/react'
import {afterEach,describe,expect,it} from 'vitest'
import GameMenu from './GameMenu'
import GameModeSelect from './GameModeSelect'
afterEach(cleanup)
describe('game navigation and entry contracts',()=>{
  it('switches routes without presenting a destructive restart command',()=>{
    render(<GameMenu current="solo"/>)
    const menu=screen.getByText('Menú').closest('details')!
    expect(menu).not.toHaveAttribute('open')
    fireEvent.click(screen.getByText('Menú'))
    expect(menu).toHaveAttribute('open')
    const nav=screen.getByRole('navigation',{name:'Menú del juego'})
    expect(within(nav).getByRole('link',{name:/Partida individual/})).toHaveAttribute('aria-current','page')
    expect(within(nav).getByRole('link',{name:/Partida parlamentaria/})).toHaveAttribute('href','/multiplayer')
    expect(within(nav).getByRole('link',{name:/Partida de prueba/})).toHaveAttribute('href','/demo')
    expect(within(nav).getByRole('link',{name:/Reglas del juego/})).toHaveAttribute('href','/guide')
    expect(within(nav).queryByRole('button',{name:/Reiniciar|Borrar partida/})).toBeNull()
  })
  it('names the three supported game modes and never fabricates a new save',()=>{
    render(<GameModeSelect selected="parliament" />)
    const nav=screen.getByRole('navigation',{name:'Elegir modo de juego'})
    const links=within(nav).getAllByRole('link')
    expect(links).toHaveLength(3)
    expect(links.map(item=>item.getAttribute('href'))).toEqual(['/','/multiplayer','/demo'])
    expect(within(nav).getByRole('link',{name:/Partida parlamentaria/})).toHaveAttribute('aria-current','page')
  })
})
