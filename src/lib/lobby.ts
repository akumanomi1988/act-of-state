import {requireClient} from './game'

async function changeBoolean(name:string,params:Record<string,unknown>,expected:boolean) {
  const {data,error}=await requireClient().rpc(name,params)
  if(error)throw error
  if(data!==expected)throw new Error('MATCH_LOBBY_MUTATION_NOT_CONFIRMED')
}

export function setMatchReady(matchId:string,ready:boolean) {
  return changeBoolean('set_match_ready',{p_match_id:matchId,p_ready:ready},ready)
}

export function setMatchReadinessRequirement(matchId:string,required:boolean) {
  return changeBoolean('set_match_readiness_requirement',{
    p_match_id:matchId,p_required:required
  },required)
}

/** Permanent member withdrawal is only permitted before the host starts play. */
export function leaveLobby(matchId:string) {
  return changeBoolean('leave_match',{p_match_id:matchId},true)
}

export function isInviteCode(code:string):boolean {
  return /^[a-f0-9]{32}$/i.test(code)
}

export function invitationUrl(origin:string,code:string) {
  if(!isInviteCode(code))throw new Error('MATCH_INVITE_NOT_FOUND')
  const location=new URL('/multiplayer',origin)
  location.searchParams.set('invite',code.toLowerCase())
  return location.toString()
}

export function inviteCodeFromQuery(search:string):string|null {
  const code=new URLSearchParams(search).get('invite')
  return code && isInviteCode(code) ? code.toLowerCase() : null
}
