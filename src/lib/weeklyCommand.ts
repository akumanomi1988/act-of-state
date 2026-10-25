import type { MatchWorld } from './multiplayer'
import type { MatchCalendar } from './multiplayer'
import type { ParliamentState, ParliamentBill } from './parliament'
import type { Dossier } from './types'

export type WeeklyAction = 'signed' | 'expired' | 'vote' | 'awaiting-votes' |
  'sign' | 'awaiting-signature' | 'propose' | 'stance' | 'awaiting-proposal'

export interface WeeklyAgendaRow {
  dossier: Dossier
  action: WeeklyAction
  hasStance: boolean
  hasVote: boolean
  signed: boolean
  bill: ParliamentBill | null
}
export interface WeeklyMission {
  date: string
  friday: string
  published: boolean
  expected: number
  available: number
  signed: number
  stances: number
  votes: number
  openVotes: number
  pending: number
  overdue: boolean
  isCabinet: boolean
  rows: WeeklyAgendaRow[]
  next: WeeklyAgendaRow | null
}

/**
 * Pure read-model; all decisions/mandates belong to the authoritative server.
 * In particular, a party stance is NOT a vote and a passed bill is NOT a
 * signed government policy. Never use client wall-clock for opening content.
 */
export function buildWeeklyMission(
  world: MatchWorld,
  parliament: ParliamentState,
  calendar: MatchCalendar,
  userId: string
): WeeklyMission {
  const isCabinet = world.match.host_user_id === userId
  const nowDay = calendar.gameDay
  const votes = new Set(parliament.votes.filter(v => v.user_id === userId)
    .map(v => v.bill_id))
  const stances = new Set(world.stances.filter(v => v.user_id === userId)
    .map(v => v.dossier_id + ':' + v.dossier_version))
  const signed = new Set(world.events.map(v => v.dossier_id + ':' + v.dossier_version))
  const rows: WeeklyAgendaRow[] = world.dossiers
    .filter(d => d.release_kind === 'weekly' && d.available_from === calendar.monday)
    .map(d => {
      const key = d.id + ':' + d.version
      const hasStance = stances.has(key)
      const isSigned = signed.has(key)
      const matches = parliament.bills.filter(b => b.dossier_id === d.id &&
        b.dossier_version === d.version)
      const bill = matches.find(b => b.status === 'passed') ??
        matches.find(b => b.status === 'open') ?? matches[0] ?? null
      const hasVote = !!bill && votes.has(bill.id)
      const available = nowDay >= calendar.monday &&
        nowDay <= calendar.friday &&
        (!d.available_until || nowDay <= d.available_until)
      let action: WeeklyAction
      if (isSigned) action = 'signed'
      else if (!available) action = 'expired'
      else if (bill?.status === 'passed') action = isCabinet ? 'sign' : 'awaiting-signature'
      else if (bill?.status === 'open') action = hasVote ? 'awaiting-votes' : 'vote'
      else if (!hasStance) action = 'stance'
      else action = isCabinet ? 'propose' : 'awaiting-proposal'
      return { dossier:d, action, hasStance, hasVote, signed:isSigned, bill }
    })
  // The command order is urgency-focused, not an algorithm deciding policy.
  const ranks: Record<WeeklyAction,number> = {
    sign:0, vote:1, propose:2, stance:3, 'awaiting-votes':4,
    'awaiting-signature':5, 'awaiting-proposal':6, signed:7, expired:8
  }
  rows.sort((a,b) => ranks[a.action] - ranks[b.action] ||
    a.dossier.id.localeCompare(b.dossier.id))
  const readyActions = new Set<WeeklyAction>(['sign','vote','propose','stance'])
  return {
    date:nowDay, friday:calendar.friday,
    published:calendar.weeklyPublished,
    expected:calendar.weeklyPublished ? calendar.weeklyTotal : 0,
    available:rows.length,
    signed:rows.filter(r=>r.signed).length,
    stances:rows.filter(r=>r.hasStance).length,
    votes:rows.filter(r=>r.hasVote).length,
    openVotes:rows.filter(r=>r.bill?.status==='open').length,
    pending:rows.filter(r=>readyActions.has(r.action)).length,
    overdue:nowDay > calendar.friday,
    isCabinet,
    rows,
    next:rows.find(r=>readyActions.has(r.action))??null
  }
}
