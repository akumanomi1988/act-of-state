import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { DecisionEvent, Dossier, GovernmentWorld } from './lib/types'
import FoundationalAgendaPanel, { foundationalProgress, isAvailable } from './FoundationalAgendaPanel'

const ids = [
  'energy-resilience','water-security','housing-access','health-capacity',
  'education-future','mobility-network','employment-transition','food-resilience',
  'digital-sovereignty','climate-adaptation'
]

function intro(id: string): Dossier {
  return { id, version: 1, title: 'Expediente ' + id, context: 'Escenario de prueba',
    category: 'Política', release_kind: 'intro', available_from: null, available_until: null }
}

function decision(id: string, before: number, after: number): DecisionEvent {
  return {
    id: 'event-' + id, government_id: 'gov-one',
    dossier_id: id, dossier_version: 1, option_id: 'option-1',
    dossier_title_snapshot: 'Expediente ' + id, option_title_snapshot: 'Primera medida',
    engine_version: 'weighted-cohorts-v1', decided_on: '2026-10-25',
    created_at: '2026-10-25T00:00:00Z',
    state_before: { treasury_m_eur: before, approval: 50, trust: 53 },
    state_after: { treasury_m_eur: after, approval: 55, trust: 51 },
    cohort_effects: [], parameters_snapshot: {
      treasury_delta_m_eur: after-before, policy_target: 25, response_intensity: 25,
      trust_base_delta: 1
    }
  }
}

function world(events: DecisionEvent[] = [], dossiers: Dossier[] = ids.map(intro)): GovernmentWorld {
  return {
    gameDay: '2026-10-25',
    government: { id: 'gov-one', owner_id: 'owner-one',
      country_name: 'República de Arcadia',
      treasury_m_eur: 999999, approval: 4, trust: 5,
      created_at: '2026-10-25T00:00:00Z', updated_at: '2026-10-25T00:00:00Z' },
    calendar: { weekStart: '2026-10-19', friday: '2026-10-23',
      dayOfWeek: 7, fridayReached: true, weeklyTotal: 0, weeklyResolved: 0,
      weeklyTreasuryDeltaM: 0 },
    dossiers, options: [], cohorts: [], events
  }
}

afterEach(() => cleanup())

