import type { Dossier } from './types'
import type { MatchWorld } from './multiplayer'
import { chapterOf, reformChapter, CHAPTERS } from './nationalProgramme'

export type MatchAgendaFilter = 'all' | 'weekly' | 'foundation' | 'reforms' | 'society' | 'economy' | 'institutions' | 'resilience' | 'action' | 'signed'
export type MatchDossierStatus = 'signed' | 'stance-recorded' | 'pending' | 'unavailable'

export interface MatchAgendaItem {
  dossier: Dossier
  status: MatchDossierStatus
  hasStance: boolean
  signed: boolean
  available: boolean
}

export interface MatchAgendaSnapshot {
  items: MatchAgendaItem[]
  weekly: { total: number; signed: number; stances: number }
  foundation: { total: number; signed: number; stances: number }
  reforms: { total: number; signed: number; stances: number }
  next: MatchAgendaItem | null
  role: 'cabinet' | 'opposition'
}

export function isCurrentDossier(dossier: Dossier, serverDay: string): boolean {
  return (!dossier.available_from || dossier.available_from <= serverDay) &&
    (!dossier.available_until || dossier.available_until >= serverDay)
}

/**
 * This is a view of server-authoritative decisions and party stances, not a
 * second government simulation. Never infer a parliamentary mandate here:
 * only the validated get_parliament_state RPC can grant one.
 */
export function buildMatchAgenda(world: MatchWorld, userId: string): MatchAgendaSnapshot {
  const decisions = new Set(world.events.map(event => event.dossier_id))
  const myStances = new Set(world.stances.filter(stance => stance.user_id === userId)
    .map(stance => stance.dossier_id))
  const items = world.dossiers.map((dossier, index) => {
    const signed = decisions.has(dossier.id)
    const hasStance = myStances.has(dossier.id)
    const available = isCurrentDossier(dossier, world.gameDay)
    return {
      dossier, signed, hasStance, available, index,
      status: (signed ? 'signed' : !available ? 'unavailable' :
        hasStance ? 'stance-recorded' : 'pending') as MatchDossierStatus
    }
  }).sort((a, b) => {
    const priority = (x: typeof a) => x.dossier.release_kind === 'weekly' ? 0 :
      1+CHAPTERS.findIndex(chapter=>chapter.id===chapterOf(x.dossier))
    return priority(a) - priority(b) ||
      (a.dossier.programme_order??99)-(b.dossier.programme_order??99) ||
      a.index - b.index
  })
  const count = (match: (dossier: Dossier) => boolean) => {
    const filtered = items.filter(item => match(item.dossier))
    return {
      total: filtered.length,
      signed: filtered.filter(item => item.signed).length,
      stances: filtered.filter(item => item.hasStance).length
    }
  }
  return {
    items: items.map(({ index: _unused, ...item }) => item),
    weekly: count(d=>d.release_kind==='weekly'),
    foundation: count(d=>chapterOf(d)==='founding'),
    reforms: count(reformChapter),
    next: items.find(item => item.available && !item.signed && !item.hasStance) ??
      items.find(item => item.available && !item.signed) ?? null,
    role: world.match.host_user_id === userId ? 'cabinet' : 'opposition'
  }
}

export function visibleMatchDossiers(
  snapshot: MatchAgendaSnapshot, filter: MatchAgendaFilter
): MatchAgendaItem[] {
  return snapshot.items.filter(item => {
    if (filter === 'weekly') return item.dossier.release_kind === 'weekly'
    if (filter === 'foundation') return chapterOf(item.dossier) === 'founding'
    if (filter === 'reforms') return reformChapter(item.dossier)
    if (filter === 'society' || filter === 'economy' ||
        filter === 'institutions' || filter === 'resilience')
      return chapterOf(item.dossier) === filter
    if (filter === 'signed') return item.signed
    if (filter === 'action') return item.available && !item.signed &&
      (snapshot.role === 'cabinet' || !item.hasStance)
    return true
  })
}
