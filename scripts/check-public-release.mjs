/**
 * External black-box verification for a deployed Vite SPA.
 * Zero login, writes, privileged keys or synthetic production accounts.
 * Does not claim full backend health or live human acceptance.
 */
import assert from 'node:assert/strict'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'
import { REQUIRED_ROUTES, validateReleaseContract } from './release-contract.mjs'

export function validTarget(value) {
  const url=new URL(value)
  const local=['localhost','127.0.0.1'].includes(url.hostname)
  if(!(url.protocol==='https:' && (url.hostname==='act-of-state.vercel.app'||
      url.hostname==='act-of-state-nexttapstudios.vercel.app'||
      url.hostname.endsWith('-nexttapstudios.vercel.app'))) &&
      !(local&&url.protocol==='http:'))throw new Error('AOS_RELEASE_UNTRUSTED_HOST')
  if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||
    (url.port && !local))throw new Error('AOS_RELEASE_INVALID_TARGET')
  return url.origin
}
async function get(base,path) {
  const response=await fetch(base+path,{redirect:'error',signal:AbortSignal.timeout(12000),
    headers:{'Cache-Control':'no-cache'}})
  assert.equal(response.status,200,'Host did not serve '+path)
  return response
}
export async function inspectPublicRelease(base,commit) {
  const origin=validTarget(base)
  assert.match(commit,/^[0-9a-f]{40}$/,'Expected a concrete 40-character commit')
  const manifestResponse=await get(origin,'/release.json')
  assert.match(manifestResponse.headers.get('content-type')??'',/application\/json/,
    'Release manifest was rewritten to HTML or served with invalid content-type')
  const manifest=validateReleaseContract(await manifestResponse.json())
  assert.equal(manifest.commit,commit,
    'DEPLOYED_BUILD_NOT_MATCHING_GITHUB_MAIN; do not certify stale UI')
  const html=[]
  for(const route of REQUIRED_ROUTES) {
    const response=await get(origin,route)
    const type=response.headers.get('content-type')??''
    assert.match(type,/text\/html/,route+' was not served as a browser page')
    const body=await response.text()
    assert.match(body,/<div id="root"><\/div>/,route+' is not the reviewed React SPA')
    html.push(body)
  }
  // Verify the JS asset that production HTML actually references, not just
  // the release.json metadata, to detect a stale caching or broken rewrite.
  const found=html[0].match(/(?:src|href)="(\/assets\/[^"]+\.js)"/)
  assert.ok(found,'Production index has no fingerprinted Vite JavaScript asset')
  const asset=await get(origin,found[1])
  assert.match(asset.headers.get('content-type')??'',/javascript|ecmascript/,
    'Bundled JavaScript is not served with script MIME')
  assert.ok((await asset.text()).length>1000,'Production JavaScript bundle is empty')
  return {origin,commit,routeCount:REQUIRED_ROUTES.length,asset:found[1],
    models:manifest.models,publicOnly:true}
}
if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  const base=process.env.AOS_PUBLIC_BASE_URL
  const sha=process.env.AOS_EXPECT_SHA
  if(!base||!sha)throw new Error('RELEASE_TARGET_AND_COMMIT_REQUIRED')
  try{const receipt=await inspectPublicRelease(base,sha)
    console.log('AOS_PUBLIC_RELEASE_PASS',JSON.stringify(receipt))}
  catch(error){console.error('AOS_PUBLIC_RELEASE_FAILURE',error.message);process.exitCode=1}
}
