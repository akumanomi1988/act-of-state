import { describe, expect, it } from 'vitest'
import type { DecisionEvent } from './types'
import { analyzeDecisionHistory } from './decisionAnalytics'

const first: DecisionEvent = {
  id: 'first', government_id: 'g', dossier_id: 'd1', dossier_version: 1,
  option_id: 'o1', dossier_title_snapshot: 'Energy', option_title_snapshot: 'Support',
  engine_version: 'weighted-cohorts-v1', decided_on: '2026-10-01',
  created_at: '2026-10-01T10:00:00Z',
  state_before: { treasury_m_eur: 10000, approval: 50, trust: 50 },
  state_after: { treasury_m_eur: 9000, approval: 60, trust: 54 },
  parameters_snapshot: { treasury_delta_m_eur: -1000, policy_target: 25,
    response_intensity: 30, trust_base_delta: 2 },
  cohort_effects: [{ code: 'workers', label: 'Workers', population_weight: 60,
    support_before: 50, support_after: 65, trust_before: 50, trust_after: 56 }]
}
const second: DecisionEvent = {
  ...first, id: 'second', dossier_id: 'd2', option_id: 'o2',
  dossier_title_snapshot: 'Water', option_title_snapshot: 'Infrastructure',
  decided_on: '2026-10-23', created_at: '2026-10-23T10:00:00Z',
  // The gap between events represents autonomous fiscal settlement. It must
  // not be included in the direct impact of either signed decision.
  state_before: { treasury_m_eur: 5000, approval: 58, trust: 51 },
  state_after: { treasury_m_eur: 5300, approval: 53, trust: 54 },
  cohort_effects: [{ code: 'workers', label: 'Workers', population_weight: 60,
    support_before: 62, support_after: 58, trust_before: 53, trust_after: 55 }]
}

describe('immutable cabinet decision history', () => {
  it('orders events without mutating server response and excludes autonomous gaps', () => {
    const events = [second, first]
    const result = analyzeDecisionHistory(events, '2026-10-23', 'all')
    expect(events[0]).toBe(second)
    expect(result.rows.map(row => row.event.id)).toEqual(['first', 'second'])
    expect(result.totals).toEqual({ treasury: -700, approval: 5, trust: 7 })
    expect(result.rows[1].treasury).toBe(300)
  })

  it('filters by the authoritative game day, not browser time', () => {
    expect(analyzeDecisionHistory([first, second], '2026-10-23', '7d')
      .rows.map(row => row.event.id)).toEqual(['second'])
    expect(analyzeDecisionHistory([first, second], '2026-10-23', '30d')
      .rows).toHaveLength(2)
    expect(analyzeDecisionHistory([first], '2026-10-23', '7d')
      .totals.treasury).toBe(0)
  })

  it('aggregates recorded cohort changes without calling them current support', () => {
    const result = analyzeDecisionHistory([second, first], '2026-10-23', 'all')
    expect(result.cohorts).toEqual([{
      code: 'workers', label: 'Workers', populationWeight: 60,
      support: 11, trust: 8, decisions: 2
    }])
  })

  it('handles an empty archive', () => {
    expect(analyzeDecisionHistory([], '2026-10-23', 'all')).toEqual({
      rows: [], totals: { treasury: 0, approval: 0, trust: 0 }, cohorts: []
    })
  })
})
