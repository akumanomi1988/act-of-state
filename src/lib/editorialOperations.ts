import { requireClient } from './game'
import type { EditorialRole } from './editorial'

export interface EditorialReview {
  dossier_id: string
  reviewed_by: string
  reviewed_at: string
}
export interface EditorialStaff {
  user_id: string
  email: string
  role: EditorialRole
}
export async function fetchEditorialReviews(week: string): Promise<EditorialReview[]> {
  const {data,error}=await requireClient().rpc('get_editorial_review_state',{p_week_start:week})
  if(error)throw error
  if(!Array.isArray(data)||data.length>10||!data.every(r=>
      typeof r.dossier_id==='string'&&typeof r.reviewed_by==='string'&&
      typeof r.reviewed_at==='string'))throw new Error('EDITORIAL_REVIEW_INVALID')
  return data
}
export async function reviewEditorialSlot(week:string,revision:number,id:string,approve:boolean) {
  const {data,error}=await requireClient().rpc('review_editorial_slot',{
    p_week_start:week,p_expected_revision:revision,p_dossier_id:id,p_approved:approve
  })
  if(error)throw error
  if(data?.dossier_id!==id||data?.approved!==approve||data?.revision!==revision)
    throw new Error('EDITORIAL_REVIEW_NOT_CONFIRMED')
}
export async function fetchEditorialStaff():Promise<EditorialStaff[]> {
  const {data,error}=await requireClient().rpc('get_editorial_staff')
  if(error)throw error
  if(!Array.isArray(data)||data.length>25||!data.every(user=>
      typeof user.user_id==='string'&&typeof user.email==='string'&&
      (user.role==='editor'||user.role==='publisher')))
    throw new Error('EDITORIAL_STAFF_INVALID')
  return data
}
export async function manageEditorialStaff(email:string,role:EditorialRole|null) {
  const {data,error}=await requireClient().rpc('manage_editorial_member',{
    p_email:email.trim(),p_role:role
  })
  if(error)throw error
  if(data?.role!==role||typeof data?.user_id!=='string')
    throw new Error('EDITORIAL_STAFF_NOT_CONFIRMED')
}
