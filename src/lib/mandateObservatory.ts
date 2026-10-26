import type { FiscalState, FiscalAct } from './fiscal'
import type { LivingHistory, LivingRecord } from './livingConditions'
import type { OpinionHistory } from './opinionPolls'
import type { ElectionState } from './elections'

export type MandateWindow = 7 | 30 | 90
export interface MandateInputs {
  fiscal: FiscalState | null
  living: LivingHistory | null
  opinion: OpinionHistory | null
  election: ElectionState | null
  userId?: string
  days: MandateWindow
}
export interface MandateReport {
  day: string
  fromDay: string
  fiscal: {
    treasury: number
    debt: number
    balance: number
    lastBalance: number | null
    deficitWeeks: number
    debtIssued: number
    settledWeeks: number
    records: FiscalAct[]
    bufferWeeks: number | null
  } | null
  society: {
    recorded: number
    expected: number
    missing: number
    first: number | null
    latest: number | null
    change: number | null
    minimum: number | null
    minimumDay: string | null
    consecutiveDays: number
    records: LivingRecord[]
  } | null
  election: {
    recorded: number
    expected: number
    missing: number
    first: number | null
    latest: number | null
    delta: number | null
    seats: number | null
    certified: number
    lastCertifiedWinner: string | null
  } | null
  findings: string[]
}
const utc = (day: string) => Date.parse(day + 'T00:00:00Z')
const iso = (stamp: number) => new Date(stamp).toISOString().slice(0, 10)
const round = (n: number) => Math.round(n * 100) / 100

/** Read-only aggregation of already certified server records.
 * No fabricated days, campaign votes, fiscal settlements or simulated history.
 */
