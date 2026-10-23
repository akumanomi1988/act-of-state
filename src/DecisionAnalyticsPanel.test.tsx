import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import type { DecisionEvent } from './lib/types'
import DecisionAnalyticsPanel from './DecisionAnalyticsPanel'

const event: DecisionEvent = {
  id: 'e1', government_id: 'g', dossier_id: 'd1', dossier_version: 1,
  option_id: 'o1', dossier_title_snapshot: 'National energy plan',
  option_title_snapshot: 'Household relief', engine_version: 'weighted-cohorts-v1',
  decided_on: '2026-10-01', created_at: '2026-10-01T10:00:00Z',
  state_before: { treasury_m_eur: 10000, approval: 50, trust: 50 },
  state_after: { treasury_m_eur: 9000, approval: 60, trust: 54 },
  parameters_snapshot: { treasury_delta_m_eur: -1000, policy_target: 25,
    response_intensity: 30, trust_base_delta: 2 },
  cohort_effects: [{ code: 'workers', label: 'Workers', population_weight: 60,
    support_before: 50, support_after: 65, trust_before: 50, trust_after: 56 }]
}
const recent: DecisionEvent = {
  ...event, id: 'e2', dossier_id: 'd2', option_id: 'o2',
  dossier_title_snapshot: 'National water plan',
  option_title_snapshot: 'Reservoir investment',
  decided_on: '2026-10-23', created_at: '2026-10-23T10:00:00Z',
  state_before: { treasury_m_eur: 5000, approval: 58, trust: 51 },
  state_after: { treasury_m_eur: 5300, approval: 53, trust: 54 }
}

afterEach(cleanup)

describe('national strategic archive', () => {
  it('shows lifetime signed impacts and keeps detail collapsed until requested', () => {
    render(<DecisionAnalyticsPanel events={[recent, event]} gameDay="2026-10-23"
      countryName="Arcadia" />)
    const archive = screen.getByRole('region', { name: 'Archivo estratégico nacional' })
    expect(archive).toHaveTextContent('2')
    expect(archive).toHaveTextContent('-700 M€')
    expect(archive).toHaveTextContent('+5 pp')
    expect(archive).toHaveTextContent('+7 pp')
    expect(screen.queryByRole('region', { name: 'Detalle de la decisión seleccionada' }))
      .not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Explorar impacto' }))
    expect(screen.getByRole('button', { name: 'Cerrar análisis' }))
      .toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('region', { name: 'Detalle de la decisión seleccionada' }))
      .toHaveTextContent('National water plan')
  })

  it('filters by server day, switches metric and inspects historical snapshots', () => {
    render(<DecisionAnalyticsPanel events={[recent, event]} gameDay="2026-10-23"
      countryName="Arcadia" />)
    fireEvent.click(screen.getByRole('button', { name: 'Explorar impacto' }))
    const detail = screen.getByRole('region', { name: 'Detalle de la decisión seleccionada' })
    fireEvent.click(screen.getByRole('button', { name: /Household relief/ }))
    expect(detail).toHaveTextContent('National energy plan')
    expect(detail).toHaveTextContent('10.000 → 9.000 M€')
    expect(detail).toHaveTextContent('Workers')
    fireEvent.click(screen.getByRole('radio', { name: '7 días' }))
    expect(screen.queryByRole('button', { name: /Household relief/ }))
      .not.toBeInTheDocument()
    expect(within(detail).getByText('National water plan')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('radio', { name: 'Tesorería' }))
    expect(screen.getByRole('region', { name: 'Cronología de impactos' }))
      .toHaveTextContent('+300 M€')
  })

  it('offers an honest empty period instead of fabricated trends', () => {
    render(<DecisionAnalyticsPanel events={[event]} gameDay="2026-10-23"
      countryName="Arcadia" />)
    fireEvent.click(screen.getByRole('button', { name: 'Explorar impacto' }))
    fireEvent.click(screen.getByRole('radio', { name: '7 días' }))
    expect(screen.getByRole('status')).toHaveTextContent('No hay decisiones')
  })
})
