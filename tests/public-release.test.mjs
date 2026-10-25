import test from 'node:test'
import assert from 'node:assert/strict'
import { validTarget, inspectPublicRelease } from '../scripts/check-public-release.mjs'
import {createReleaseContract} from '../scripts/release-contract.mjs'

test('production smoke may contact only the approved game host or local fixtures',()=>{
  assert.equal(validTarget('https://act-of-state.vercel.app/'),'https://act-of-state.vercel.app')
  assert.equal(validTarget('http://127.0.0.1:4173/'),'http://127.0.0.1:4173')
  for(const invalid of ['https://example.org/','https://act-of-state.vercel.app.evil.org/',
    'http://act-of-state.vercel.app/','https://api.supabase.co/',
    'https://act-of-state.vercel.app/login','https://user:pw@act-of-state.vercel.app/',
    'https://act-of-state.vercel.app/?token=foo'])
    assert.throws(()=>validTarget(invalid),/AOS_RELEASE_/)
})

test('rejects a stale deployment even if a manifest is syntactically correct',async()=>{
  const saved=globalThis.fetch
  globalThis.fetch=async()=>new Response(JSON.stringify(createReleaseContract({
    GITHUB_SHA:'a'.repeat(40)
  })),{status:200,headers:{'content-type':'application/json'}})
  try{
    await assert.rejects(inspectPublicRelease('http://127.0.0.1:4173','b'.repeat(40)),
      /DEPLOYED_BUILD_NOT_MATCHING_GITHUB_MAIN/)
  }finally{globalThis.fetch=saved}
})

test('validates every public route and a fingerprinted JS asset without a login',async()=>{
  const saved=globalThis.fetch
  const calls=[]
  globalThis.fetch=async value=>{
    const path=new URL(value).pathname;calls.push(path)
    if(path==='/release.json')return new Response(JSON.stringify(createReleaseContract({
      GITHUB_SHA:'c'.repeat(40)
    })),{status:200,headers:{'content-type':'application/json'}})
    if(path==='/assets/index-123.js')
      return new Response('/* valid bundle */'+'x'.repeat(1200),{
        headers:{'content-type':'application/javascript'}})
    return new Response('<!doctype html><div id="root"></div><script src="/assets/index-123.js"></script>',{
      headers:{'content-type':'text/html'}})
  }
  try{
    const result=await inspectPublicRelease('http://127.0.0.1:4173','c'.repeat(40))
    assert.equal(result.routeCount,6)
    assert.equal(result.publicOnly,true)
    assert.deepEqual(calls,[
      '/release.json','/','/demo','/guide','/multiplayer','/editorial','/status',
      '/assets/index-123.js'
    ])
  }finally{globalThis.fetch=saved}
})
