import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
import {join,dirname} from 'node:path'

const root=join(dirname(fileURLToPath(import.meta.url)),'..')
const migration=readFileSync(join(root,'supabase','migrations',
  '20261025215000_aos_050_national_reform_programme.sql'),'utf8')
const dossiersPart=migration.slice(
  migration.indexOf('insert into public.dossiers('),
  migration.indexOf('insert into public.dossier_options(')
)
const optionsPart=migration.slice(
  migration.indexOf('insert into public.dossier_options(')
)

const dossiers=[...dossiersPart.matchAll(
  /\('([^']+)',1,'([^']+)','(Escenario ficticio:[^']+)','([^']+)','intro','([^']+)',(\d+)\)/g
)].map(row=>({id:row[1],title:row[2],context:row[3],category:row[4],
  chapter:row[5],order:Number(row[6])}))
const options=[...optionsPart.matchAll(
  /\('([^']+)',1,'([^']+)','([^']+)','([^']+)',(-?\d+),(\d+),(\d+),(-?\d+)\)/g
)].map(row=>({case:row[1],id:row[2],title:row[3],description:row[4],
  cost:Number(row[5]),target:Number(row[6]),intensity:Number(row[7]),
  trust:Number(row[8])}))

test('four authored permanent reform chapters have complete unique fictional coverage',()=>{
  assert.equal(dossiers.length,18)
  assert.equal(options.length,54)
  assert.equal(new Set(dossiers.map(d=>d.id)).size,18)
  for(const [chapter,expected] of Object.entries({
    society:5,economy:5,institutions:4,resilience:4
  })){
    const rows=dossiers.filter(d=>d.chapter===chapter)
    assert.equal(rows.length,expected,chapter)
    assert.deepEqual(rows.map(d=>d.order),
      Array.from({length:expected},(_,i)=>i+1),chapter+' ordering')
  }
  for(const dossier of dossiers){
    assert.ok(dossier.context.length>=130,dossier.id+' has an underwritten context')
    assert.ok(dossier.title.length>=12,dossier.id+' has a placeholder title')
    assert.equal(dossier.context.startsWith('Escenario ficticio:'),true)
  }
  assert.equal(migration.includes("programme_chapter='founding'"),true)
  assert.equal(migration.includes("release_kind <> 'weekly' or programme_chapter is null"),true)
})

test('all 54 policy outcomes have actual choices, real trade-offs and bounded effects',()=>{
  for(const dossier of dossiers){
    const rows=options.filter(o=>o.case===dossier.id)
    assert.equal(rows.length,3,dossier.id+' alternatives')
    assert.equal(new Set(rows.map(o=>o.id)).size,3,dossier.id+' unique option IDs')
    assert.deepEqual(rows.map(o=>o.target),[25,75,50],dossier.id+' cohorts')
    assert.ok(rows.some(o=>o.cost>0)&&rows.some(o=>o.cost<0),
      dossier.id+' has no real fiscal tradeoff')
    for(const option of rows){
      assert.ok(option.description.length>=45,option.id+' lacks choice context')
      assert.ok(option.intensity>=0&&option.intensity<=100,'Response bounds')
      assert.ok(option.trust>=-20&&option.trust<=20,'Trust bounds')
      assert.ok(option.cost>=-1500&&option.cost<=1500,'Plausible budget bounds')
    }
  }
  assert.ok(!migration.includes('current_news'),'fiction must not claim news')
})
