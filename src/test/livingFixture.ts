import type { LivingHistory, LivingWindow } from '../lib/livingConditions'

export const livingGovernmentId = '46000000-0000-4000-8000-000000000001'
export function livingFixture(governmentId = livingGovernmentId, days: LivingWindow = 30): LivingHistory {
  const summary = { households: 300, residents: 900, economicSecurity: 62.5,
    serviceAccess: 50, wellbeing: 57.5, approvalBefore: 50, approvalAfter: 51,
    trustBefore: 50, trustAfter: 50 }
  const records = ['2026-10-22', '2026-10-24'].map(day => ({
    day, capturedAt: day + 'T00:15:00Z', modelVersion: 'living-conditions-v1' as const,
    summary: { ...summary }
  }))
  return {
    governmentId, serverDay: '2026-10-24', fromDay: '2026-10-22',
    days, expectedDays: 3, recordedDays: 2, history: records,
    latest: { ...records[1], segments: [
      ...['low', 'middle', 'high'].map(code => ({ dimension: 'income' as const,
        code, households: 100, residents: 300, economicSecurity: 62.5,
        serviceAccess: 50, wellbeing: 57.5, support: 51 })),
      ...['capital', 'industrial', 'coastal', 'agrarian', 'highland', 'frontier'].map(code => ({
        dimension: 'district' as const, code, households: 50, residents: 150,
        economicSecurity: 62.5, serviceAccess: 50, wellbeing: 57.5, support: 51 }))
    ], inputs: { gdpIndex: 100, unemploymentBp: 700, inflationBp: 250,
      policy: { health: 35, education: 25, infrastructure: 25, security: 15, tax_rate: 25 } } }
  }
}
