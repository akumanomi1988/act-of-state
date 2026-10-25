/**
 * AOS-045 — authentic GoTrue + PostgREST + Chromium acceptance, NEVER mocks.
 * Designed exclusively for a disposable local Supabase CLI stack.
 * Never run against hosted projects or with privileged service-role keys.
 * Password signups are LOCAL autoconfirmed; SMTP deliverability is NOT tested.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const API = process.env.API_URL
const ANON = process.env.ANON_KEY
const APP = process.env.AOS_BROWSER_BASE_URL ?? 'http://127.0.0.1:4173'
if (!API || !ANON) throw new Error('LOCAL_SUPABASE_ENV_MISSING')
const url = new URL(API)
if (!['127.0.0.1','localhost'].includes(url.hostname) ||
    url.port !== '54321' || url.protocol !== 'http:') {
  throw new Error('REFUSING_NONLOCAL_SUPABASE_TARGET')
}
if (process.env.CI !== 'true') throw new Error('CI_ONLY_ACCEPTANCE_TEST')
const authStoreKey = 'sb-' + url.hostname.split('.')[0] + '-auth-token'
const runId = randomBytes(6).toString('hex')
const password = randomBytes(28).toString('base64url') + 'A1!'
const partyCount = 10
let assertions = 0

function pass(value, message) {
  assert.ok(value, message)
  assertions++
}
function client() {
  return createClient(API, ANON, {
    auth: { autoRefreshToken:false, persistSession:false, detectSessionInUrl:false }
  })
}
async function rpc(actor, name, args = undefined) {
  const { data,error } = await actor.client.rpc(name,args)
  if (error) throw new Error(name+': '+error.code+' '+error.message)
  pass(data != null, name+' has no response')
  return data
}
async function rejectedRpc(actor,name,args,codePattern) {
  const { data,error } = await actor.client.rpc(name,args)
  pass(!!error && codePattern.test(error.message),
    'Expected '+name+' rejection, received '+(error?.message ?? JSON.stringify(data)))
}
async function makeActor(n) {
  const instance = client()
  const email = 'ci-'+runId+'-party-'+n+'@example.invalid'
  const { data,error } = await instance.auth.signUp({ email,password })
  if (error) throw new Error('Local signup '+n+': '+error.message)
  pass(!!data.user && !!data.session?.access_token,
    'Local GoTrue did not create a confirmed real user session')
  const { data:verified,error:verifyError } = await instance.auth.getUser()
  if (verifyError) throw new Error('GoTrue JWT rejected: '+verifyError.message)
  pass(verified.user?.id === data.user.id,'Auth session does not match enrolled user')
  return { email, id:data.user.id, client:instance, session:data.session }
}

mkdirSync('test-results/browser',{recursive:true})
const actors=[]
for (let n=1;n<=partyCount+1;n++) {
  // Stagger registration to avoid local GoTrue per-IP limits on hosted CI.
  actors.push(await makeActor(n))
}
const [host,...allOthers] = actors
const players=actors.slice(0,partyCount)
const outsider=actors[partyCount]

const match=await rpc(host,'create_match',{
  p_title:'AOS-045 Live HTTP Assembly',
  p_party_name:'Governing Party'
})
pass(typeof match.id === 'string','No real match created')
const hostSnapshot=await rpc(host,'get_match_world',{p_match_id:match.id})
const invite=hostSnapshot.match.invite_code
const govId=hostSnapshot.government.id
pass(hostSnapshot.players.length===1 && /^[0-9a-f]{32}$/.test(invite),
  'Local Supabase did not create protected host seat and invite')

const joins=await Promise.allSettled(allOthers.slice(0,9).map((actor,index)=>
  rpc(actor,'join_match',{
    p_invite_code:invite,p_party_name:'Opposition Party '+(index+2)
  })
))
pass(joins.every(result=>result.status==='fulfilled'),
  'All nine distinct real-JWT joins must be committed through PostgREST')
const world=await rpc(host,'get_match_world',{p_match_id:match.id})
pass(world.players.length===10,'Expected ten persistent live HTTP seats')
pass(new Set(world.players.map(p=>p.user_id)).size===10 &&
     new Set(world.players.map(p=>p.seat_no)).size===10,'Duplicate seat/identity')
await rejectedRpc(outsider,'join_match',{
  p_invite_code:invite,p_party_name:'Unauthorized Eleventh Party'
},/MATCH_FULL/)
await rejectedRpc(outsider,'get_match_world',{p_match_id:match.id},/MATCH_FORBIDDEN/)
await rejectedRpc(players[1],'start_match',{p_match_id:match.id},/MATCH_FORBIDDEN/)

const start=await rpc(host,'start_match',{p_match_id:match.id})
pass(start.status==='active','Host failed to start real match')
const restart=await rpc(host,'start_match',{p_match_id:match.id})
pass(restart.started_at===start.started_at,'Starting again changed persisted timestamp')

const dossierId='energy-resilience'
const optionId='household-support'
const votes=await Promise.allSettled(players.map(actor=>
  rpc(actor,'record_match_stance',{
    p_match_id:match.id,p_dossier_id:dossierId,
    p_dossier_version:1,p_option_id:optionId
  })
))
pass(votes.every(v=>v.status==='fulfilled'),'Ten HTTP player stances failed')
const afterStances=await rpc(players[6],'get_match_world',{p_match_id:match.id})
pass(afterStances.stances.length===10,'Independent player cannot see ten recorded stances')
await rejectedRpc(players[1],'submit_decision',{
  p_government_id:govId,p_dossier_id:dossierId,
  p_dossier_version:1,p_option_id:optionId
},/GOVERNMENT_NOT_FOUND_OR_FORBIDDEN|MATCH_FORBIDDEN|insufficient privilege/i)
const bill=await rpc(host,'propose_parliament_bill',{
  p_match_id:match.id,p_dossier_id:dossierId,p_dossier_version:1,
  p_option_id:optionId
})
pass(bill.status==='open','Proposed real bill not open')
// Avoid early majority auto-closure: four negative ballots before six yes.
for (const actor of players.slice(0,4)) {
  await rpc(actor,'cast_parliament_vote',{p_bill_id:bill.id,p_choice:'no'})
}
for (const actor of players.slice(4,10)) {
  await rpc(actor,'cast_parliament_vote',{p_bill_id:bill.id,p_choice:'yes'})
}
const parliament=await rpc(players[3],'get_parliament_state',{p_match_id:match.id})
const enacted=parliament.bills.find(candidate=>candidate.id===bill.id)
pass(enacted?.status==='passed','Ten-party binding parliament vote did not pass')
pass(parliament.votes.filter(v=>v.bill_id===bill.id).length===10,
  'Parliament lost a party ballot')
const decision=await rpc(host,'submit_decision',{
  p_government_id:govId,p_dossier_id:dossierId,p_dossier_version:1,p_option_id:optionId
})
pass(decision.state_after.treasury_m_eur===10600,
  'Real authoritative outcome was not the expected signed effect')
const duplicate=await rpc(host,'submit_decision',{
  p_government_id:govId,p_dossier_id:dossierId,p_dossier_version:1,p_option_id:optionId
})
pass(duplicate.id===decision.id,'Safe exact retry created duplicate national decision')
await rejectedRpc(host,'submit_decision',{
  p_government_id:govId,p_dossier_id:dossierId,p_dossier_version:1,
  p_option_id:'industry-investment'
},/DOSSIER_ALREADY_DECIDED/)
const verifiedWorld=await rpc(players[9],'get_match_world',{p_match_id:match.id})
pass(verifiedWorld.events.length===1 && verifiedWorld.events[0].id===decision.id &&
  verifiedWorld.government.treasury_m_eur===10600,
  'Independent account did not observe the signed national event')
const { data:alienWorld,error:alienWorldError } =
  await outsider.client.rpc('get_government_world',{p_government_id:govId})
pass(alienWorld == null || !!alienWorldError,
  'Cross-owner snapshot must be NULL or return an authorization error')
pass((await rpc(outsider,'list_my_matches')).length===0,
  'Outsider discovered a private game')

const browser=await chromium.launch({
  ...(process.env.AOS_CHROMIUM_CHANNEL==='bundled'?{}:{channel:'chrome'}),
  headless:true,args:['--no-sandbox']
})
try {
  const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8')
  for (const {index,width} of [{index:0,width:1440},{index:5,width:390}]) {
    const actor=players[index]
    const context=await browser.newContext({viewport:{width,height:900}})
    await context.addInitScript(({key,session})=>{
      localStorage.setItem(key,JSON.stringify(session))
    },{key:authStoreKey,session:actor.session})
    const page=await context.newPage()
    const failures=[]
    page.on('pageerror',error=>failures.push(error.message))
    await page.goto(APP+'/multiplayer',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'AOS-045 Live HTTP Assembly'}).waitFor({timeout:15000})
    const board=page.getByRole('region',{name:'Centro de decisiones de la asamblea'})
    await board.getByRole('heading',{name:'Consejo político'}).waitFor()
    await page.getByText('10 / 10').first().waitFor()
    await board.getByRole('button',{name:'Decisiones firmadas'}).click()
    await board.getByRole('button',{name:/Plan de resiliencia energética/}).waitFor()
    if(index===0){
      await board.getByText('Gobierno ejecutivo').waitFor()
      await page.getByText('COMPETENCIA DEL GOBIERNO').waitFor()
    }else{
      await board.getByText('Partido de oposición').waitFor()
      pass(await page.getByText('COMPETENCIA DEL GOBIERNO').count()===0,
        'Opposition gained cabinet controls')
    }
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'AOS-045 Live HTTP Assembly'}).waitFor()
    await page.addScriptTag({content:axe})
    const geometry=await page.evaluate(()=>({
      width:innerWidth,scroll:document.documentElement.scrollWidth
    }))
    pass(geometry.scroll<=geometry.width+2,'Browser overflow on '+width+'px')
    const errors=await page.evaluate(async()=>(await window.axe.run(document.body,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
    })).violations.filter(x=>x.impact==='critical'||x.impact==='serious').map(x=>x.id))
    pass(errors.length===0,'WCAG violation in real signed-in '+width+'px UI: '+errors)
    pass(failures.length===0,'React browser runtime errors: '+failures.join('; '))
    await page.screenshot({path:'test-results/browser/auth-real-'+width+'.png',
      fullPage:true})
    await context.close()
  }
} finally { await browser.close() }
console.log('AOS_LIVE_AUTH_PASS',JSON.stringify({
  signedUp:actors.length,distinctPlayers:10,realHttp:true,
  fixedSignedActs:1,browserContexts:2,assertions,
  note:'Disposable GoTrue/PostgREST; no real SMTP or real-world editorial review'
}))
