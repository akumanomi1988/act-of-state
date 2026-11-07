import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import type { DecisionEvent, GovernmentWorld } from './types'
import {
  INTRO_CASES, MANDATE_SIZE, GUEST_STORAGE_KEY,
  emptyGuest, chooseGuest, evaluateGuest, parseGuest, electionResult,
  importGuest, GuestImportConflict, committedMandate
} from './simpleGame'

const pathOf = (name: string) => new URL('../../supabase/migrations/' + name, import.meta.url)
const seeds = [
  '20261023050112_aos_001_foundation.sql',
  '20261023120307_aos_006_second_intro_dossier.sql',
  '20261025145152_aos_043_foundational_campaign.sql',
  '20261025215000_aos_050_national_reform_programme.sql'
].map(name => readFileSync(pathOf(name), 'utf8')).join('\n')

function worldOf(events: DecisionEvent[] = []): GovernmentWorld {
  return {
    government: {
      id: 'gov-1', owner_id: 'user-1', country_name: 'Arcadia',
      treasury_m_eur: 12000, approval: 50, trust: 50,
      created_at: '2026-11-01', updated_at: '2026-11-01'
    },
    gameDay: '2026-11-07',
    calendar: { weekStart: '2026-11-02', friday: '2026-11-06',
      dayOfWeek: 6, fridayReached: true, weeklyTotal: 0,
      weeklyResolved: 0, weeklyTreasuryDeltaM: 0 },
    dossiers: INTRO_CASES.map(c => ({ id: c.id, version: 1, title: c.title,
      context: c.context, category: c.category, release_kind: 'intro',
      available_from: null, available_until: null })),
    options: INTRO_CASES.flatMap(c => c.options.map(o => ({
      id: o.id, dossier_id: c.id, dossier_version: 1, title: o.title,
      description: o.description, treasury_delta_m_eur: o.treasuryDelta,
      policy_target: o.policyTarget, response_intensity: o.responseIntensity,
      trust_base_delta: o.trustBaseDelta
    }))),
    cohorts: [], events
  }
}

function eventFor(id: string, choiceId: string): DecisionEvent {
  const name = INTRO_CASES.find(c => c.id === id)!
  const choice = name.options.find(o => o.id === choiceId)!
  return {
    id: 'event-' + id, government_id: 'gov-1', dossier_id: id,
    dossier_version: 1, option_id: choiceId,
    dossier_title_snapshot: name.title, option_title_snapshot: choice.title,
    engine_version: 'test', decided_on: '2026-11-07',
    created_at: '2026-11-07T12:00:00Z',
    state_before: { treasury_m_eur: 12000, approval: 50, trust: 50 },
    state_after: { treasury_m_eur: 12000 + choice.treasuryDelta,
      approval: 51, trust: 52 },
    cohort_effects: [],
    parameters_snapshot: {
      treasury_delta_m_eur: choice.treasuryDelta, policy_target: choice.policyTarget,
      response_intensity: choice.responseIntensity, trust_base_delta: choice.trustBaseDelta
    }
  }
}