export function buildMandateReport(input: MandateInputs): MandateReport {
  const { fiscal, living, opinion, election, userId, days } = input
  const dates = [fiscal?.serverDay, living?.serverDay, opinion?.serverDay,
    election?.serverDay].filter((v): v is string => !!v)
  if (!dates.length || dates.some(day => !/^\d{4}-\d{2}-\d{2}$/.test(day)))
    throw new Error('MANDATE_NO_SERVER_DATE')
  // Do not merge historical snapshots across distinct server days: the UI
  // can report an explicit refresh error rather than imply atomic reads.
  const day = dates.reduce((a, b) => a > b ? a : b)
  if (dates.some(d => Math.abs(utc(day) - utc(d)) > 86400000))
    throw new Error('MANDATE_SOURCE_DAY_MISMATCH')
  const fromDay = iso(utc(day) - (days - 1) * 86400000)
  let fiscalReport: MandateReport['fiscal'] = null
  if (fiscal) {
    const records = fiscal.history
      .filter(item => item.week_start >= fromDay && item.week_start <= day)
      .sort((a, b) => a.week_start.localeCompare(b.week_start))
    const balance = round(fiscal.projectedRevenueM - fiscal.projectedSpendingM)
    const bufferWeeks = balance < 0
      ? Math.floor(fiscal.indicators.treasuryM / -balance)
      : null
    fiscalReport = {
      treasury: fiscal.indicators.treasuryM,
      debt: fiscal.indicators.debtM,
      balance,
      lastBalance: records.length ? records[records.length - 1].balance_m_eur : null,
      deficitWeeks: records.filter(item => item.balance_m_eur < 0).length,
      debtIssued: records.reduce((sum, item) => sum + item.debt_issued_m_eur, 0),
      settledWeeks: records.length,
      records,
      bufferWeeks
    }
  }
  let society: MandateReport['society'] = null
  if (living) {
    const records = living.history.filter(item => item.day >= fromDay && item.day <= day)
    let consecutiveDays = 0
    let streak = 0
    let previous = ''
    let minimum: number | null = null
    let minimumDay: string | null = null
    for (const item of records) {
      streak = previous && utc(item.day) - utc(previous) === 86400000 ? streak + 1 : 1
      consecutiveDays = Math.max(consecutiveDays, streak)
      previous = item.day
      if (minimum === null || item.summary.wellbeing < minimum) {
        minimum = item.summary.wellbeing
        minimumDay = item.day
      }
    }
    const first = records[0]?.summary.wellbeing ?? null
    const latest = records.at(-1)?.summary.wellbeing ?? null
    society = {
      recorded: records.length, expected: living.expectedDays,
      missing: Math.max(0, living.expectedDays - records.length),
      first, latest,
      change: first === null || latest === null || records.length < 2
        ? null : round(latest - first),
      minimum, minimumDay, consecutiveDays, records
    }
  }
  let electoral: MandateReport['election'] = null
  if (opinion && userId) {
    const polls = opinion.polls.filter(item => item.day >= fromDay && item.day <= day)
    const first = polls[0]?.parties.find(item => item.userId === userId)?.voteSharePct ?? null
    const lastParty = polls.at(-1)?.parties.find(item => item.userId === userId)
    const latest = lastParty?.voteSharePct ?? null
    const electionRecords = (election?.history ?? [])
      .filter(item => item.certified_on.slice(0, 10) >= fromDay &&
        item.certified_on.slice(0, 10) <= day)
    electoral = {
      recorded: polls.length, expected: opinion.expectedDays,
      missing: Math.max(0, opinion.expectedDays - polls.length),
      first, latest, delta: first === null || latest === null || polls.length < 2
        ? null : round(latest - first),
      seats: lastParty?.seats ?? null,
      certified: electionRecords.length,
      lastCertifiedWinner: electionRecords
        .sort((a, b) => a.certified_on.localeCompare(b.certified_on)).at(-1)
        ?.winner_user_id ?? null
    }
  }
  const findings: string[] = []
  if (!fiscalReport) findings.push('Presupuesto no disponible: no se evalúa la solvencia.')
  else {
    if (fiscalReport.balance < 0)
      findings.push('El presupuesto semanal vigente tiene déficit estructural en la simulación.')
    if (fiscalReport.debtIssued > 0)
      findings.push('Existen emisiones de deuda en las actas fiscales de este periodo.')
  }
  if (!society) findings.push('Balance social no disponible: la tendencia no es evaluable.')
  else {
    if (society.missing > 0)
      findings.push('Faltan actas diarias: no se interpolan días sin medición.')
    if (society.minimum !== null && society.minimum < 40)
      findings.push('El bienestar registrado ha estado por debajo de 40 sobre 100.')
    if (society.change !== null && society.change <= -5)
      findings.push('El bienestar registrado ha descendido al menos cinco puntos.')
  }
  if (opinion && userId) {
    if (electoral?.missing) findings.push('Faltan mediciones electorales en el periodo.')
    if (electoral?.delta !== null && electoral?.delta !== undefined && electoral.delta <= -5)
      findings.push('La estimación de voto ha caído al menos cinco puntos; no es un resultado certificado.')
  }
  return { day, fromDay, fiscal:fiscalReport, society, election:electoral, findings }
}

/** Stress-test the fiscal arithmetic without touching the official budget.
 * The result deliberately assumes constant spending/revenue, no new political
 * decisions and no other treasury flows. It is NOT a forecast or committed act.
 */
export function fiscalStressScenarios(fiscal: FiscalState): {
  label: string; weeklyBalance: number; bufferWeeks: number | null
}[] {
  const revenue = fiscal.projectedRevenueM
  const spending = fiscal.projectedSpendingM
  const capital = fiscal.indicators.treasuryM
  return [
    { label:'Presupuesto actual', weeklyBalance:revenue-spending },
    { label:'Ingresos un 10 % menores', weeklyBalance:round(revenue*.9-spending) },
    { label:'Gastos un 10 % mayores', weeklyBalance:round(revenue-spending*1.1) }
  ].map(item => ({
    ...item,
    bufferWeeks:item.weeklyBalance < 0
      ? Math.floor(capital / -item.weeklyBalance) : null
  }))
}
