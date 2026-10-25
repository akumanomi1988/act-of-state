/**
 * AOS-047 — REAL local GoTrue/PostgREST editorial release end-to-end.
 * All ten articles, sources and decisions are explicitly SYNTHETIC fixtures.
 * Never target linked/hosted Supabase, real mailboxes or production writers.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { createClient } from '@supabase/supabase-js'

const API=process.env.API_URL, ANON=process.env.ANON_KEY
if (process.env.CI !== 'true' || API !== 'http://127.0.0.1:54321' ||
    !ANON || ANON.length < 30) throw Error('LOCAL_AUTH_ENV_REQUIRED')
const id=randomBytes(6).toString('hex')
const secret=randomBytes(24).toString('base64url')+'A1!'
let assertions=0
const check=(value,description)=>{
  assert.ok(value,description);assertions++
}
const client=()=>createClient(API,ANON,{auth:{
  autoRefreshToken:false,persistSession:false,detectSessionInUrl:false
}})
async function newUser(role){
  const c=client(),email='synthetic-'+id+'-'+role+'@example.invalid'
  const {data,error}=await c.auth.signUp({email,password:secret})
  if(error)throw error
  check(data.session?.access_token && data.user?.id,
    'GoTrue must create a real disposable signed session for '+role)
  return {client:c,email,id:data.user.id}
}
async function rpc(actor,name,args){
  const {data,error}=await actor.client.rpc(name,args)
  if(error)throw Error(name+': '+error.message)
  check(data!=null,'Invalid RPC '+name)
  return data
}
async function denied(actor,name,args,pattern){
  const {error}=await actor.client.rpc(name,args)
  check(!!error&&pattern.test(error.message),name+' missing server denial: '+error?.message)
}
// The only privileged operation is LOCAL TEST BOOTSTRAP: grant one publisher
// to a newly enrolled disposable account. PostgREST never receives this key.
// Spawn argv only, never invoke a shell. Do not print passwords or JWTs.
function localBootstrapPublisher(userId){
  if(!/^[a-f0-9-]{36}$/.test(userId))throw Error('INVALID_LOCAL_TEST_ID')
  const r=spawnSync('psql',['-X','-v','ON_ERROR_STOP=1','-h','127.0.0.1',
    '-p','54322','-U','postgres','-d','postgres','-c',
    'insert into public.editorial_members(user_id,role) values (\''+
      userId+'\',\'publisher\')'],{
      encoding:'utf8',env:{...process.env,PGPASSWORD:'postgres'},timeout:10_000
    })
  if(r.status!==0)throw Error('LOCAL_PSQL_EDITORIAL_BOOTSTRAP_FAILED: '+(r.error?.message??'status '+r.status))
}
function nextMondayUtc(){
  const date=new Date()
  const currentIsoDay=date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate()+(8-currentIsoDay))
  return date.toISOString().slice(0,10)
}
const publisher=await newUser('publisher')
const editor=await newUser('editor')
const outsider=await newUser('outsider')
localBootstrapPublisher(publisher.id)
const staff=await rpc(publisher,'manage_editorial_member',{
  p_email:editor.email,p_role:'editor'
})
check(staff.user_id===editor.id&&staff.role==='editor','Editor was not granted via publisher-approved RPC')
await denied(outsider,'manage_editorial_member',{
  p_email:editor.email,p_role:'publisher'
},/EDITORIAL_STAFF_FORBIDDEN/)
const week=nextMondayUtc()
const dossier=slot=>({
  id:'weekly-'+week+'-'+String(slot).padStart(2,'0'),
  title:'Fictional parliament newsroom scenario '+slot,
  context:'SYNTHETIC INTEGRATION TEST ONLY. There is no actual news event, real-world editorial claim, verifiable reporting or certified policy forecast for this dossier.',
  category:['Instituciones','Economía','Sanidad','Educación','Infraestructuras',
    'Empleo','Tecnología','Agricultura','Medio ambiente','Relaciones exteriores'][slot-1],
  source_url:'https://example.invalid/aos-ci-only-'+id+'/'+slot,
  source_title:'Synthetic fixture source '+slot+' — not real journalism',
  source_published_at:new Date(Date.now()-86_400_000).toISOString(),
  options:[
    {id:'act',title:'Authorize measure',description:'Illustrative intervention in a synthetic test.',
      treasury_delta_m_eur:-60,policy_target:25,response_intensity:20,trust_base_delta:1},
    {id:'hold',title:'Preserve reserves',description:'Synthetic budget preserving alternative.',
      treasury_delta_m_eur:0,policy_target:75,response_intensity:10,trust_base_delta:-1}
  ]
})
const draft=Array.from({length:10},(_,i)=>dossier(i+1))
await denied(outsider,'save_editorial_week',{
  p_week_start:week,p_expected_revision:0,p_draft:draft
},/EDITORIAL_FORBIDDEN/)
const saved=await rpc(editor,'save_editorial_week',{
  p_week_start:week,p_expected_revision:0,p_draft:draft
})
check(saved.status==='draft' && saved.revision===1 &&
  saved.draft.length===10,'Editor failed to save the complete ten-case draft')
await denied(editor,'publish_editorial_week',{
  p_week_start:week,p_expected_revision:1
},/EDITORIAL_PUBLISH_FORBIDDEN/)
await denied(publisher,'publish_editorial_week',{
  p_week_start:week,p_expected_revision:1
},/EDITORIAL_REQUIRES_TEN_REVIEWS/)
for(const item of draft.slice(0,9)){
  const r=await rpc(publisher,'review_editorial_slot',{
    p_week_start:week,p_expected_revision:1,p_dossier_id:item.id,p_approved:true
  })
  check(r.approved && r.dossier_id===item.id,'Editorial review was not confirmed')
}
await denied(publisher,'publish_editorial_week',{
  p_week_start:week,p_expected_revision:1
},/EDITORIAL_REQUIRES_TEN_REVIEWS/)
const tenth=await rpc(publisher,'review_editorial_slot',{
  p_week_start:week,p_expected_revision:1,p_dossier_id:draft[9].id,p_approved:true
})
check(tenth.approved,'Tenth slot was not reviewed')
const beforeSave=await rpc(publisher,'get_editorial_review_state',{p_week_start:week})
check(beforeSave.length===10,'Ten reviews were not persisted')
const changed=await rpc(editor,'save_editorial_week',{
  p_week_start:week,p_expected_revision:1,
  p_draft:draft.map((d,i)=>i===0?{...d,context:d.context+' Revised to invalidate signatures.'}:d)
})
check(changed.revision===2,'Revision did not change after editor updated reviewed copy')
const afterSave=await rpc(publisher,'get_editorial_review_state',{p_week_start:week})
check(afterSave.length===0,'Stale ten attestations were not invalidated')
await denied(publisher,'publish_editorial_week',{
  p_week_start:week,p_expected_revision:2
},/EDITORIAL_REQUIRES_TEN_REVIEWS/)
for(const item of draft){
  await rpc(publisher,'review_editorial_slot',{
    p_week_start:week,p_expected_revision:2,p_dossier_id:item.id,p_approved:true
  })
}
const final=await rpc(publisher,'publish_editorial_week',{
  p_week_start:week,p_expected_revision:2
})
check(final.status==='published'&&final.revision===3,'Publisher approval not persisted')
const retry=await rpc(publisher,'publish_editorial_week',{
  p_week_start:week,p_expected_revision:2
})
check(retry.published_at===final.published_at&&retry.revision===3,
  'Retry changed immutable official release')
await denied(editor,'save_editorial_week',{
  p_week_start:week,p_expected_revision:3,p_draft:draft
},/EDITORIAL_ALREADY_PUBLISHED/)
const {data:publishedRows,error:readError}=await publisher.client.from('editorial_weeks')
  .select('status,revision,draft').eq('week_start',week).single()
if(readError)throw readError
check(publishedRows.status==='published'&&publishedRows.draft.length===10,
  'Published editorial snapshot is not recoverable')
const {data:outsiderWeeks,error:outsiderError}=await outsider.client
  .from('editorial_weeks').select('week_start').eq('week_start',week)
check(!!outsiderError||!outsiderWeeks?.length,
  'Unprivileged user can access unpublished/private editorial store')
// Server must not deliver next week's approved news before Monday UTC.
const gov=await rpc(outsider,'start_government')
const world=await rpc(outsider,'get_government_world',{p_government_id:gov.id})
check(world.dossiers.every(d=>d.available_from!==week),
  'Next-week embargo leaked to an authenticated player')
// Direct unprivileged selection of weekly dossiers is forbidden, even after approval.
const {data:catalog,error:catalogError}=await outsider.client.from('dossiers')
  .select('id').like('id','weekly-'+week+'-%')
check(!!catalogError || !catalog?.length,'Direct catalog grant exposes unpublished editorial content')
console.log('AOS_EDITORIAL_WEEK_PASS',JSON.stringify({
  syntheticNews:10,signedReviews:10,distinctSources:10,
  revisions:[1,2,3],futureEmbargo:true,immutablePublication:true,
  unauthorizedActorBlocked:true,realGoTruePostgrest:true,assertions,
  note:'Only example.invalid fixture citations; no real editorial news approved.'
}))
