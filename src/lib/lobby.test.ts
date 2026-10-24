import {beforeEach,describe,expect,it,vi} from 'vitest'
import {
  setMatchReady,setMatchReadinessRequirement,leaveLobby,
  isInviteCode,invitationUrl,inviteCodeFromQuery
} from './lobby'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
beforeEach(()=>vi.clearAllMocks())
const matchId='a0000000-0000-4000-8000-000000000002'
const code='ABCD1234ABCD1234ABCD1234ABCD1234'
describe('AOS-036 lobby and deep-link API',()=>{
 it('rejects malformed invite parameters and creates shareable HTTPS URLs',()=>{
  expect(isInviteCode(code)).toBe(true)
  expect(isInviteCode('javascript:alert(1)')).toBe(false)
  expect(isInviteCode(code+'x')).toBe(false)
  expect(inviteCodeFromQuery('?invite='+code)).toBe(code.toLowerCase())
  expect(inviteCodeFromQuery('?invite=javascript%3Aalert(1)')).toBeNull()
  expect(inviteCodeFromQuery('?foo=bar')).toBeNull()
  expect(invitationUrl('https://game.example.com',code))
   .toBe('https://game.example.com/multiplayer?invite='+code.toLowerCase())
  expect(()=>invitationUrl('https://game.example.com','invalid')).toThrow('MATCH_INVITE_NOT_FOUND')
 })
 it('confirms each authorized server mutation',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:true,error:null})
   .mockResolvedValueOnce({data:false,error:null})
   .mockResolvedValueOnce({data:true,error:null})
  await setMatchReady(matchId,true)
  await setMatchReadinessRequirement(matchId,false)
  await leaveLobby(matchId)
  expect(mocks.rpc.mock.calls.map(([name])=>name)).toEqual([
   'set_match_ready','set_match_readiness_requirement','leave_match'
  ])
  expect(mocks.rpc.mock.calls[0][1]).toEqual({p_match_id:matchId,p_ready:true})
 })
 it('fails closed when a server rejects, or silently fails a mutation',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:false,error:null})
  await expect(setMatchReady(matchId,true)).rejects.toThrow('MATCH_LOBBY_MUTATION_NOT_CONFIRMED')
  mocks.rpc.mockResolvedValueOnce({data:null,error:{message:'MATCH_FORBIDDEN'}})
  await expect(leaveLobby(matchId)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
 })
})
