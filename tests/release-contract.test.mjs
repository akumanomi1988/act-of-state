import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  RELEASE_SCHEMA,REQUIRED_ROUTES,createReleaseContract,
  validateReleaseContract,emitReleaseContract,MIGRATION
} from '../scripts/release-contract.mjs'

test('identifies the exact immutable reviewed Git SHA with no secrets',()=>{
  const sha='AbCd1234'.repeat(5)
  const manifest=createReleaseContract({
    VERCEL_GIT_COMMIT_SHA:sha,
    VITE_SUPABASE_PUBLISHABLE_KEY:'sensitive_fake_value_do_not_export',
    VERCEL_TOKEN:'secret'
  },new Date('2026-10-25T19:55:00.000Z'))
  assert.equal(manifest.commit,sha.toLowerCase())
  assert.equal(manifest.schema,RELEASE_SCHEMA)
  assert.equal(manifest.builtAt,'2026-10-25T19:55:00.000Z')
  assert.deepEqual(manifest.routes,REQUIRED_ROUTES)
  assert.ok(!JSON.stringify(manifest).includes('secret'))
  assert.ok(!JSON.stringify(manifest).includes('sensitive_fake'))
  assert.doesNotThrow(()=>validateReleaseContract(manifest))
})

test('does not invent an immutable commit in local or incomplete builds',()=>{
  assert.equal(createReleaseContract({}).commit,null)
  assert.equal(createReleaseContract({VERCEL_GIT_COMMIT_SHA:'short'}).commit,null)
})

test('rejects incompatible models, incomplete routes, and malformed identity',()=>{
  const manifest=createReleaseContract({GITHUB_SHA:'a'.repeat(40)})
  for(const bad of [
    {...manifest,schema:2},{...manifest,product:'anvil'},
    {...manifest,commit:'unknown'},
    {...manifest,routes:['/']},
    {...manifest,models:{...manifest.models,elections:'electoral-districts-v1'}},
    {...manifest,models:{...manifest.models,campaigns:'fake'}},
    {...manifest,builtAt:'not-a-date'},
    null,[],{}
  ])assert.throws(()=>validateReleaseContract(bad),/AOS_RELEASE_CONTRACT_INVALID/)
})

test('emits an inspectable static artifact only after matching reviewed migrations',()=>{
  const root=mkdtempSync(join(tmpdir(),'aos-release-test-'))
  try {
    mkdirSync(join(root,'supabase','migrations'),{recursive:true})
    writeFileSync(join(root,'supabase','migrations',MIGRATION),
      "select 'electoral-districts-v2','campaign-decay-v2';")
    const result=emitReleaseContract(root,{GITHUB_SHA:'f'.repeat(40)})
    const saved=JSON.parse(readFileSync(result.output,'utf8'))
    assert.equal(saved.commit,'f'.repeat(40))
    assert.equal(saved.models.elections,'electoral-districts-v2')
    assert.equal(saved.models.campaigns,'campaign-decay-v2')
    assert.throws(()=>emitReleaseContract(root,{VERCEL:'1'}),
      /VERCEL_RELEASE_MISSING_COMMIT/)
    writeFileSync(join(root,'supabase','migrations',MIGRATION),'select 1;')
    assert.throws(()=>emitReleaseContract(root,{}),/DATABASE_RELEASE_MODEL_MISMATCH/)
  }finally{rmSync(root,{recursive:true,force:true})}
})
