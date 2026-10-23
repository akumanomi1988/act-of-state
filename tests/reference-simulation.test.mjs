import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

// Specification oracle, NOT a runtime alternative to server-side PostgreSQL RPC.
// Mirrors the documented weighted-cohorts-v1 integer/numeric calculation.
const options = Object.freeze({
  'household-support': { treasuryDelta: -1400, policyTarget: 25, responseIntensity: 35, trustBaseDelta: 2 },
  'industry-investment': { treasuryDelta: -850, policyTarget: 75, responseIntensity: 35, trustBaseDelta: 0 },
  'fiscal-restraint': { treasuryDelta: 200, policyTarget: 50, responseIntensity: 20, trustBaseDelta: -2 },
  // Rollback-only editorial fixtures shared with the SQL integration test.
  'moderate-investment': { treasuryDelta: -300, policyTarget: 50, responseIntensity: 40, trustBaseDelta: 1 },
  'over-budget': { treasuryDelta: -12000, policyTarget: 50, responseIntensity: 0, trustBaseDelta: 0 }
});
const cohorts = Object.freeze([
  { code: 'households', weight: 65, idealPolicy: 25, support: 50, trust: 50 },
  { code: 'industry', weight: 35, idealPolicy: 75, support: 50, trust: 50 }
]);
const clamp = (x) => Math.max(0, Math.min(100, x));
// PostgreSQL round(numeric) breaks ties away from zero, unlike JS Math.round(-0.5).
const pgRound = (value) => value >= 0 ? Math.floor(value + 0.5) : Math.ceil(value - 0.5);

function referenceOutcome(optionName, previous = null) {
  const option = options[optionName];
  if (!option) throw new Error('INVALID_OPTION');
  const treasury = (previous?.treasury ?? 12000) + option.treasuryDelta;
  if (treasury < 0) throw new Error('INSUFFICIENT_TREASURY');
  const currentCohorts = previous ? cohorts.map(cohort => {
    const prior = previous.changes.find(change => change.code === cohort.code);
    if (!prior) throw new Error('POPULATION_NOT_INITIALIZED');
    return { ...cohort, support: prior.support, trust: prior.trust };
  }) : cohorts;
  const changes = currentCohorts.map(cohort => {
    const affinity = 50 - Math.abs(cohort.idealPolicy - option.policyTarget);
    return {
      code: cohort.code,
      weight: cohort.weight,
      support: clamp(cohort.support + pgRound(affinity * option.responseIntensity / 100)),
      trust: clamp(cohort.trust + pgRound(affinity * option.responseIntensity / 200) + option.trustBaseDelta)
    };
  });
  const population = changes.reduce((sum, cohort) => sum + cohort.weight, 0);
  return {
    treasury,
    approval: pgRound(changes.reduce((sum, cohort) => sum + cohort.weight * cohort.support, 0) / population),
    trust: pgRound(changes.reduce((sum, cohort) => sum + cohort.weight * cohort.trust, 0) / population),
    changes
  };
}

describe('weighted-cohorts-v1 specification oracle (offline)', () => {
  it('applies household support to 65/35 population cohorts', () => {
    assert.deepEqual(referenceOutcome('household-support'), {
      treasury: 10600, approval: 62, trust: 58,
      changes: [
        { code: 'households', weight: 65, support: 68, trust: 61 },
        { code: 'industry', weight: 35, support: 50, trust: 52 }
      ]
    });
  });
  it('applies industrial investment deterministically', () => {
    const result = referenceOutcome('industry-investment');
    assert.deepEqual([result.treasury, result.approval, result.trust], [11150, 56, 53]);
    assert.deepEqual([result.changes[0].support, result.changes[1].support], [50, 68]);
  });
  it('applies fiscal restraint deterministically', () => {
    const result = referenceOutcome('fiscal-restraint');
    assert.deepEqual([result.treasury, result.approval, result.trust], [12200, 55, 51]);
  });
  it('returns identical calculations for fixed inputs', () => {
    assert.deepEqual(referenceOutcome('household-support'), referenceOutcome('household-support'));
  });
  it('uses PostgreSQL numeric half-away-from-zero rules', () => {
    assert.equal(pgRound(0.5), 1);
    assert.equal(pgRound(-0.5), -1);
    assert.equal(pgRound(1.5), 2);
    assert.equal(pgRound(-1.5), -2);
  });
  it('rejects invalid options without applying effects', () => {
    assert.throws(() => referenceOutcome('not-an-option'), /INVALID_OPTION/);
  });
  it('compounds two distinct dossier choices over the same population', () => {
    const first = referenceOutcome('household-support');
    const second = referenceOutcome('moderate-investment', first);
    assert.deepEqual([second.treasury, second.approval, second.trust], [10300, 72, 64]);
    assert.deepEqual(second.changes, [
      { code: 'households', weight: 65, support: 78, trust: 67 },
      { code: 'industry', weight: 35, support: 60, trust: 58 }
    ]);
  });
  it('rejects unaffordable policy without mutating the preceding outcome', () => {
    const first = referenceOutcome('household-support');
    const before = structuredClone(first);
    assert.throws(() => referenceOutcome('over-budget', first), /INSUFFICIENT_TREASURY/);
    assert.deepEqual(first, before);
  });

});
