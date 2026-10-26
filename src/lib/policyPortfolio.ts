import type { DecisionEvent, Dossier, DossierOption } from './types'
import { CHAPTERS, chapterOf, type ProgrammeChapter } from './nationalProgramme'

export type PortfolioChapter = ProgrammeChapter | 'all'
export type PortfolioPicks = Readonly<Record<string, string>>

export interface PortfolioCase {
  key: string
  dossier: Dossier
  chapter: ProgrammeChapter
  signed: boolean
  available: boolean
  options: DossierOption[]
  selected: DossierOption | null
}

export interface PolicyPortfolio {
  cases: PortfolioCase[]
  signed: number
  total: number
  available: number
  selected: number
  selectedFiscalDelta: number
  projectedTreasury: number
  hasFiscalDeficit: boolean
  chapters: { id: ProgrammeChapter, label: string, total: number, signed: number }[]
}

export const portfolioKey = (dossier: Dossier): string => dossier.id + ':' + dossier.version

/** A read-only, deliberately partial counterfactual. No client prediction is an act. */
export function buildPolicyPortfolio(
  dossiers: readonly Dossier[],
  options: readonly DossierOption[],
  events: readonly DecisionEvent[],
  gameDay: string,
  picks: PortfolioPicks,
  currentTreasury: number
): PolicyPortfolio {
  const signedKeys = new Set(events.map(e => e.dossier_id + ':' + e.dossier_version))
  const cases: PortfolioCase[] = dossiers.flatMap(dossier => {
    const chapter = chapterOf(dossier)
    if (!chapter) return []
    const key = portfolioKey(dossier)
    const signed = signedKeys.has(key)
    const available = (!dossier.available_from || dossier.available_from <= gameDay)
      && (!dossier.available_until || dossier.available_until >= gameDay)
    const choices = options.filter(option => option.dossier_id === dossier.id
      && option.dossier_version === dossier.version)
    const selected = !signed && available
      ? choices.find(option => option.id === picks[key]) ?? null
      : null
    return [{ key, dossier, chapter, signed, available, options: choices, selected }]
  })
  const order = new Map(CHAPTERS.map((chapter, index) => [chapter.id, index]))
  cases.sort((a, b) => (order.get(a.chapter) ?? 99) - (order.get(b.chapter) ?? 99)
    || (a.dossier.programme_order ?? 99) - (b.dossier.programme_order ?? 99)
    || a.dossier.id.localeCompare(b.dossier.id)
    || b.dossier.version - a.dossier.version)
  const selectedCases = cases.filter(item => item.selected)
  const selectedFiscalDelta = selectedCases.reduce(
    (sum, item) => sum + (item.selected?.treasury_delta_m_eur ?? 0), 0
  )
  const projectedTreasury = currentTreasury + selectedFiscalDelta
  return {
    cases, total: cases.length, signed: cases.filter(item => item.signed).length,
    available: cases.filter(item => !item.signed && item.available && item.options.length > 0).length,
    selected: selectedCases.length, selectedFiscalDelta, projectedTreasury,
    hasFiscalDeficit: selectedCases.length > 0 && Number.isFinite(projectedTreasury) && projectedTreasury < 0,
    chapters: CHAPTERS.map(chapter => {
      const owned = cases.filter(item => item.chapter === chapter.id)
      return { id: chapter.id, label: chapter.label, total: owned.length,
        signed: owned.filter(item => item.signed).length }
    })
  }
}

