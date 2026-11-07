import { requireClient } from './game'
import {daySpan,isCount,isNonNegative,isScore,isTimestamp,isUtcDay} from './serverEvidence'
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
  manifesto_policy: number
  mandate_seats: number
  joined_at: string
  is_ready: boolean
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
    is_public: boolean
    readiness_required: boolean
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

export interface MatchFridayClosure {
  match_id: string
  week_start: string
  closed_at: string
  dossiers_published: number
  decisions_resolved: number
  treasury_delta_m_eur: number
  treasury_at_friday_m_eur: number
  approval_at_friday: number
  trust_at_friday: number
  engine_version: 'friday-ledger-v1'
}

export interface MatchCalendar {
  gameDay: string
  monday: string
  friday: string
  fridayReached: boolean
  weeklyPublished: boolean
  weeklyTotal: number
  weeklyResolved: number
  latestFriday: MatchFridayClosure | null
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

const obj=(value:unknown):value is Record<string,unknown> =>
  value!==null&&typeof value==='object'&&!Array.isArray(value)
const nonempty=(value:unknown):value is string =>
  typeof value==='string'&&value.trim().length>0

/**
 * The get_match_world RPC is server-authorized, but browser navigation and
 * identity transitions must also fail closed for cross-match/mixed snapshots.
 * Historical stances/events can reference archived dossiers; do not constrain
 * them to the current (availability-filtered) dossier list.
 */
export function validateMatchWorld(raw:unknown,matchId:string):MatchWorld {
  const fail=():never=>{throw new Error('MATCH_INVALID_RESPONSE')}
  if(!obj(raw)||!obj(raw.match)||!obj(raw.me)||!obj(raw.government)||
     raw.match.id!==matchId||raw.match.government_id!==raw.government.id||
     !nonempty(raw.match.host_user_id)||!['lobby','active'].includes(String(raw.match.status))||
     !isUtcDay(raw.gameDay)||!Array.isArray(raw.players)||
     raw.players.length<1||raw.players.length>10||
     !Array.isArray(raw.cohorts)||!Array.isArray(raw.dossiers)||
     !Array.isArray(raw.options)||!Array.isArray(raw.events)||
     !Array.isArray(raw.stances)||raw.me.match_id!==matchId||
     !nonempty(raw.me.user_id)||!isCount(raw.me.seat_no,10)||
     !isNonNegative(raw.government.treasury_m_eur)||
     !isScore(raw.government.approval)||!isScore(raw.government.trust))
    return fail()
  // Capture stable narrowed references before iterating callback closures.
  const ownerMe=raw.me as Record<string,unknown>
  const governmentId=(raw.government as Record<string,unknown>).id
  const players=raw.players as unknown[]
  const ids=new Set<string>(),seats=new Set<number>()
  for(const player of players){
    if(!obj(player)||player.match_id!==matchId||!nonempty(player.user_id)||
       !nonempty(player.party_name)||!isCount(player.seat_no,10)||player.seat_no<1||
       !isCount(player.mandate_seats,100)||!isCount(player.manifesto_policy,100)||
       typeof player.is_ready!=='boolean'||!isTimestamp(player.joined_at)||
       ids.has(player.user_id)||seats.has(player.seat_no))return fail()
    ids.add(player.user_id);seats.add(player.seat_no)
  }
  const me=players.find(p=>obj(p)&&p.user_id===ownerMe.user_id) as Record<string,unknown>|undefined
  if(!me||me.seat_no!==ownerMe.seat_no||me.party_name!==ownerMe.party_name||
     !ids.has(String(raw.match.host_user_id)))return fail()
  if(raw.cohorts.some(c=>!obj(c)||c.government_id!==governmentId||
     !nonempty(c.code)||!isScore(c.support)||!isScore(c.trust)||
     !isCount(c.population_weight,100)))return fail()
  const dossiers=new Set<string>()
  for(const d of raw.dossiers) {
    if(!obj(d)||!nonempty(d.id)||!isCount(d.version,100000)||d.version<1||
       !nonempty(d.title)||!['intro','weekly'].includes(String(d.release_kind)))return fail()
    const k=d.id+':'+d.version
    if(dossiers.has(k))return fail()
    dossiers.add(k)
  }
  const optionIds=new Set<string>()
  for(const option of raw.options) {
    if(!obj(option)||!nonempty(option.id)||!nonempty(option.dossier_id)||
       !isCount(option.dossier_version,100000)||!dossiers.has(option.dossier_id+':'+option.dossier_version))return fail()
    const key=option.dossier_id+':'+option.dossier_version+':'+option.id
    if(optionIds.has(key))return fail()
    optionIds.add(key)
  }
  if(raw.events.some(e=>!obj(e)||e.government_id!==governmentId||
       !nonempty(e.id)||!nonempty(e.dossier_id)))return fail()
  if(raw.stances.some(s=>!obj(s)||s.match_id!==matchId||
       !ids.has(String(s.user_id))||!nonempty(s.dossier_id)||
       !nonempty(s.option_id)))return fail()
  return raw as unknown as MatchWorld
}

export async function fetchMatchWorld(matchId: string): Promise<MatchWorld> {
  return validateMatchWorld(await rpc<unknown>('get_match_world',{
    p_match_id:matchId
  }),matchId)
}

/** Calendar settlement and signed Friday acts remain server-owned evidence. */
export function validateMatchCalendar(raw:unknown,matchId:string):MatchCalendar {
  const fail=():never=>{throw new Error('CALENDAR_INVALID_RESPONSE')}
  if(!obj(raw)||!isUtcDay(raw.gameDay)||!isUtcDay(raw.monday)||
     !isUtcDay(raw.friday)||
     new Date(raw.monday+'T00:00:00Z').getUTCDay()!==1||
     daySpan(raw.monday,raw.friday)!==5||
     raw.monday>raw.gameDay||daySpan(raw.monday,raw.gameDay)>7||
     typeof raw.fridayReached!=='boolean'||
     raw.fridayReached!==(raw.gameDay>=raw.friday)||
     typeof raw.weeklyPublished!=='boolean'||
     !isCount(raw.weeklyTotal,10)||!isCount(raw.weeklyResolved,10)||
     raw.weeklyResolved>raw.weeklyTotal||
     (!raw.weeklyPublished&&(raw.weeklyTotal!==0||raw.weeklyResolved!==0)))return fail()
  if(raw.latestFriday!==null){
    const act=raw.latestFriday
    if(!obj(act)||act.match_id!==matchId||!isUtcDay(act.week_start)||
      act.week_start>raw.gameDay||
      new Date(act.week_start+'T00:00:00Z').getUTCDay()!==1||
      !isTimestamp(act.closed_at)||act.engine_version!=='friday-ledger-v1'||
      !isCount(act.dossiers_published,10)||!isCount(act.decisions_resolved,10)||
      act.decisions_resolved>act.dossiers_published||
      typeof act.treasury_delta_m_eur!=='number'||!Number.isFinite(act.treasury_delta_m_eur)||
      !isNonNegative(act.treasury_at_friday_m_eur)||
      !isScore(act.approval_at_friday)||!isScore(act.trust_at_friday))return fail()
  }
  return raw as unknown as MatchCalendar
}

export async function fetchMatchCalendar(matchId: string): Promise<MatchCalendar> {
  return validateMatchCalendar(await rpc<unknown>('get_match_calendar',{
    p_match_id:matchId
  }),matchId)
}

const messages: Record<string, string> = {
  MATCH_INVALID_NAME: 'El nombre debe tener entre 3 y 80 caracteres (partido: máximo 60).',
  MATCH_INVITE_NOT_FOUND: 'El código de invitación no corresponde a una partida.',
  MATCH_FULL: 'La partida ya tiene diez partidos.',
  MATCH_ALREADY_STARTED: 'La partida ya comenzó y no admite nuevos participantes.',
  MATCH_PARTY_NAME_TAKEN: 'Ya existe un partido con ese nombre.',
  MATCH_FORBIDDEN: 'No perteneces a esta partida o no tienes permiso para esa acción.',
  MATCH_REQUIRES_TWO_PLAYERS: 'Se necesitan al menos dos partidos para comenzar.',
  MATCH_PARTIES_NOT_READY: 'Hay partidos que todavía no han confirmado su preparación.',
  MATCH_INVALID_READY: 'Debes indicar un estado de preparación válido.',
  MATCH_HOST_CANNOT_LEAVE: 'El anfitrión no puede abandonar su propia convocatoria.',
  MATCH_LOBBY_MUTATION_NOT_CONFIRMED: 'El servidor no confirmó el cambio de estado.',
  MATCH_NOT_ACTIVE: 'La partida aún no está activa.',
  MATCH_STANCE_ALREADY_RECORDED: 'Ya fijaste una posición distinta para este expediente.',
  MATCH_INVALID_RESPONSE: 'La respuesta de la partida no es válida.',
  CALENDAR_INVALID_RESPONSE: 'El calendario recibido no es válido.',
  PARLIAMENT_APPROVAL_REQUIRED: 'El Parlamento debe aprobar la medida antes de firmarla.',
  PARLIAMENT_BILL_OPEN: 'Ya existe una propuesta abierta para este expediente.',
  PARLIAMENT_ALREADY_APPROVED: 'El Parlamento ya aprobó una medida para este expediente.',
  PARLIAMENT_VOTE_LOCKED: 'Tu voto es definitivo y no puede cambiarse.',
  PARLIAMENT_VOTE_CLOSED: 'La votación ya está cerrada.',
  PARLIAMENT_INVALID_VOTE: 'El voto seleccionado no es válido.',
  PARLIAMENT_INVALID_RESPONSE: 'La respuesta del Parlamento no es válida.',
  ELECTION_NOT_DUE: 'Aún no ha llegado la fecha de las elecciones.',
  ELECTION_CAMPAIGN_CLOSED: 'La campaña está cerrada: ya no puedes cambiar el programa.',
  ELECTION_INVALID_POLICY: 'La posición política debe estar entre 0 y 100.',
  ELECTION_PARLIAMENT_OPEN: 'Cierra primero las votaciones parlamentarias abiertas.',
  ELECTION_NO_MANDATE: 'Tu partido no tiene escaños y no puede votar.',
  ELECTION_INVALID_RESPONSE: 'El estado electoral recibido no es válido.',
  DOSSIER_NOT_AVAILABLE: 'Este expediente todavía no está disponible.',
  INVALID_OPTION: 'La opción seleccionada no existe.'
}

export function matchError(reason: unknown): string {
  const message = reason instanceof Error ? reason.message : String(reason)
  const code = Object.keys(messages).find(key => message.includes(key))
  return code ? messages[code] : message
}
