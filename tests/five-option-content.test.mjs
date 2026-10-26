import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const migration = readFileSync(new URL('../supabase/migrations/20261026150257_five_option_campaign.sql',import.meta.url),'utf8')
const rows = [...migration.matchAll(/\('([^']+)',1,'([^']+)','([^']+)','([^']+)',(-?\d+),(\d+),(\d+),(-?\d+)\)/g)].map(x=>({
  dossier:x[1],id:x[2],title:x[3],description:x[4],
  delta:Number(x[5]),target:Number(x[6]),intensity:Number(x[7]),trust:Number(x[8])
}))
test('two genuinely authored additional routes exist per all 28 permanent dossiers',()=>{
  assert.equal(rows.length,56)
  const ids=new Set(rows.map(x=>x.dossier))
  assert.equal(ids.size,28)
  for(const id of ids){
    const own=rows.filter(x=>x.dossier===id)
    assert.equal(own.length,2,id)
    assert.equal(new Set(own.map(x=>x.id)).size,2,id)
    assert.equal(new Set(own.map(x=>x.target)).size,2,id)
    assert(own.every(x=>x.title.length>=10&&x.description.length>=75),id)
    assert(own.every(x=>x.delta>=-1500&&x.delta<=1500),id)
    assert(own.every(x=>x.intensity>=0&&x.intensity<=100),id)
    assert(own.every(x=>x.trust>=-20&&x.trust<=20),id)
    assert(own.some(x=>x.delta<0)||own.some(x=>x.delta>0),id)
  }
})
test('editorial publication maintains ten-review server gate and accepts fifth choice',()=>{
  assert(migration.includes('create or replace function public.publish_editorial_week('))
  assert(migration.includes('not between 2 and 5'))
  assert(migration.includes("raise exception 'EDITORIAL_REQUIRES_TEN_REVIEWS'"))
  assert(migration.includes("raise exception 'EDITORIAL_PUBLISH_FORBIDDEN'"))
  assert(migration.includes("raise exception 'EDITORIAL_INVALID_SOURCE_DATE'"))
  assert(migration.includes('perform public.approve_weekly_release(p_week_start)'))
  assert(!migration.includes('not between 2 and 4'))
})

