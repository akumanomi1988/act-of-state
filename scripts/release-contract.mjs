/**
 * AOS-049 public release contract. No secrets, tokens or user data.
 * The production Git commit is captured at BUILD time by Vercel, not
 * inferred from the visitor's local clock or a mutable GitHub branch.
 */
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const RELEASE_SCHEMA=1
export const REQUIRED_MODELS=Object.freeze({
  elections:'electoral-districts-v2',
  campaigns:'campaign-decay-v2'
})
export const MIGRATION='20261025194413_aos_048_campaign_relevance_decay.sql'
export const REQUIRED_ROUTES=Object.freeze([
  '/','/demo','/guide','/multiplayer','/editorial','/status'
])

export function createReleaseContract(environment=process.env, date=new Date()) {
  const candidate=environment.VERCEL_GIT_COMMIT_SHA ??
    environment.GITHUB_SHA ?? environment.AOS_BUILD_SHA ?? null
  const commit=typeof candidate==='string' && /^[0-9a-f]{40}$/i.test(candidate)
    ? candidate.toLowerCase() : null
  if(Number.isNaN(date.getTime()))throw new Error('INVALID_BUILD_DATE')
  return {
    schema:RELEASE_SCHEMA,
    product:'act-of-state',
    commit,
    builtAt:date.toISOString(),
    models:REQUIRED_MODELS,
    routes:REQUIRED_ROUTES
  }
}

export function validateReleaseContract(source) {
  if(!source || typeof source!=='object'||Array.isArray(source)||
    source.schema!==RELEASE_SCHEMA || source.product!=='act-of-state'||
    !(source.commit===null ||
      (typeof source.commit==='string'&&/^[0-9a-f]{40}$/.test(source.commit)))||
    typeof source.builtAt!=='string'||Number.isNaN(Date.parse(source.builtAt))||
    !source.models||typeof source.models!=='object'||
    source.models.elections!==REQUIRED_MODELS.elections||
    source.models.campaigns!==REQUIRED_MODELS.campaigns||
    !Array.isArray(source.routes)||
    REQUIRED_ROUTES.some(route=>!source.routes.includes(route))) {
    throw new Error('AOS_RELEASE_CONTRACT_INVALID')
  }
  return source
}

export function emitReleaseContract(root=process.cwd(),env=process.env) {
  // Source and database model must always be updated together.
  const migration=resolve(root,'supabase','migrations',MIGRATION)
  const sql=readFileSync(migration,'utf8')
  if(!sql.includes("'electoral-districts-v2'")||
     !sql.includes("'campaign-decay-v2'"))throw new Error('DATABASE_RELEASE_MODEL_MISMATCH')
  const release=validateReleaseContract(createReleaseContract(env))
  if(env.VERCEL && !release.commit)throw new Error('VERCEL_RELEASE_MISSING_COMMIT')
  const output=resolve(root,'public','release.json')
  mkdirSync(dirname(output),{recursive:true})
  writeFileSync(output,JSON.stringify(release,null,2)+'\n','utf8')
  return {output,release}
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(process.argv[2]!=='--emit')throw new Error('EXPECTED_EMIT_MODE')
  const {release}=emitReleaseContract()
  console.log('AOS_RELEASE_MANIFEST_READY',{
    version:release.schema,commit:release.commit??'local-unverified'
  })
}
