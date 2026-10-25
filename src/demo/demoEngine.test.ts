import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEMO_CASES, DEMO_STORAGE_KEY, INITIAL_METRICS,
  applyDemoDecision, clearDemoProgress, emptyDemoProgress,
  evaluateDemo, loadDemoProgress, parseDemoProgress, saveDemoProgress
} from './demoEngine'

afterEach(() => {
  window.localStorage.clear()
  vi.restoreAllMocks()
})

describe('authoritative boundary: guest training only', () => {
  it('starts with a non-personal synthetic country and no decisions', () => {
    const state = evaluateDemo(emptyDemoProgress())
    expect(state.metrics).toEqual(INITIAL_METRICS)
    expect(state.history).toEqual([])
    expect(DEMO_CASES).toHaveLength(4)
    expect(DEMO_CASES.every(item => item.choices.length >= 3)).toBe(true)
  })

  it('records reproducible choices in the order submitted', () => {
    const first = applyDemoDecision(emptyDemoProgress(), 'energy', 'aid')
    const second = applyDemoDecision(first, 'housing', 'licenses')
    const one = evaluateDemo(first)
    const two = evaluateDemo(second)
    expect(one.metrics.treasury).toBe(6800)
    expect(one.metrics.approval).toBe(59)
    expect(one.metrics.trust).toBe(55)
    expect(one.history[0].before).toEqual(INITIAL_METRICS)
    expect(one.history[0].after).toEqual(one.metrics)
    expect(two.metrics.treasury).toBe(6550)
    expect(two.metrics.companies).toBe(60)
    expect(two.history.map(item => item.caseId)).toEqual(['energy', 'housing'])
    expect(evaluateDemo(second)).toEqual(two)
  })

  it('refuses unknown cases, options and second decisions', () => {
    expect(() => applyDemoDecision(emptyDemoProgress(), 'missing', 'aid')).toThrow('INVALID_OPTION')
    expect(() => applyDemoDecision(emptyDemoProgress(), 'energy', 'missing')).toThrow('INVALID_OPTION')
    const state = applyDemoDecision(emptyDemoProgress(), 'energy', 'aid')
    expect(() => applyDemoDecision(state, 'energy', 'grid')).toThrow('ALREADY_DECIDED')
  })

  it('bounds political support and trust without touching treasury', () => {
    const result = evaluateDemo({
      version: 1,
      decisions: [
        { caseId: 'energy', optionId: 'aid' },
        { caseId: 'housing', optionId: 'public' },
        { caseId: 'water', optionId: 'reservoir' },
        { caseId: 'health', optionId: 'staff' }
      ]
    })
    for (const key of ['approval', 'trust', 'households', 'companies'] as const)
      expect(result.metrics[key]).toBeGreaterThanOrEqual(0)
    expect(result.metrics.approval).toBeLessThanOrEqual(100)
    expect(result.metrics.trust).toBeLessThanOrEqual(100)
    expect(result.history).toHaveLength(4)
    expect(result.metrics.treasury).toBe(2500)
  })

  it('accepts valid stored choices and discards unknown IDs or repeats', () => {
    const progress = applyDemoDecision(emptyDemoProgress(), 'energy', 'grid')
    expect(parseDemoProgress(JSON.stringify(progress))).toEqual(progress)
    expect(parseDemoProgress(JSON.stringify({
      version: 1, decisions: [{ caseId: 'energy', optionId: 'grid' }, { caseId: 'energy', optionId: 'aid' }]
    }))).toEqual(emptyDemoProgress())
    expect(parseDemoProgress(JSON.stringify({
      version: 1, decisions: [{ caseId: 'energy', optionId: 'prototype' }]
    }))).toEqual(emptyDemoProgress())
    expect(parseDemoProgress(JSON.stringify({ version: 999, decisions: [] })))
      .toEqual(emptyDemoProgress())
    expect(parseDemoProgress('{broken json')).toEqual(emptyDemoProgress())
    expect(parseDemoProgress('x'.repeat(5000))).toEqual(emptyDemoProgress())
  })

  it('does not trust forged negative-money snapshots', () => {
    expect(() => evaluateDemo({ version: 1, decisions: [
      { caseId: 'energy', optionId: 'grid' },
      { caseId: 'housing', optionId: 'public' },
      { caseId: 'water', optionId: 'reservoir' },
      { caseId: 'health', optionId: 'staff' }
    ] })).not.toThrow()
    expect(parseDemoProgress(JSON.stringify({ version: 1,
      decisions: [{ caseId: 'energy', optionId: 'aid' }], metrics: { treasury: 999999 }
    })).decisions).toEqual([{ caseId: 'energy', optionId: 'aid' }])
  })

  it('stores only identifiers locally, resumes and resets without credentials', () => {
    const state = applyDemoDecision(emptyDemoProgress(), 'water', 'ration')
    expect(saveDemoProgress(state)).toBe(true)
    expect(window.localStorage.getItem(DEMO_STORAGE_KEY)).toBe(JSON.stringify(state))
    expect(loadDemoProgress()).toEqual(state)
    expect(clearDemoProgress()).toBe(true)
    expect(loadDemoProgress()).toEqual(emptyDemoProgress())
  })

  it('keeps the demo playable if browser storage is denied', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked') })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('blocked') })
    expect(loadDemoProgress()).toEqual(emptyDemoProgress())
    expect(saveDemoProgress(emptyDemoProgress())).toBe(false)
    expect(clearDemoProgress()).toBe(false)
    expect(evaluateDemo(applyDemoDecision(emptyDemoProgress(), 'water', 'ration')).metrics.approval).toBe(43)
  })

  it('requires schema-matching options, never a user-authored numeric effect', () => {
    const input = JSON.stringify({ version: 1, decisions: [{
      caseId: 'energy', optionId: 'aid', effects: { treasury: 1e9, approval: 100 }
    }] })
    const restored = parseDemoProgress(input)
    expect(evaluateDemo(restored).metrics.treasury).toBe(6800)
  })
})
