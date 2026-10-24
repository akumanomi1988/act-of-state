import { requireClient } from './game'

export type InboxSection =
  'lobby'|'dossiers'|'parliament'|'governance'|'campaign'|'election'|'history'
export interface ActionInboxItem {
  key:string
  kind:'action'|'news'
  section:InboxSection
  title:string
  detail:string
  dossierId:string|null
  read:boolean
}
export interface ActionInbox {
  matchId:string
  serverDay:string
  unreadCount:number
  items:ActionInboxItem[]
}
const validSections=new Set<InboxSection>([
  'lobby','dossiers','parliament','governance','campaign','election','history'
])
function obj(value:unknown):value is Record<string,unknown> {
  return !!value&&typeof value==='object'&&!Array.isArray(value)
}
function validItem(item:unknown):item is ActionInboxItem {
  return obj(item)&&typeof item.key==='string'&&
    item.key.length>=3&&item.key.length<=160&&
    (item.kind==='action'||item.kind==='news')&&
    typeof item.section==='string'&&validSections.has(item.section as InboxSection)&&
    typeof item.title==='string'&&item.title.length>0&&
    typeof item.detail==='string'&&typeof item.read==='boolean'&&
    (item.dossierId===null||typeof item.dossierId==='string')
}
export async function fetchActionInbox(matchId:string):Promise<ActionInbox>{
  const {data,error}=await requireClient().rpc('get_match_action_inbox',{
    p_match_id:matchId
  })
  if(error)throw error
  if(!obj(data)||data.matchId!==matchId||
    typeof data.serverDay!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(data.serverDay)||
    !Array.isArray(data.items)||data.items.length>45||
    !data.items.every(validItem)||!Number.isInteger(data.unreadCount)||
    Number(data.unreadCount)<0||
    data.unreadCount!==data.items.filter((item:ActionInboxItem)=>!item.read).length||
    new Set(data.items.map((item:ActionInboxItem)=>item.key)).size!==data.items.length)
    throw new Error('INBOX_INVALID_RESPONSE')
  return data as unknown as ActionInbox
}
export async function markInboxRead(matchId:string,taskKey:string):Promise<void>{
  if(!taskKey||taskKey.length>160)throw new Error('INBOX_INVALID_KEY')
  const {data,error}=await requireClient().rpc('mark_match_inbox_read',{
    p_match_id:matchId,p_task_key:taskKey
  })
  if(error)throw error
  if(data!==true)throw new Error('INBOX_READ_NOT_CONFIRMED')
}
