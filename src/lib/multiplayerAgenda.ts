import type { Dossier } from './types'
import type { MatchWorld } from './multiplayer'

export type MatchAgendaFilter = 'all' | 'weekly' | 'foundation' | 'action' | 'signed'
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
    const priority = (x: typeof a) => x.dossier.release_kind === 'weekly' ? 0 : 1
    return priority(a) - priority(b) || a.index - b.index
  })
  const count = (kind: Dossier['release_kind']) => {
    const filtered = items.filter(item => item.dossier.release_kind === kind)
    return {
      total: filtered.length,
      signed: filtered.filter(item => item.signed).length,
      stances: filtered.filter(item => item.hasStance).length
    }
  }
  return {
    items: items.map(({ index: _unused, ...item }) => item),
    weekly: count('weekly'),
    foundation: count('intro'),
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
    if (filter === 'foundation') return item.dossier.release_kind === 'intro'
    if (filter === 'signed') return item.signed
    if (filter === 'action') return item.available && !item.signed &&
      (snapshot.role === 'cabinet' || !item.hasStance)
    return true
  })
}
