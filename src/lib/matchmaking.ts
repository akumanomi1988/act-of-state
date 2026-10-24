import { requireClient } from './game'

/** Public directory omits host identity, invite code and player profiles. */
export interface PublicLobby {
  id: string
  title: string
  player_count: number
  open_seats: number
  created_at: string
}

export function isPublicLobby(data: unknown): data is PublicLobby {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false
  const lobby = data as Partial<PublicLobby>
  return typeof lobby.id === 'string' && /^[0-9a-f-]{36}$/i.test(lobby.id) &&
    typeof lobby.title === 'string' && lobby.title.trim().length >= 3 &&
    lobby.title.length <= 80 &&
    Number.isInteger(lobby.player_count) && lobby.player_count! >= 1 &&
    lobby.player_count! < 10 &&
    Number.isInteger(lobby.open_seats) &&
    lobby.open_seats === 10-lobby.player_count! &&
    typeof lobby.created_at === 'string' && !Number.isNaN(Date.parse(lobby.created_at))
}

export async function listPublicLobbies(): Promise<PublicLobby[]> {
  const { data, error } = await requireClient().rpc('list_public_lobbies')
  if (error) throw error
  if (!Array.isArray(data) || data.length > 40 || !data.every(isPublicLobby))
    throw new Error('MATCH_PUBLIC_DIRECTORY_INVALID')
  return data
}

export async function setMatchVisibility(matchId: string, publicLobby: boolean): Promise<void> {
  const { data, error } = await requireClient().rpc('set_match_visibility', {
    p_match_id: matchId, p_is_public: publicLobby
  })
  if (error) throw error
  if (data !== publicLobby) throw new Error('MATCH_VISIBILITY_NOT_CONFIRMED')
}

export async function joinPublicLobby(matchId: string, partyName: string): Promise<string> {
  const { data, error } = await requireClient().rpc('join_public_lobby', {
    p_match_id: matchId,p_party_name: partyName.trim()
  })
  if (error) throw error
  if (!data || typeof data.match_id !== 'string' || typeof data.user_id !== 'string')
    throw new Error('MATCH_JOIN_NOT_CONFIRMED')
  return data.match_id
}
