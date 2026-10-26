import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
const s=readFileSync(new URL('../supabase/migrations/20261026165000_aos_055_diplomatic_relations.sql',import.meta.url),'utf8')
test('three geopolitically distinct dossiers with five alternatives each',()=>{
 for(const id of ['diplomacy-europe','diplomacy-asia','diplomacy-usa']){
  const options=s.slice(s.indexOf('INSERT INTO public.dossier_options('),s.indexOf('CREATE TABLE public.diplomacy_option_effects'))
  const entries=options.split('\n').filter(l=>l.startsWith("('"+id+"','1',"))
  assert.equal(entries.length,5,id)
  assert(entries.every(e=>e.length>95),id)
 }
})
test('45 region impacts snapshotted transactionally behind authenticated RPC',()=>{
 const effect=s.slice(s.indexOf('INSERT INTO public.diplomacy_option_effects('),s.indexOf('CREATE TABLE public.diplomacy_events'))
 assert.equal(effect.split('\n').filter(x=>x.startsWith("('diplomacy-")).length,45)
 assert(s.includes('AFTER INSERT ON public.decision_events'))
 assert(s.includes("DIPLOMACY_FORBIDDEN"))
 assert(s.includes("REVOKE ALL ON public.diplomacy_events FROM public,anon,authenticated"))
})
