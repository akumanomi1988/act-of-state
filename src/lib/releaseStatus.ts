export interface PublicRelease {
  schema:1
  product:'act-of-state'
  commit:string|null
  builtAt:string
  models:{elections:'electoral-districts-v2';campaigns:'campaign-decay-v2'}
  routes:string[]
}
export function readPublicRelease(value:unknown):PublicRelease {
  if(!value||typeof value!=='object'||Array.isArray(value))
    throw new Error('RELEASE_INVALID_RESPONSE')
  const x=value as Partial<PublicRelease>
  if(x.schema!==1||x.product!=='act-of-state'||
    (x.commit!==null && (typeof x.commit!=='string'||
      !/^[0-9a-f]{40}$/.test(x.commit)))||
    typeof x.builtAt!=='string'||Number.isNaN(Date.parse(x.builtAt))||
    x.models?.elections!=='electoral-districts-v2'||
    x.models.campaigns!=='campaign-decay-v2'||
    !Array.isArray(x.routes)||
    !['/','/demo','/guide','/multiplayer','/editorial','/status']
      .every(route=>x.routes?.includes(route))) {
    throw new Error('RELEASE_INVALID_RESPONSE')
  }
  return x as PublicRelease
}

/** Safe, public-only availability probe; no credentials or account data. */
export function publicAuthHealthUrl(candidate:string|undefined):string|null {
  if(!candidate)return null
  try {
    const url=new URL(candidate)
    if(url.protocol!=='https:'&&
      !(url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname)))
      return null
    if(url.username||url.password||url.search||url.hash||url.pathname!=='/')return null
    return url.origin+'/auth/v1/health'
  } catch { return null }
}
