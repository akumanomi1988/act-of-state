import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import PolicyPortfolioPanel from './PolicyPortfolioPanel'
import type { DecisionEvent, Dossier, DossierOption } from './lib/types'

const d = (id: string, chapter: Dossier['programme_chapter'] = 'founding'): Dossier => ({
  id, version: 1, title: 'Expediente ' + id, context: 'Fiction',
  category: 'Test', release_kind: 'intro', programme_chapter: chapter,
  programme_order: 1, available_from: null, available_until: null
})
const o = (id: string, dossier_id: string, cost: number): DossierOption => ({
  id, dossier_id, dossier_version: 1, title: 'Opción ' + id,
  description: 'Política', treasury_delta_m_eur: cost,
  policy_target: 45, response_intensity: 1, trust_base_delta: 0
})
const dossiers = [d('energy'), d('pensions','society'), d('jobs','economy')]
const options = [o('cheap','energy', -25), o('income','energy',40),
  o('welfare','pensions',-80),o('jobs','jobs',-10)]
const signed: DecisionEvent = {
  id:'signed', government_id:'government', dossier_id:'energy', dossier_version:1,
  option_id:'cheap', dossier_title_snapshot:'Expediente energy',
  option_title_snapshot:'Opción cheap', engine_version:'test',
  decided_on:'2026-10-26',created_at:'2026-10-26T09:00:00Z',
  state_before:{treasury_m_eur:100,approval:50,trust:50},
  state_after:{treasury_m_eur:75,approval:48,trust:51},
  cohort_effects:[], parameters_snapshot:{
    treasury_delta_m_eur:-25,policy_target:45,response_intensity:1,trust_base_delta:0
  }
}
afterEach(cleanup)
const build = (props: Partial<Parameters<typeof PolicyPortfolioPanel>[0]> = {}) => {
  const onSelect = vi.fn()
  const view = render(<PolicyPortfolioPanel
    dossiers={dossiers} options={options} events={[]} gameDay="2026-10-26"
    treasury={100} mode="solo" onSelect={onSelect} {...props} />)
  return { ...view, onSelect }
}
describe('cross-mode strategic portfolio', () => {
  it('starts collapsed with trustworthy authoritative counters, not a fake commitment', () => {
    build()
    expect(screen.getByText('0/3')).toBeInTheDocument()
    expect(screen.getByText('3', {selector:'strong'})).toBeInTheDocument()
    expect(screen.queryByLabelText('Planificar Expediente energy')).not.toBeInTheDocument()
  })
  it('selects multiple options, recalculates fiscal exposure and clears the draft', () => {
    build()
    fireEvent.click(screen.getByRole('button',{name:'Abrir planificación'}))
    fireEvent.change(screen.getByLabelText('Planificar Expediente energy'),{target:{value:'cheap'}})
    fireEvent.change(screen.getByLabelText('Planificar Expediente pensions'),{target:{value:'welfare'}})
    expect(within(screen.getByLabelText('Medidas seleccionadas')).getAllByRole('listitem')).toHaveLength(2)
    expect(screen.getByText('-5 M€')).toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('supera la tesorería')
    fireEvent.change(screen.getByLabelText('Planificar Expediente energy'),{target:{value:'income'}})
    expect(screen.getByText('60 M€')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Vaciar borrador'}))
    expect(screen.getByText('0 M€')).toBeInTheDocument()
    expect(screen.queryByLabelText('Medidas seleccionadas')).not.toBeInTheDocument()
  })
  it('updates the financial draft when an authoritative event arrives', () => {
    const {rerender,onSelect}=build()
    fireEvent.click(screen.getByRole('button',{name:'Abrir planificación'}))
    fireEvent.change(screen.getByLabelText('Planificar Expediente energy'),{target:{value:'cheap'}})
    rerender(<PolicyPortfolioPanel dossiers={dossiers} options={options}
      events={[signed]} gameDay="2026-10-26" treasury={75} mode="solo"
      onSelect={onSelect} />)
    expect(screen.getByText('1/3')).toBeInTheDocument()
    expect(screen.queryByLabelText('Planificar Expediente energy')).not.toBeInTheDocument()
    expect(screen.getByText('0 M€')).toBeInTheDocument()
  })
  it('filters by chapter and navigates to the authoritative action screen', () => {
    const {onSelect} = build()
    fireEvent.click(screen.getByRole('button',{name:'Abrir planificación'}))
    fireEvent.click(screen.getByRole('button',{name:/Sociedad \(0\/1\)/}))
    expect(screen.getByLabelText('Planificar Expediente pensions')).toBeInTheDocument()
    expect(screen.queryByLabelText('Planificar Expediente energy')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button',{name:'Ver expediente'}))
    expect(onSelect).toHaveBeenCalledWith(dossiers[1])
  })
  it('enforces a visible Parliamentary procedural boundary without mutating the server', () => {
    build({mode:'parliament'})
    fireEvent.click(screen.getByRole('button',{name:'Abrir planificación'}))
    expect(screen.getByText(/no equivale a postura oficial, propuesta, voto ni ley/)).toBeInTheDocument()
  })
})

