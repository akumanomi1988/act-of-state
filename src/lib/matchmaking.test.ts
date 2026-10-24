import { beforeEach,describe,expect,it,vi } from 'vitest'
import { isPublicLobby, listPublicLobbies,setMatchVisibility,joinPublicLobby } from './matchmaking'

const mock=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mock.rpc})}))
const lobby={id:'c0000000-0000-4000-8000-000000000001',
  title:'Regional Council',player_count:3,open_seats:7,created_at:'2026-10-24T10:00:00Z'}

describe('server-authoritative matchmaking client',()=>{
  beforeEach(()=>vi.clearAllMocks())
  it('validates safe, bounded lobby responses',()=>{
    expect(isPublicLobby(lobby)).toBe(true)
    expect(isPublicLobby({...lobby,open_seats:10})).toBe(false)
    expect(isPublicLobby({...lobby,player_count:10,open_seats:0})).toBe(false)
    expect(isPublicLobby({...lobby,invite_code:'secret'})).toBe(true)
  })
  it('reads at most 40 validated public entries',async()=>{
    mock.rpc.mockResolvedValueOnce({data:[lobby],error:null})
    expect(await listPublicLobbies()).toEqual([lobby])
    mock.rpc.mockResolvedValueOnce({data:[{...lobby,open_seats:-1}],error:null})
    await expect(listPublicLobbies()).rejects.toThrow('MATCH_PUBLIC_DIRECTORY_INVALID')
  })
  it('requires confirmed toggles and joined server seat',async()=>{
    mock.rpc.mockResolvedValueOnce({data:true,error:null})
    await setMatchVisibility(lobby.id,true)
    expect(mock.rpc).toHaveBeenCalledWith('set_match_visibility',
      {p_match_id:lobby.id,p_is_public:true})
    mock.rpc.mockResolvedValueOnce({data:false,error:null})
    await expect(setMatchVisibility(lobby.id,true)).rejects.toThrow('MATCH_VISIBILITY_NOT_CONFIRMED')
    mock.rpc.mockResolvedValueOnce({data:{match_id:lobby.id,user_id:'u1'},error:null})
    expect(await joinPublicLobby(lobby.id,' Civic Reform ')).toBe(lobby.id)
    expect(mock.rpc).toHaveBeenLastCalledWith('join_public_lobby',
      {p_match_id:lobby.id,p_party_name:'Civic Reform'})
  })
})
