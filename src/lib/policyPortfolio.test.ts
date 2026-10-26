import { describe, expect, it } from 'vitest'
import { buildPolicyPortfolio, portfolioKey } from './policyPortfolio'
import type { Dossier, DossierOption, DecisionEvent } from './types'

const dossier = (id: string, chapter: Dossier['programme_chapter'] = 'founding',
  version = 1, release_kind: Dossier['release_kind'] = 'intro'): Dossier => ({
  id, title: id, context: 'Fiction', category: 'National',
  version, release_kind, programme_chapter: chapter, programme_order: 1,
  available_from: null, available_until: null
})
const option = (id: string, dossier_id: string, treasury_delta_m_eur: number, version = 1): DossierOption => ({
  dossier_id, dossier_version: version, id, title: id, description: 'Measure',
  treasury_delta_m_eur, policy_target: 50, response_intensity: 1, trust_base_delta: 0
})
const event = (id: string, version = 1): DecisionEvent => ({
  id: id + '-event', government_id: 'government', dossier_id: id,
  dossier_version: version, option_id: 'choice', dossier_title_snapshot: id,
  option_title_snapshot: 'choice', engine_version: 'test', decided_on: '2026-10-26',
  created_at: '2026-10-26T10:00:00Z',
  state_before: { treasury_m_eur: 100, approval: 50, trust: 50 },
  state_after: { treasury_m_eur: 90, approval: 55, trust: 40 },
  cohort_effects: [],
  parameters_snapshot: { treasury_delta_m_eur: -10,
    policy_target: 50, response_intensity: 1, trust_base_delta: 0 }
})
describe('authoritative national programme portfolio', () => {
  const catalogue = [dossier('energy'), dossier('pension', 'society'),
    dossier('industry', 'economy'), dossier('courts', 'institutions'),
    dossier('drought', 'resilience'), dossier('news', null, 1, 'weekly')]
  const options = [option('a', 'energy', -25), option('b', 'energy', 20),
    option('c', 'pension', -40), option('d', 'industry', 10),
    option('e', 'courts', -2), option('f', 'drought', 0), option('n', 'news', 99999)]
  it('excludes weekly journalism from permanent portfolio and orders all five chapters', () => {
    const result = buildPolicyPortfolio(catalogue, options, [], '2026-10-26', {}, 100)
    expect(result.cases.map(item => item.dossier.id)).toEqual([
      'energy', 'pension', 'industry', 'courts', 'drought'])
    expect(result.chapters.map(ch => ch.total)).toEqual([1,1,1,1,1,0])
    expect(result.available).toBe(5)
    expect(result.total).toBe(5)
  })
  it('models only explicitly selected options and recalculates an aggregate fiscal envelope', () => {
    const picks = { 'energy:1': 'a', 'pension:1': 'c', 'industry:1': 'd' }
    const result = buildPolicyPortfolio(catalogue, options, [], '2026-10-26', picks, 200)
    expect(result.selected).toBe(3)
    expect(result.selectedFiscalDelta).toBe(-55)
    expect(result.projectedTreasury).toBe(145)
    expect(result.hasFiscalDeficit).toBe(false)
  })
  it('correctly identifies risk without calculating fake social or electoral outcomes', () => {
    const r = buildPolicyPortfolio(catalogue, options, [], '2026-10-26', {
      'energy:1': 'a', 'pension:1': 'c'
    }, 50)
    expect(r.projectedTreasury).toBe(-15)
    expect(r.hasFiscalDeficit).toBe(true)
  })
  it('never counts signed acts as still pending even if a stale plan remains in memory', () => {
    const r = buildPolicyPortfolio(catalogue, options, [event('pension')],
      '2026-10-26', { 'pension:1': 'c', 'industry:1': 'd' }, 100)
    expect(r.signed).toBe(1)
    expect(r.selected).toBe(1)
    expect(r.selectedFiscalDelta).toBe(10)
    expect(r.available).toBe(4)
    expect(r.chapters.find(c => c.id === 'society')?.signed).toBe(1)
  })
  it('rejects unavailable future and expired dossiers without trusting browser picks', () => {
    const future = { ...dossier('future'), available_from: '2026-11-01' }
    const past = { ...dossier('past'), available_until: '2026-10-20' }
    const r = buildPolicyPortfolio([future, past], [option('x', 'future', -80),
      option('y', 'past', -90)], [], '2026-10-26',
      { 'future:1': 'x', 'past:1': 'y' }, 100)
    expect(r.selected).toBe(0)
    expect(r.available).toBe(0)
    expect(r.projectedTreasury).toBe(100)
  })
  it('does not permit stale option IDs or options from another dossier version', () => {
    const d = dossier('energy', 'founding', 2)
    const r = buildPolicyPortfolio([d], [
      option('old', 'energy', -100, 1), option('correct', 'energy', 15, 2)
    ], [], '2026-10-26', { [portfolioKey(d)]: 'old' }, 100)
    expect(r.selected).toBe(0)
    expect(r.cases[0].options).toHaveLength(1)
    expect(buildPolicyPortfolio([d], [option('correct', 'energy', 15, 2)], [],
      '2026-10-26', { [portfolioKey(d)]: 'correct' }, 100).selectedFiscalDelta).toBe(15)
  })
  it('never marks a revised dossier as signed from an unrelated version', () => {
    const r = buildPolicyPortfolio([dossier('energy', 'founding', 2)], [],
      [event('energy', 1)], '2026-10-26', {}, 100)
    expect(r.signed).toBe(0)
  })
  it('does not raise a draft warning when a government already has negative treasury but no measures are chosen', () => {
    const result = buildPolicyPortfolio(catalogue, options, [], '2026-10-26', {}, -50)
    expect(result.hasFiscalDeficit).toBe(false)
    expect(result.projectedTreasury).toBe(-50)
  })
  it('does not mutate server objects or option arrays', () => {
    const original = [...catalogue]
    const r = buildPolicyPortfolio(catalogue, options, [], '2026-10-26', {}, 100)
    expect(catalogue).toEqual(original)
    expect(r.cases[0].options).toEqual(options.slice(0,2))
  })
})

