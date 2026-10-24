import {beforeEach,describe,it,expect,vi} from 'vitest'
import {fetchActionInbox,markInboxRead} from './actionInbox'
const mocks=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocks.rpc})}))
const mid='98000000-0000-4000-8000-000000000001'
const item={key:'parliament:00000000-0000-4000-8000-000000000001',
 kind:'action',section:'parliament',title:'Votación parlamentaria pendiente',
 detail:'Expediente energético',dossierId:'energy-resilience',read:false}
beforeEach(()=>vi.clearAllMocks())
describe('AOS-038 political inbox server contract',()=>{
 it('reads a server-confirmed member-only task snapshot',async()=>{
  mocks.rpc.mockResolvedValue({data:{matchId:mid,serverDay:'2026-10-24',
   unreadCount:1,items:[item]},error:null})
  const response=await fetchActionInbox(mid)
  expect(response.items[0].dossierId).toBe('energy-resilience')
  expect(mocks.rpc).toHaveBeenCalledWith('get_match_action_inbox',{p_match_id:mid})
 })
 it('rejects mismatched identities, invented unread counts and unknown section names',async()=>{
  for(const change of [
   {matchId:'different',serverDay:'2026-10-24',unreadCount:1,items:[item]},
   {matchId:mid,serverDay:'2026-10-24',unreadCount:0,items:[item]},
   {matchId:mid,serverDay:'2026-10-24',unreadCount:1,
    items:[{...item,section:'admin'}]},
   {matchId:mid,serverDay:'2026-10-24',unreadCount:2,items:[item,item]}
  ]){
   mocks.rpc.mockResolvedValueOnce({data:change,error:null})
   await expect(fetchActionInbox(mid)).rejects.toThrow('INBOX_INVALID_RESPONSE')
  }
 })
 it('accepts read receipts only after the server commits',async()=>{
  mocks.rpc.mockResolvedValueOnce({data:true,error:null})
   .mockResolvedValueOnce({data:false,error:null})
   .mockResolvedValueOnce({data:null,error:{message:'MATCH_FORBIDDEN'}})
  await markInboxRead(mid,item.key)
  expect(mocks.rpc.mock.calls[0]).toEqual(['mark_match_inbox_read',{
   p_match_id:mid,p_task_key:item.key
  }])
  await expect(markInboxRead(mid,item.key)).rejects.toThrow('INBOX_READ_NOT_CONFIRMED')
  await expect(markInboxRead(mid,item.key)).rejects.toEqual({message:'MATCH_FORBIDDEN'})
 })
})
