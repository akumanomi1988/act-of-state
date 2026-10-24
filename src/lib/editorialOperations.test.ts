import {describe,it,expect,vi,beforeEach} from 'vitest'
import {fetchEditorialReviews,reviewEditorialSlot,fetchEditorialStaff,manageEditorialStaff} from './editorialOperations'
const mocked=vi.hoisted(()=>({rpc:vi.fn()}))
vi.mock('./game',()=>({requireClient:()=>({rpc:mocked.rpc})}))
beforeEach(()=>vi.clearAllMocks())
describe('editorial operations typed backend boundaries',()=>{
 it('loads approved slots and rejects malformed payloads',async()=>{
  mocked.rpc.mockResolvedValueOnce({data:[{
   dossier_id:'d1',reviewed_by:'p1',reviewed_at:'2026-10-24T12:00:00Z'
  }],error:null})
  expect(await fetchEditorialReviews('2026-10-26')).toHaveLength(1)
  expect(mocked.rpc).toHaveBeenCalledWith('get_editorial_review_state',
   {p_week_start:'2026-10-26'})
  mocked.rpc.mockResolvedValueOnce({data:[{dossier_id:'d1'}],error:null})
  await expect(fetchEditorialReviews('2026-10-26')).rejects.toThrow('EDITORIAL_REVIEW_INVALID')
 })
 it('confirms revision-bound review and role update server responses',async()=>{
  mocked.rpc.mockResolvedValueOnce({data:{
   dossier_id:'weekly-2026-10-26-01',revision:3,approved:true
  },error:null})
  await reviewEditorialSlot('2026-10-26',3,'weekly-2026-10-26-01',true)
  mocked.rpc.mockResolvedValueOnce({data:{role:'editor',user_id:'u2'},error:null})
  await manageEditorialStaff(' alice@example.test ','editor')
  expect(mocked.rpc).toHaveBeenLastCalledWith('manage_editorial_member',
   {p_email:'alice@example.test',p_role:'editor'})
  mocked.rpc.mockResolvedValueOnce({data:{role:'publisher',user_id:'u2'},error:null})
  await expect(manageEditorialStaff('alice@example.test',null))
   .rejects.toThrow('EDITORIAL_STAFF_NOT_CONFIRMED')
 })
 it('publishes only validated lists of staff',async()=>{
  mocked.rpc.mockResolvedValueOnce({data:[{
   user_id:'u1',email:'boss@example.test',role:'publisher'
  }],error:null})
  expect(await fetchEditorialStaff()).toHaveLength(1)
  mocked.rpc.mockResolvedValueOnce({data:[{email:'oops'}],error:null})
  await expect(fetchEditorialStaff()).rejects.toThrow('EDITORIAL_STAFF_INVALID')
 })
})
