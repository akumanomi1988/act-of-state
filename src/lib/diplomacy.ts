import { requireClient } from './game'

export interface DiplomaticBloc {
  id: 'europe' | 'asia' | 'usa'
  label: string
  relation: number
  tradeIndex: number
  signedEffects: number
}
export interface DiplomaticEffect {
  eventId: string
  bloc: DiplomaticBloc['id']
  dossierId: string
  optionId: string
  title: string
  choice: string
  relationDelta: number
  tradeDelta: number
  signedAt: string
}
export interface DiplomacyState {
  governmentId: string
  modelVersion: 'diplomacy-v1'
  blocs: DiplomaticBloc[]
  recentEffects: DiplomaticEffect[]
}

/** Never substitute local guesses for the authoritative diplomacy ledger. */
export function parseDiplomacyState(value: unknown, governmentId: string): DiplomacyState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw Error('DIPLOMACY_INVALID_RESPONSE')
  }
  const state=value as Partial<DiplomacyState>
  const codes=['europe','asia','usa']
  const whole=(x:unknown,min:number,max:number):boolean=>typeof x==='number'&&
    Number.isSafeInteger(x)&&x>=min&&x<=max
  if (state.governmentId!==governmentId || state.modelVersion!=='diplomacy-v1'
    || !Array.isArray(state.blocs) || state.blocs.length!==3
    || !state.blocs.every((b,i)=>b && b.id===codes[i] &&
      typeof b.label==='string'&&b.label.length>0 && whole(b.relation,0,100) &&
      whole(b.tradeIndex,0,200) && whole(b.signedEffects,0,100000))
    || !Array.isArray(state.recentEffects) || state.recentEffects.length>30
    || !state.recentEffects.every(e=>e && codes.includes(e.bloc)
      && typeof e.eventId==='string' && e.eventId.length>0
      && typeof e.dossierId==='string' && e.dossierId.length>0
      && typeof e.optionId==='string' && e.optionId.length>0
      && typeof e.title==='string' && typeof e.choice==='string'
      && typeof e.signedAt==='string' && !Number.isNaN(Date.parse(e.signedAt))
      && whole(e.relationDelta,-20,20) && whole(e.tradeDelta,-10,10))) {
    throw Error('DIPLOMACY_INVALID_RESPONSE')
  }
  return state as DiplomacyState
}
export async function fetchDiplomacy(governmentId:string):Promise<DiplomacyState> {
  const {data,error}=await requireClient().rpc('get_diplomacy_state',{
    p_government_id:governmentId
  })
  if(error)throw error
  return parseDiplomacyState(data,governmentId)
}

