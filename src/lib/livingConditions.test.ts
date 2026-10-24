import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchLivingConditions, validateLivingHistory } from './livingConditions'
import { livingFixture, livingGovernmentId as gid } from '../test/livingFixture'

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }))
vi.mock('./game', () => ({ requireClient: () => ({ rpc: mocks.rpc }) }))
beforeEach(() => mocks.rpc.mockReset())
describe('daily living conditions boundary', () => {
  it('reads only bounded server acts with the current government identity', async () => {
    mocks.rpc.mockResolvedValue({ data: livingFixture(), error: null })
    expect((await fetchLivingConditions(gid, 30)).recordedDays).toBe(2)
    expect(mocks.rpc).toHaveBeenCalledWith('get_living_conditions', { p_government_id: gid, p_days: 30 })
  })
  it('preserves missing days without inventing measurements', () => {
    const h = validateLivingHistory(livingFixture(), gid, 30)
    expect(h.expectedDays - h.recordedDays).toBe(1)
    expect(h.history.map(r => r.day)).toEqual(['2026-10-22', '2026-10-24'])
  })
  it('accepts serialized backend audit fields without comparing object identities', () => {
    const wire = JSON.parse(JSON.stringify(livingFixture()))
    wire.history[1].summary.cohortsAfter = [{ code: 'households', support: 51, trust: 50 }]
    wire.latest.summary.cohortsAfter = [{ code: 'households', support: 51, trust: 50 }]
    expect(validateLivingHistory(wire, gid, 30).latest?.summary.wellbeing).toBe(57.5)
  })
  it('accepts empty and stale histories explicitly', () => {
    const empty = { ...livingFixture(), expectedDays: 0, recordedDays: 0, latest: null, history: [] }
    expect(validateLivingHistory(empty, gid, 30).latest).toBeNull()
    const stale = { ...livingFixture(), serverDay: '2026-11-24', fromDay: '2026-10-26',
      expectedDays: 30, recordedDays: 0, history: [] }
    expect(validateLivingHistory(stale, gid, 30).latest?.day).toBe('2026-10-24')
  })
  it('rejects cross-government data, wrong windows, duplicates, invalid metrics and non-conserved residents', () => {
    const base = livingFixture()
    for (const raw of [
      { ...base, governmentId: 'foreign' }, { ...base, days: 90 }, { ...base, expectedDays: 91 },
      { ...base, recordedDays: 1 }, { ...base, history: [base.history[0], base.history[0]] },
      { ...base, history: [...base.history].reverse() },
      { ...base, serverDay: '2026-02-31' },
      { ...base, latest: { ...base.latest, summary: { ...base.latest!.summary, wellbeing: NaN } } },
      { ...base, latest: { ...base.latest, segments: base.latest!.segments.slice(1) } },
      { ...base, latest: { ...base.latest, segments: base.latest!.segments.map((s, i) => i ? s : { ...s, residents: 400 }) } }
    ]) expect(() => validateLivingHistory(raw, gid, 30)).toThrow('LIVING_CONDITIONS_INVALID_RESPONSE')
  })
  it('does not hide permission or transport failures', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' } })
    await expect(fetchLivingConditions(gid, 7)).rejects.toEqual({ message: 'GOVERNMENT_NOT_FOUND_OR_FORBIDDEN' })
  })
})
