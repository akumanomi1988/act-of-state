import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { MatchWorld } from './lib/multiplayer'
import type { Dossier, DecisionEvent } from './lib/types'
import MatchAgendaBoard from './MatchAgendaBoard'

const host='10000000-0000-4000-8000-000000000001'
const guest='10000000-0000-4000-8000-000000000002'
const base=(id:string,release_kind:Dossier['release_kind']='intro'):Dossier => ({
  id,version:1,title:'Medida '+id,context:'Ficción',category:'Economía',release_kind,
  available_from:release_kind==='weekly'?'2026-10-19':null,
  available_until:release_kind==='weekly'?'2026-10-25':null
})
function makeWorld():MatchWorld {
  return {
    match:{id:'m',title:'Partida',status:'active',host_user_id:host,
      government_id:'g',invite_code:'a'.repeat(32),created_at:'2026-10-18',
      started_at:'2026-10-19',is_public:false,readiness_required:false,max_players:10},
    me:{match_id:'m',user_id:guest,seat_no:2,party_name:'Oposición',manifesto_policy:50,
      mandate_seats:10,joined_at:'2026-10-19',is_ready:true},
    gameDay:'2026-10-25',players:[],
    government:{id:'g',owner_id:host,country_name:'Arcadia',treasury_m_eur:12000,
      approval:50,trust:50,created_at:'2026-10-19',updated_at:'2026-10-19'},
    dossiers:[base('energy'),base('health'),base('news','weekly')],
    options:[],cohorts:[],events:[],stances:[]
  }
}
afterEach(cleanup)
describe('role-centric multiplayer political agenda',()=>{
  it('shows real published weekly first and honest empty editorial weeks',()=>{
    const world=makeWorld();const onSelect=vi.fn()
    render(<MatchAgendaBoard world={world} userId={guest}
      selectedDossierId="energy" onSelect={onSelect}/>)
    const section=screen.getByRole('region',{name:'Centro de decisiones de la asamblea'})
    const buttons=within(section).getAllByRole('button',{name:/Medida /})
    expect(buttons.map(b=>b.textContent)).toEqual([
      expect.stringContaining('Medida news'),
      expect.stringContaining('Medida energy'),
      expect.stringContaining('Medida health')
    ])
    expect(screen.getByText('0 / 1 firmados')).toBeInTheDocument()
    expect(screen.getByText('0 / 2 firmados')).toBeInTheDocument()
    expect(screen.getByText('Partido de oposición')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Ir al siguiente asunto pendiente'}))
    expect(onSelect).toHaveBeenCalledWith('news')
  })

  it('separates personal stances from binding acts and lets player select the pending list',()=>{
    const world=makeWorld();const onSelect=vi.fn()
    world.stances=[{match_id:'m',user_id:guest,dossier_id:'news',dossier_version:1,
      option_id:'x',policy_affinity:35,engine_version:'policy-affinity-v1',
      created_at:'2026-10-25'}]
    render(<MatchAgendaBoard world={world} userId={guest}
      selectedDossierId="news" onSelect={onSelect}/>)
    expect(screen.getByText('0 / 1 firmados')).toBeInTheDocument()
    expect(screen.getByText('1 posiciones tuyas')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Mis asuntos pendientes'}))
    expect(screen.queryByRole('button',{name:/Medida news/})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Medida energy/}))
    expect(onSelect).toHaveBeenCalledWith('energy')
    fireEvent.click(screen.getByRole('button',{name:'Decisiones firmadas'}))
    expect(screen.getByText(/No existen asuntos para este filtro/)).toBeInTheDocument()
  })

  it('uses immutable server decisions to render signed content, never a presumed mandate',()=>{
    const world=makeWorld()
    world.events=[{id:'e1',government_id:'g',dossier_id:'news',dossier_version:1,
      option_id:'x',dossier_title_snapshot:'Medida news',option_title_snapshot:'Opción',
      engine_version:'weighted-cohorts-v1',decided_on:'2026-10-25',created_at:'2026-10-25',
      state_before:{treasury_m_eur:12000,approval:50,trust:50},
      state_after:{treasury_m_eur:11000,approval:55,trust:52},
      cohort_effects:[],parameters_snapshot:{treasury_delta_m_eur:-1000,
        policy_target:25,response_intensity:30,trust_base_delta:1}} satisfies DecisionEvent]
    render(<MatchAgendaBoard world={world} userId={host}
      selectedDossierId="news" onSelect={vi.fn()}/>)
    expect(screen.getByText('1 / 1 firmados')).toBeInTheDocument()
    expect(screen.getByText('Gobierno ejecutivo')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Decisiones firmadas'}))
    expect(screen.getByRole('button',{name:/Medida news/})).toHaveTextContent('DECISIÓN FIRMADA')
    expect(screen.queryByRole('button',{name:/Medida energy/})).not.toBeInTheDocument()
  })

  it('communicates lack of editorial publication instead of inventing news',()=>{
    const world=makeWorld(); world.dossiers=world.dossiers.filter(x=>x.release_kind==='intro')
    render(<MatchAgendaBoard world={world} userId={guest}
      selectedDossierId={null} onSelect={vi.fn()}/>)
    expect(screen.getByText(/No hay una agenda semanal aprobada/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Esta semana'}))
    expect(screen.getByText(/No existen asuntos para este filtro/)).toBeInTheDocument()
  })
  it('shows permanent four-chapter reform mandates alongside unchanged founding and weekly acts',()=>{
    const world=makeWorld()
    world.dossiers.push(
      {...base('care'),programme_chapter:'society',programme_order:1},
      {...base('jobs'),programme_chapter:'economy',programme_order:1},
      {...base('courts'),programme_chapter:'institutions',programme_order:1},
      {...base('drought'),programme_chapter:'resilience',programme_order:1}
    )
    const navigate=vi.fn()
    render(<MatchAgendaBoard world={world} userId={guest}
      selectedDossierId={null} onSelect={navigate}/>)
    expect(screen.getByText('0 / 4 firmados')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Reformas'}))
    expect(screen.getAllByRole('button',{name:/REFORMA FICTICIA/})).toHaveLength(4)
    fireEvent.click(screen.getByRole('button',{name:'Sociedad'}))
    expect(screen.getByRole('button',{name:/Medida care/})).toBeInTheDocument()
    expect(screen.queryByRole('button',{name:/Medida jobs/})).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:/Medida care/}))
    expect(navigate).toHaveBeenCalledWith('care')
    fireEvent.click(screen.getByRole('button',{name:'Esta semana'}))
    expect(screen.getByRole('button',{name:/Medida news/})).toBeInTheDocument()
  })

  it('renders an actionable English role-scoped agenda without altering signed decisions',()=>{
    const world=makeWorld(),choose=vi.fn()
    render(<MatchAgendaBoard world={world} userId={guest}
      selectedDossierId={null} onSelect={choose} language="en"/>)
    const panel=screen.getByRole('region',{name:'Assembly decision centre'})
    expect(within(panel).getByRole('heading',{name:'Political council'})).toBeInTheDocument()
    expect(within(panel).getByText('Opposition party')).toBeInTheDocument()
    expect(within(panel).getByText('POLITICAL WEEK')).toBeInTheDocument()
    expect(within(panel).getByRole('button',{name:'This week'})).toBeInTheDocument()
    fireEvent.click(within(panel).getByRole('button',{name:'This week'}))
    const original=within(panel).getByRole('button',{name:/Medida news/})
    expect(original).toHaveTextContent('Original editorial title (Spanish)')
    expect(original).toHaveTextContent('PENDING')
    fireEvent.click(original)
    expect(choose).toHaveBeenCalledWith('news')
    expect(world.events).toHaveLength(0)
    expect(world.stances).toHaveLength(0)
  })
  it('does not replace unpublished editorials with fiction in English',()=>{
    const world=makeWorld()
    world.dossiers=world.dossiers.filter(d=>d.release_kind!=='weekly')
    render(<MatchAgendaBoard world={world} userId={guest}
      selectedDossierId={null} language="en" onSelect={vi.fn()} />)
    expect(screen.getByText(/No weekly editorial slate is approved/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'This week'}))
    expect(screen.getByText(/No items match this filter/)).toBeInTheDocument()
  })

  it('offers diplomatic treaty filtering in both languages, without inventing an enactment',()=>{
    const w=makeWorld()
    w.dossiers.push({...base('diplomacy-europe'),programme_chapter:'diplomacy',
      programme_order:1,title:'European treaty'})
    const action=vi.fn()
    render(<MatchAgendaBoard world={w} userId={guest} language="en"
      selectedDossierId={null} onSelect={action}/>)
    fireEvent.click(screen.getByRole('button',{name:'Diplomacy'}))
    const treaty=screen.getByRole('button',{name:/European treaty/})
    expect(treaty).toHaveTextContent('PENDING')
    expect(screen.queryByRole('button',{name:/Medida news/})).toBeNull()
    fireEvent.click(treaty)
    expect(action).toHaveBeenCalledWith('diplomacy-europe')
    expect(w.events).toHaveLength(0)
  })

})
