import type { DecisionEvent } from './types'

export type HistoryPeriod = 'all' | '7d' | '30d'
export type HistoryMetric = 'treasury' | 'approval' | 'trust'

export interface DecisionImpact {
  event: DecisionEvent
  treasury: number
  approval: number
  trust: number
}

export interface CohortImpact {
  code: string
  label: string
  populationWeight: number
  support: number
  trust: number
  decisions: number
}

export interface DecisionHistoryAnalysis {
  rows: DecisionImpact[]
  totals: Record<HistoryMetric, number>
  cohorts: CohortImpact[]
}

function cutoffDay(gameDay: string, days: number): string | null {
  const milliseconds = Date.parse(gameDay + 'T00:00:00Z')
  if (!Number.isFinite(milliseconds)) return null
  return new Date(milliseconds - (days - 1) * 86_400_000).toISOString().slice(0, 10)
}

/**
 * Summarizes immutable server-authored decision snapshots. Fiscal weekly acts,
 * elections and other autonomous changes are intentionally excluded: they
 * must never be misattributed to cabinet signatures.
 */
export function analyzeDecisionHistory(
  events: readonly DecisionEvent[], gameDay: string, period: HistoryPeriod
): DecisionHistoryAnalysis {
  const cutoff = period === 'all' ? null : cutoffDay(gameDay, period === '7d' ? 7 : 30)
  const ordered = events.filter(event =>
    !cutoff || (event.decided_on >= cutoff && event.decided_on <= gameDay)
  ).slice().sort((a, b) =>
    a.decided_on.localeCompare(b.decided_on) ||
    a.created_at.localeCompare(b.created_at) ||
    a.id.localeCompare(b.id)
  )
  const totals: Record<HistoryMetric, number> = { treasury: 0, approval: 0, trust: 0 }
  const cohortMap = new Map<string, CohortImpact>()
  const rows = ordered.map(event => {
    const row: DecisionImpact = {
      event,
      treasury: event.state_after.treasury_m_eur - event.state_before.treasury_m_eur,
      approval: event.state_after.approval - event.state_before.approval,
      trust: event.state_after.trust - event.state_before.trust
    }
    totals.treasury += row.treasury
    totals.approval += row.approval
    totals.trust += row.trust
    for (const effect of event.cohort_effects) {
      const previous = cohortMap.get(effect.code) ?? {
        code: effect.code, label: effect.label,
        populationWeight: effect.population_weight,
        support: 0, trust: 0, decisions: 0
      }
      previous.support += effect.support_after - effect.support_before
      previous.trust += effect.trust_after - effect.trust_before
      previous.decisions += 1
      cohortMap.set(effect.code, previous)
    }
    return row
  })
  const cohorts = [...cohortMap.values()].sort((a, b) =>
    Math.abs(b.support) - Math.abs(a.support) || a.label.localeCompare(b.label)
  )
  return { rows, totals, cohorts }
}
