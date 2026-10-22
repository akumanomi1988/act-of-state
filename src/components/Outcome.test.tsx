import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import Outcome from './Outcome'
import type { DecisionEvent } from '../lib/types'

const persisted: DecisionEvent = {
  id: 'event-123', government_id: 'government-123',
  dossier_id: 'energy-resilience', dossier_version: 1,
  option_id: 'household-support', engine_version: 'weighted-cohorts-v1',
  decided_on: '2026-10-22', created_at: '2026-10-22T00:00:00Z',
  parameters_snapshot: { treasury_delta_m_eur: -1400, policy_target: 25, response_intensity: 35, trust_base_delta: 2 },
  state_before: { treasury_m_eur: 12000, approval: 50, trust: 50 },
  state_after: { treasury_m_eur: 10600, approval: 62, trust: 58 },
  cohort_effects: [
    { code: 'households', label: 'Hogares y trabajadores', population_weight: 65,
      support_before: 50, support_after: 68, trust_before: 50, trust_after: 61 }
  ]
}

describe('persisted political outcome', () => {
  it('renders server-provided state transitions and cohort response', () => {
    render(<Outcome event={persisted} optionTitle="Proteger a los hogares" />)
    const result = screen.getByTestId('persisted-outcome')
    expect(result).toHaveTextContent('10.600 M€')
    expect(result).toHaveTextContent('-1.400 M€')
    expect(result).toHaveTextContent('62%')
    expect(result).toHaveTextContent('Hogares y trabajadores')
    expect(result).toHaveTextContent('68%')
    expect(result).toHaveTextContent('weighted-cohorts-v1')
  })
})