describe('AOS simple decision mode', () => {
  it('uses twelve permanent, authentic server option IDs', () => {
    expect(MANDATE_SIZE).toBe(12)
    expect(new Set(INTRO_CASES.map(c => c.id)).size).toBe(12)
    for (const scenario of INTRO_CASES) {
      expect(scenario.options).toHaveLength(3)
      expect(seeds).toContain("'" + scenario.id + "',1")
      for (const option of scenario.options) {
        expect(seeds).toContain("'" + scenario.id + "',1,'" + option.id + "'")
      }
    }
    expect(GUEST_STORAGE_KEY).toBe('aos:simple-guest:v1')
  })

  it('plays a full offline mandate deterministically and reaches an election', () => {
    let progress = emptyGuest()
    for (const scenario of INTRO_CASES) {
      progress = chooseGuest(progress, scenario.id, scenario.options[2].id)
    }
    const snapshot = evaluateGuest(progress)
    expect(snapshot.events).toHaveLength(12)
    expect(snapshot.metrics.treasury_m_eur).toBeGreaterThan(0)
    expect(snapshot.metrics.approval).toBeGreaterThanOrEqual(0)
    expect(snapshot.metrics.approval).toBeLessThanOrEqual(100)
    expect(electionResult(snapshot.metrics).estimatedVote).toBeGreaterThanOrEqual(0)
    expect(electionResult(snapshot.metrics).estimatedVote).toBeLessThanOrEqual(100)
    expect(parseGuest(JSON.stringify(progress))).toEqual(progress)
    expect(() => chooseGuest(progress, INTRO_CASES[0].id, INTRO_CASES[0].options[0].id))
      .toThrow()
  })

  it('rejects corrupt browser saves and out-of-order, forged or unaffordable choices', () => {
    const empty = emptyGuest()
    expect(parseGuest('{broken')).toEqual(empty)
    expect(parseGuest(JSON.stringify({ version: 2, decisions: [] }))).toEqual(empty)
    expect(parseGuest(JSON.stringify({ version: 1,
      decisions: [{ caseId: 'forged', optionId: 'x' }] }))).toEqual(empty)
    expect(() => chooseGuest(empty, INTRO_CASES[1].id, INTRO_CASES[1].options[0].id))
      .toThrow('OUT_OF_ORDER')
    expect(() => chooseGuest(empty, INTRO_CASES[0].id, 'forged')).toThrow()
  })

  it('does not equate approval with a certified Parliament election', () => {
    expect(electionResult({ approval: 40, trust: 30, treasury_m_eur: 200 }).reelected)
      .toBe(false)
    expect(electionResult({ approval: 95, trust: 90, treasury_m_eur: 12000 }).reelected)
      .toBe(true)
  })

  it('imports already signed matching acts without rewriting or duplicating them', async () => {
    const one = INTRO_CASES[0]
    const progress = chooseGuest(emptyGuest(), one.id, one.options[0].id)
    let snapshot = worldOf([eventFor(one.id, one.options[0].id)])
    let calls = 0
    const result = await importGuest(progress, {
      load: async () => snapshot,
      sign: async () => { calls++ }
    })
    expect(result.imported).toBe(0)
    expect(calls).toBe(0)
    expect(committedMandate(snapshot).completed).toBe(1)
  })

  it('reconciles a lost transport response after the server commits', async () => {
    const one = INTRO_CASES[0]
    const progress = chooseGuest(emptyGuest(), one.id, one.options[0].id)
    let snapshot = worldOf()
    const result = await importGuest(progress, {
      load: async () => snapshot,
      sign: async () => {
        snapshot = worldOf([eventFor(one.id, one.options[0].id)])
        throw new Error('network response lost')
      }
    })
    expect(result.imported).toBe(1)
    expect(result.world.events).toHaveLength(1)
  })

  it('halts on contradictory signed decisions without modifying the save', async () => {
    const first = INTRO_CASES[0]
    const progress = chooseGuest(emptyGuest(), first.id, first.options[0].id)
    const snapshot = worldOf([eventFor(first.id, first.options[1].id)])
    let writes = 0
    await expect(importGuest(progress, {
      load: async () => snapshot,
      sign: async () => { writes++ }
    })).rejects.toBeInstanceOf(GuestImportConflict)
    expect(writes).toBe(0)
  })

  it('allows safe resumption of partial guest transfer on retry', async () => {
    let progress = emptyGuest()
    for (const scenario of INTRO_CASES.slice(0,3))
      progress = chooseGuest(progress, scenario.id, scenario.options[0].id)
    let snapshot = worldOf()
    const signed: DecisionEvent[] = []
    let attempts = 0
    const services = {
      load: async () => snapshot,
      sign: async (dossier: { id: string }, optionId: string) => {
        attempts++
        if (attempts === 2) throw new Error('temporary server error')
        signed.push(eventFor(dossier.id, optionId))
        snapshot = worldOf([...signed])
      }
    }
    await expect(importGuest(progress, services)).rejects.toThrow()
    expect(snapshot.events).toHaveLength(1)
    const again = await importGuest(progress, services)
    expect(again.imported).toBe(2)
    expect(again.world.events).toHaveLength(3)
  })
})
