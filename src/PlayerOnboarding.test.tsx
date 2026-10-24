import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, expect, it } from 'vitest'
import PlayerGuide from './PlayerGuide'
import PlayerOnboarding from './PlayerOnboarding'
import type { GovernmentWorld } from './lib/types'
import type { MatchWorld } from './lib/multiplayer'
afterEach(cleanup)
it('makes every manual section accessible without a session or network',()=>{
 render(<PlayerGuide />)
 expect(screen.getByRole('heading',{level:1})).toBeInTheDocument()
 expect(screen.getByRole('heading',{name:'Una semana política'})).toBeInTheDocument()
 expect(screen.getByRole('heading',{name:'Acceso y recuperación'})).toBeInTheDocument()
 for(const link of screen.getAllByRole('link').filter(l=>l.getAttribute('href')?.startsWith('#')))
  expect(document.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull()
})
it('shows unpublished weekly content as pending, without marking study as execution',()=>{
 const world={events:[],calendar:{weeklyTotal:0}} as unknown as GovernmentWorld
 const view=render(<PlayerOnboarding world={world} />)
 expect(screen.getByText(/pendiente de publicación editorial/)).toHaveTextContent('○')
 expect(screen.queryByRole('button')).toBeNull()
 view.rerender(<PlayerOnboarding world={{...world,events:[{}],calendar:{weeklyTotal:10}} as GovernmentWorld} />)
 expect(screen.getByText(/Firma tu primera/)).toHaveTextContent('✓')
 expect(screen.getByText('✓ Agenda semanal publicada')).toBeInTheDocument()
})
it('keeps another party stance from completing the current player step',()=>{
 const world={match:{status:'lobby',readiness_required:true},me:{user_id:'mine',is_ready:false},
  stances:[{user_id:'other'}]} as unknown as MatchWorld
 const view=render(<PlayerOnboarding world={world} />)
 expect(screen.getByText(/Confirma tu preparación/)).toHaveTextContent('○')
 expect(screen.getByText(/Registra tu primera postura/)).toHaveTextContent('○')
 view.rerender(<PlayerOnboarding world={{...world,match:{...world.match,status:'active'},
  me:{...world.me,is_ready:true},stances:[{user_id:'mine'}]} as MatchWorld} />)
 expect(screen.getByText(/Registra tu primera postura/)).toHaveTextContent('✓')
})
