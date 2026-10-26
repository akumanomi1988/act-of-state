import { cleanup, fireEvent, render, screen } from '@testing-library/react'
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
it('opens the complete public manual in English without changing game state',()=>{
 const original=window.location.href
 window.history.replaceState({},'', '/guide?lang=en')
 try {
  const view=render(<PlayerGuide />)
  expect(screen.getByRole('heading',{name:'From your first decision to a shared mandate'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Government and opposition'})).toBeInTheDocument()
  expect(screen.getByRole('heading',{name:'Campaigns and elections'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'English'})).toHaveAttribute('aria-pressed','true')
  expect(view.container.querySelectorAll('main section')).toHaveLength(16)
  expect(screen.getByRole('link',{name:'Try the demo'})).toHaveAttribute('href','/demo?lang=en')
  expect(screen.getByRole('link',{name:'Service status'})).toHaveAttribute('href','/status?lang=en')
  for(const link of screen.getAllByRole('link').filter(x=>x.getAttribute('href')?.startsWith('#')))
   expect(document.getElementById(link.getAttribute('href')!.slice(1))).not.toBeNull()
  fireEvent.click(screen.getByRole('button',{name:'Español'}))
  expect(new URLSearchParams(window.location.search).get('lang')).toBeNull()
  expect(screen.getByRole('heading',{name:'Una semana política'})).toBeInTheDocument()
  expect(screen.getByRole('button',{name:'English'})).toHaveAttribute('aria-pressed','false')
 } finally {
  window.history.replaceState({},'',original)
 }
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

it('tracks founding and 18 nationally signed reforms independently',()=>{
 const founding=Array.from({length:10},(_,i)=>({
   id:'founding-'+i,version:1,release_kind:'intro',programme_chapter:'founding'
 }))
 const reforms=Array.from({length:18},(_,i)=>({
   id:'reform-'+i,version:1,release_kind:'intro',
   programme_chapter:(['society','economy','institutions','resilience'] as const)[i%4]
 }))
 const world={
   dossiers:[...founding,...reforms],
   events:[{dossier_id:'founding-0'},{dossier_id:'reform-0'}],
   calendar:{weeklyTotal:0}
 } as unknown as GovernmentWorld
 render(<PlayerOnboarding world={world}/>)
 expect(screen.getByText(/Programa fundacional: 1 de 10/)).toHaveTextContent('○')
 expect(screen.getByText(/Programa nacional de reformas: 1 de 18/)).toHaveTextContent('○')
 expect(screen.queryByText(/Programa fundacional: 1 de 28/)).not.toBeInTheDocument()
})