describe('official founding programme and source-of-truth agenda', () => {
  it('counts the ten official authored government dossiers and resumes first pending choice', () => {
    const onSelect = vi.fn()
    render(<FoundationalAgendaPanel world={world()} selectedKey="energy-resilience:1" onSelect={onSelect} />)
    expect(screen.getByText('0 / 10')).toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Decisiones del programa firmadas' }))
      .toHaveAttribute('aria-valuemax', '10')
    expect(screen.getAllByRole('button', { name: /FICTICIO/ })).toHaveLength(10)
    fireEvent.click(screen.getByRole('button', { name: /Continuar programa/ }))
    expect(onSelect).toHaveBeenCalledWith(intro('energy-resilience'))
    expect(screen.queryByLabelText('Impactos acumulados de las decisiones fundacionales'))
      .not.toBeInTheDocument()
  })

  it('totals signed per-act deltas, not asynchronous current state', () => {
    const events = [decision('energy-resilience', 12000, 10800),
      decision('housing-access', 10600, 10150)]
    const result = foundationalProgress(ids.map(intro), events)
    expect(result).toMatchObject({
      total: 10, completed: 2, treasuryDelta: -1650, approvalDelta: 10,
      trustDelta: -4
    })
    expect(result.next?.id).toBe('water-security')
    render(<FoundationalAgendaPanel world={world(events)} selectedKey={null} onSelect={vi.fn()} />)
    expect(screen.getByText('2 / 10')).toBeInTheDocument()
    const impacts = screen.getByLabelText('Impactos acumulados de las decisiones fundacionales')
    expect(impacts).toHaveTextContent('-1.650 M€')
    expect(impacts).toHaveTextContent('+10 pp')
    expect(impacts).toHaveTextContent('-4 pp')
    expect(impacts).not.toHaveTextContent('999.999')
    expect(screen.getByText(/no incluye la evolución diaria/)).toBeInTheDocument()
  })

  it('keeps the weekly editorial agenda above permanent dossiers, with effective filters', () => {
    const onSelect = vi.fn()
    const weekly: Dossier = {
      ...intro('weekly-2026-10-19'), release_kind: 'weekly',
      title: 'Expediente semanal urgente', available_from: '2026-10-19'
    }
    render(<FoundationalAgendaPanel world={world(
      [decision('energy-resilience', 12000, 10800)],
      [intro('energy-resilience'),intro('water-security'),weekly]
    )} selectedKey="water-security:1" onSelect={onSelect}/>)
    const region = screen.getByRole('region', { name: 'Programa político y expedientes' })
    const names = within(region).getAllByRole('button').map(button => button.textContent ?? '')
    const indexWeekly = names.findIndex(label => label.includes('Expediente semanal urgente'))
    const indexIntro = names.findIndex(label => label.includes('Expediente water-security'))
    expect(indexWeekly).toBeGreaterThanOrEqual(0)
    expect(indexWeekly).toBeLessThan(indexIntro)
    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
    expect(screen.getByRole('button', { name: /Expediente semanal urgente/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /V1.*Expediente water-security/ })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Firmados' }))
    expect(screen.getByRole('button', { name: /Expediente energy-resilience.*FIRMADO/ })).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Pendientes' }))
    expect(screen.queryByRole('button', { name: /Expediente energy-resilience.*FIRMADO/ }))
      .not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Expediente water-security.*PENDIENTE/ })).toBeInTheDocument()
  })

  it('does not claim future or expired weekly dossiers are playable', () => {
    const base = intro('future-week')
    expect(isAvailable({ ...base, release_kind:'weekly',available_from:'2026-10-26' },
      '2026-10-25')).toBe(false)
    expect(isAvailable({ ...base, available_until: '2026-10-24' },'2026-10-25')).toBe(false)
    expect(isAvailable(base,'2026-10-25')).toBe(true)
  })

  it('displays a terminal official-mandate state without inventing a win or election', () => {
    const events = ids.map((id,i) => decision(id,12000-i*100,11900-i*100))
    render(<FoundationalAgendaPanel world={world(events)} selectedKey={null} onSelect={vi.fn()} />)
    expect(screen.getByText('10 / 10')).toBeInTheDocument()
    expect(screen.getByText(/Programa inicial completado/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Continuar programa/ })).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar', { name: 'Decisiones del programa firmadas' }))
      .toHaveAttribute('aria-valuenow','10')
  })

  it('shows an explicit empty filter state without fabricating editorial publication', () => {
    render(<FoundationalAgendaPanel world={world()} selectedKey={null} onSelect={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: 'Esta semana' }))
    expect(screen.getByRole('status')).toHaveTextContent('No hay expedientes para este filtro')
  })
  it('displays 10 unchanged founding cases plus 18 reforms without claiming news publication',()=>{
    const chapters=['society','economy','institutions','resilience'] as const
    const reforms=Array.from({length:18},(_,i)=>({
      ...intro('reform-'+i),title:'Reforma nacional '+i,
      programme_chapter:chapters[Math.floor(i/5)===3?3:Math.floor(i/5)],
      programme_order:i%5+1
    }))
    const dossierList=[...ids.map(intro),...reforms]
    const navigate=vi.fn()
    render(<FoundationalAgendaPanel world={world([],dossierList)}
      selectedKey={null} onSelect={navigate}/>)
    expect(screen.getByText('0 / 10')).toBeInTheDocument()
    expect(screen.getByText('0 / 18')).toBeInTheDocument()
    expect(screen.getByRole('progressbar',{name:'Decisiones del programa firmadas'}))
      .toHaveAttribute('aria-valuemax','10')
    expect(screen.getByRole('progressbar',{name:'Decisiones de reforma firmadas'}))
      .toHaveAttribute('aria-valuemax','18')
    expect(screen.getAllByRole('button',{name:/REFORMA FICTICIA/})).toHaveLength(18)
    fireEvent.click(screen.getByRole('button',{name:'Abrir capítulo Sociedad'}))
    expect(screen.getAllByRole('button',{name:/REFORMA FICTICIA/})).toHaveLength(5)
    fireEvent.click(screen.getByRole('button',{name:/Continuar reformas:/}))
    expect(navigate).toHaveBeenCalledWith(reforms[0])
    expect(screen.getAllByRole('button',{name:/REFORMA FICTICIA/})).toHaveLength(18)
    fireEvent.click(screen.getByRole('button',{name:'Esta semana'}))
    expect(screen.getByText(/No hay expedientes para este filtro/)).toBeInTheDocument()
  })

  it('uses separate signed founding and reform counters after independent immutable acts',()=>{
    const chapters=['society','economy','institutions','resilience'] as const
    const reforms=Array.from({length:18},(_,i)=>({
      ...intro('reform-'+i),
      programme_chapter:chapters[Math.floor(i/5)===3?3:Math.floor(i/5)],
      programme_order:i%5+1
    }))
    const dossierList=[...ids.map(intro),...reforms]
    render(<FoundationalAgendaPanel world={world(
      [decision('energy-resilience',12000,11700),
       decision('reform-0',11700,11900)],dossierList)}
      selectedKey={null} onSelect={vi.fn()}/>)
    expect(screen.getByText('1 / 10')).toBeInTheDocument()
    expect(screen.getByText('1 / 18')).toBeInTheDocument()
    const signed=screen.getByLabelText('Impactos acumulados de las decisiones fundacionales')
    expect(signed).toHaveTextContent('-300 M€')
    expect(signed).not.toHaveTextContent('200 M€')
    fireEvent.click(screen.getByRole('button',{name:'Reformas nacionales'}))
    expect(screen.getAllByRole('button',{name:/REFORMA FICTICIA/})).toHaveLength(18)
    fireEvent.click(screen.getByRole('button',{name:'Firmados'}))
    expect(screen.getAllByRole('button',{name:/FIRMADO/})).toHaveLength(2)
  })

  it('keeps a newly published version pending when only the old version is signed',()=>{
    const v2={...intro('energy-resilience'),version:2,title:'Updated energy'}
    const onSelect=vi.fn()
    render(<FoundationalAgendaPanel
      world={world([decision('energy-resilience',12000,11700)],[v2])}
      selectedKey={null} onSelect={onSelect}/>)
    expect(screen.getByRole('button',{name:/Updated energy/})).toHaveTextContent('PENDIENTE')
    fireEvent.click(screen.getByRole('button',{name:'Firmados'}))
    expect(screen.queryByRole('button',{name:/Updated energy/})).toBeNull()
    fireEvent.click(screen.getByRole('button',{name:'Pendientes'}))
    fireEvent.click(screen.getByRole('button',{name:/Updated energy/}))
    expect(onSelect).toHaveBeenCalledWith(v2)
  })

})
