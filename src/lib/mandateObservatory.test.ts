import { describe, expect, it } from 'vitest'
import { buildMandateReport, fiscalStressScenarios } from './mandateObservatory'
import type { FiscalState } from './fiscal'
import type { LivingHistory, LivingRecord } from './livingConditions'
import type { OpinionHistory } from './opinionPolls'
import type { ElectionState } from './elections'

const governmentId = '60000000-0000-4000-8000-000000000001'
const userId = '60000000-0000-4000-8000-000000000002'
const otherId = '60000000-0000-4000-8000-000000000003'
const day = '2026-10-26'
const fiscal = {
  governmentId, serverDay:day,
  projectedRevenueM:2300, projectedSpendingM:2400,
  indicators:{treasuryM:500,debtM:7000,gdpIndex:102,unemploymentBp:700,
    inflationBp:200,approval:49,trust:44},
  history:[
    {week_start:'2026-10-19',balance_m_eur:-100,debt_issued_m_eur:20,
      treasury_after_m_eur:500},
    {week_start:'2026-10-12',balance_m_eur:-75,debt_issued_m_eur:0,
      treasury_after_m_eur:600},
    {week_start:'2026-07-13',balance_m_eur:-400,debt_issued_m_eur:80,
      treasury_after_m_eur:1000}
  ]
} as FiscalState
const recorded = (date:string,wellbeing:number):LivingRecord => ({
  day:date,capturedAt:date+'T00:15:00Z',modelVersion:'living-conditions-v1',
  summary:{households:300,residents:750,economicSecurity:55,
    serviceAccess:60,wellbeing,approvalBefore:50,approvalAfter:49,
    trustBefore:50,trustAfter:49}
})
const history:LivingHistory = {
  governmentId,serverDay:day,fromDay:'2026-09-27',days:30,
  expectedDays:30,recordedDays:3,latest:null,
  history:[recorded('2026-10-20',45),recorded('2026-10-21',43),
    recorded('2026-10-26',37)]
}
const polls:OpinionHistory = {
  matchId:'70000000-0000-4000-8000-000000000001',
  serverDay:day,fromDay:'2026-09-27',days:30,recordedDays:2,
  expectedDays:30,polls:[
    {day:'2026-10-20',capturedAt:'2026-10-20T00:10:00Z',
      modelVersion:'electoral-districts-v2',householdSampleSize:300,
      parties:[{userId,seatNo:1,partyName:'Reform',manifestoPolicy:50,
        voteSharePct:52,seats:55},
        {userId:otherId,seatNo:2,partyName:'Other',manifestoPolicy:70,
          voteSharePct:48,seats:45}],districts:[]},
    {day:'2026-10-26',capturedAt:'2026-10-26T00:10:00Z',
      modelVersion:'electoral-districts-v2',householdSampleSize:300,
      parties:[{userId,seatNo:1,partyName:'Reform',manifestoPolicy:50,
        voteSharePct:46,seats:48},
        {userId:otherId,seatNo:2,partyName:'Other',manifestoPolicy:70,
          voteSharePct:54,seats:52}],districts:[]}
  ]
}
const elections={
  serverDay:day, history:[{certified_on:'2026-10-25',winner_user_id:otherId},
    {certified_on:'2026-07-01',winner_user_id:userId}]
} as ElectionState

describe('90-day mandate observatory — immutable and server-owned inputs', () => {
  it('aggregates observed budgets, welfare, gaps and fiscal stress without a write', () => {
    const original = JSON.stringify({fiscal,history})
    const report = buildMandateReport({fiscal,living:history,opinion:null,election:null,days:30})
    expect(report.fiscal).toMatchObject({
      treasury:500,debt:7000,balance:-100,deficitWeeks:2,debtIssued:20,
      settledWeeks:2,bufferWeeks:5
    })
    expect(report.society).toMatchObject({
      recorded:3,expected:30,missing:27,first:45,latest:37,change:-8,
      minimum:37,minimumDay:'2026-10-26',consecutiveDays:2
    })
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.stringContaining('déficit'),
      expect.stringContaining('deuda'),
      expect.stringContaining('Faltan actas diarias'),
      expect.stringContaining('debajo de 40'),
      expect.stringContaining('descendido')
    ]))
    expect(JSON.stringify({fiscal,history})).toBe(original)
    expect(fiscalStressScenarios(fiscal)).toEqual([
      {label:'Presupuesto actual',weeklyBalance:-100,bufferWeeks:5},
      {label:'Ingresos un 10 % menores',weeklyBalance:-330,bufferWeeks:1},
      {label:'Gastos un 10 % mayores',weeklyBalance:-340,bufferWeeks:1}
    ])
  })
  it('provides a 90-day electorate view and counts only certified elections', () => {
    const report=buildMandateReport({fiscal,living:history,
      opinion:polls,election:elections,userId,days:90})
    expect(report.fromDay).toBe('2026-07-29')
    expect(report.election).toMatchObject({
      recorded:2,expected:30,missing:28,first:52,latest:46,
      delta:-6,seats:48,certified:1,lastCertifiedWinner:otherId
    })
    expect(report.findings).toEqual(expect.arrayContaining([
      expect.stringContaining('Faltan mediciones electorales'),
      expect.stringContaining('cinco puntos')
    ]))
  })
  it('excludes old fiscal acts and preserves genuine short-window gaps', () => {
    const weekly:LivingHistory={...history,days:7,fromDay:'2026-10-20',
      expectedDays:7,recordedDays:1,history:[recorded('2026-10-26',37)]}
    const report=buildMandateReport({fiscal,living:weekly,
      opinion:null,election:null,days:7})
    expect(report.fiscal?.records.map(x=>x.week_start)).toEqual([])
    expect(report.fiscal?.settledWeeks).toBe(0)
    expect(report.society?.recorded).toBe(1)
    expect(report.society?.missing).toBe(6)
    expect(report.society?.change).toBeNull()
  })
  it('prevents unrelated server days from being silently compared', () => {
    expect(()=>buildMandateReport({fiscal,living:{...history,serverDay:'2026-10-23'},
      opinion:null,election:null,days:30})).toThrow('MANDATE_SOURCE_DAY_MISMATCH')
  })
  it('returns partial evidence without inventing unavailable datasets or forecasts', () => {
    const result=buildMandateReport({fiscal,living:null,opinion:null,election:null,days:30})
    expect(result.society).toBeNull()
    expect(result.findings).toContain('Balance social no disponible: la tendencia no es evaluable.')
    expect(fiscalStressScenarios({...fiscal,projectedRevenueM:3000}).at(0)?.bufferWeeks).toBeNull()
    expect(()=>buildMandateReport({fiscal:null,living:null,
      opinion:null,election:null,days:7})).toThrow('MANDATE_NO_SERVER_DATE')
  })
  it('does not attribute another partys vote share to this player', () => {
    const result=buildMandateReport({fiscal,living:history,opinion:polls,
      election:elections,userId:'absent',days:30})
    expect(result.election?.first).toBeNull()
    expect(result.election?.latest).toBeNull()
    expect(result.election?.delta).toBeNull()
  })
})
