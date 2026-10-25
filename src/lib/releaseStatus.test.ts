import { describe,expect,it } from 'vitest'
import { readPublicRelease,publicAuthHealthUrl } from './releaseStatus'

const release={
  schema:1,product:'act-of-state',commit:'a'.repeat(40),
  builtAt:'2026-10-25T20:00:00.000Z',
  models:{elections:'electoral-districts-v2',campaigns:'campaign-decay-v2'},
  routes:['/','/demo','/guide','/multiplayer','/editorial','/status']
}

describe('public read-only release identity',()=>{
  it('accepts an exact commit and the required historical-compatible model contracts',()=>{
    expect(readPublicRelease(release).commit).toBe('a'.repeat(40))
  })
  it('rejects cache poisoning, missing routes and outdated model versions',()=>{
    for(const invalid of [
      undefined,null,[],{},
      {...release,commit:'main'},
      {...release,product:'fake-game'},
      {...release,models:{...release.models,elections:'electoral-districts-v1'}},
      {...release,routes:release.routes.slice(0,5)},
      {...release,builtAt:'invalid'},
      {...release,schema:9}
    ])expect(()=>readPublicRelease(invalid)).toThrow('RELEASE_INVALID_RESPONSE')
  })
  it('checks only permitted public Auth health URLs and never accepts credentials',()=>{
    expect(publicAuthHealthUrl('https://nwlxkqwbusrrldveijzb.supabase.co/'))
      .toBe('https://nwlxkqwbusrrldveijzb.supabase.co/auth/v1/health')
    expect(publicAuthHealthUrl('http://127.0.0.1:54321/'))
      .toBe('http://127.0.0.1:54321/auth/v1/health')
    for(const value of [
      undefined,'http://random.example.org/','https://user:password@something.test/',
      'https://supabase.co/path','https://supabase.co/?secret=x','bad url'
    ])expect(publicAuthHealthUrl(value)).toBeNull()
  })
})
