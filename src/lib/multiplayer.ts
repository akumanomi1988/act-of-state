import { requireClient } from './game'
import type { DecisionEvent, Dossier, DossierOption, Government, PopulationCohort } from './types'

export interface MatchSummary {
  id: string
  title: string
  status: 'lobby' | 'active'
  host_user_id: string
  government_id: string
  seat_no: number
  party_name: string
  player_count: number
  created_at: string
}

export interface MatchPlayer {
  match_id: string
  user_id: string
  seat_no: number
  party_name: string
  joined_at: string
}

export interface MatchStance {
  match_id: string
  user_id: string
  dossier_id: string
  dossier_version: number
  option_id: string
  policy_affinity: number
  engine_version: 'policy-affinity-v1'
  created_at: string
}

export interface MatchWorld {
  match: {
    id: string
    title: string
    status: 'lobby' | 'active'
    host_user_id: string
    government_id: string
    invite_code: string
    created_at: string
    started_at: string | null
    max_players: number
  }
  me: MatchPlayer
  gameDay: string
  players: MatchPlayer[]
  government: Government
  cohorts: PopulationCohort[]
  dossiers: Dossier[]
  options: DossierOption[]
  events: DecisionEvent[]
  stances: MatchStance[]
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await requireClient().rpc(name, args)
  if (error) throw error
  if (data == null) throw new Error('MATCH_INVALID_RESPONSE')
  return data as T
}

export async function listMyMatches(): Promise<MatchSummary[]> {
  const value = await rpc<unknown>('list_my_matches')
  if (!Array.isArray(value)) throw new Error('MATCH_INVALID_RESPONSE')
  return value as MatchSummary[]
}

export async function createMatch(title: string, partyName: string): Promise<{ id: string }> {
  const value = await rpc<unknown>('create_match', { p_title: title, p_party_name: partyName })
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    typeof (value as { id?: unknown }).id !== 'string')
    throw new Error('MATCH_INVALID_RESPONSE')
  return value as { id: string }
}

export async function joinMatch(inviteCode: string, partyName: string): Promise<MatchPlayer> {
  const value = await rpc<unknown>('join_match', {
    p_invite_code: inviteCode.trim().toLowerCase(), p_party_name: partyName
  })
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
    typeof (value as MatchPlayer).match_id !== 'string')
    throw new Error('MATCH_INVALID_RESPONSE')
  return value as MatchPlayer
}

export async function startMatch(matchId: string): Promise<void> {
  await rpc('start_match', { p_match_id: matchId })
}

export async function recordMatchStance(
  matchId: string, dossierId: string, dossierVersion: number, optionId: string
): Promise<MatchStance> {
  return rpc<MatchStance>('record_match_stance', {
    p_match_id: matchId, p_dossier_id: dossierId,
    p_dossier_version: dossierVersion, p_option_id: optionId
  })
}

export async function fetchMatchWorld(matchId: string): Promise<MatchWorld> {
  const value = await rpc<unknown>('get_match_world', { p_match_id: matchId })
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('MATCH_INVALID_RESPONSE')
  const world = value as Partial<MatchWorld>
  if (world.match?.id !== matchId || !world.me ||
    !Array.isArray(world.players) || !Array.isArray(world.cohorts) ||
    !Array.isArray(world.dossiers) || !Array.isArray(world.options) ||
    !Array.isArray(world.events) || !Array.isArray(world.stances) ||
    !world.government || typeof world.gameDay !== 'string')
    throw new Error('MATCH_INVALID_RESPONSE')
  return world as MatchWorld
}

const messages: Record<string, string> = {
  MATCH_INVALID_NAME: 'El nombre debe tener entre 3 y 80 caracteres (partido: máximo 60).',
  MATCH_INVITE_NOT_FOUND: 'El código de invitación no corresponde a una partida.',
  MATCH_FULL: 'La partida ya tiene diez partidos.',
  MATCH_ALREADY_STARTED: 'La partida ya comenzó y no admite nuevos participantes.',
  MATCH_PARTY_NAME_TAKEN: 'Ya existe un partido con ese nombre.',
  MATCH_FORBIDDEN: 'No perteneces a esta partida o no tienes permiso para esa acción.',
  MATCH_REQUIRES_TWO_PLAYERS: 'Se necesitan al menos dos partidos para comenzar.',
  MATCH_NOT_ACTIVE: 'La partida aún no está activa.',
  MATCH_STANCE_ALREADY_RECORDED: 'Ya fijaste una posición distinta para este expediente.',
  MATCH_INVALID_RESPONSE: 'La respuesta de la partida no es válida.',
  DOSSIER_NOT_AVAILABLE: 'Este expediente todavía no está disponible.',
  INVALID_OPTION: 'La opción seleccionada no existe.'
}

export function matchError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason)
  const code = Object.keys(messages).find(key => message.includes(key))
  return code ? messages[code] : message
}
