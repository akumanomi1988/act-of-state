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
import { loadReceipt } from './load-metrics.mjs'

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

// AOS-048: real distinct JWT observes the SAME versioned persuasion model
// that supplies official district forecasts and archived daily opinion.
const partyMoneyBefore=await rpc(players[9],'get_party_finances',{p_match_id:match.id})
pass(partyMoneyBefore.financeModel==='equal-public-weekly-v1' &&
  partyMoneyBefore.earnedCredits>=12 && partyMoneyBefore.spentCredits===0 &&
  partyMoneyBefore.availableCredits===partyMoneyBefore.earnedCredits,
  'Authenticated party financing did not start with equal public credits')
const otherMoneyBefore=await rpc(players[8],'get_party_finances',{p_match_id:match.id})
pass(otherMoneyBefore.spentCredits===0 &&
  otherMoneyBefore.availableCredits===partyMoneyBefore.availableCredits,
  'Independent party did not receive equal initial financing')
const campaignBefore=await rpc(players[9],'get_campaign_state',{p_match_id:match.id})
pass(campaignBefore.influenceModel==='campaign-decay-v2' &&
  campaignBefore.cohorts.every(c=>c.myInfluence===0&&c.nextDecayOn===null),
  'Real Auth campaign baseline is not empty or versioned')
const targetCohort=campaignBefore.cohorts[0]?.code
pass(typeof targetCohort==='string','No authoritative population cohort')
const campaignAct=await rpc(players[9],'launch_campaign',{
  p_match_id:match.id,p_cohort:targetCohort,p_strategy:'policy_forum'
})
pass(campaignAct.model_version==='campaign-decay-v2'&&
  campaignAct.influence_delta>=1&&campaignAct.influence_delta<=5,
  'Campaign v2 did not return a server-authored act')
const partyMoneyAfter=await rpc(players[9],'get_party_finances',{p_match_id:match.id})
pass(partyMoneyAfter.spentCredits===10 &&
  partyMoneyAfter.availableCredits===partyMoneyBefore.availableCredits-10 &&
  partyMoneyAfter.recentSpending.length===1 &&
  partyMoneyAfter.recentSpending[0].campaignEventId===campaignAct.id,
  'Real authenticated campaign did not atomically pay its recorded cost')
const partyMoneyOther=await rpc(players[8],'get_party_finances',{p_match_id:match.id})
pass(partyMoneyOther.spentCredits===0 && partyMoneyOther.recentSpending.length===0,
  'Campaign credits or private receipt leaked across party identities')
const campaignAfter=await rpc(players[9],'get_campaign_state',{p_match_id:match.id})
const affected=campaignAfter.cohorts.find(c=>c.code===targetCohort)
pass(affected?.myInfluence===campaignAct.influence_after &&
  typeof affected.nextDecayOn==='string',
  'Effective score and future expiration not visible across real HTTP')
const forecast=await rpc(players[0],'get_election_state',{p_match_id:match.id})
pass(forecast.projection.modelVersion==='electoral-districts-v2' &&
  forecast.projection.parties.reduce((sum,p)=>sum+p.seats,0)===100 &&
  forecast.projection.districts.length===6,
  'Real cabinet could not read the 100-seat versioned district election')
const affectedParty=forecast.projection.parties.find(p=>p.userId===players[9].id)
pass(affectedParty?.campaignInfluenceTotal===campaignAct.influence_after,
  'National election projection discarded time-adjusted campaign influence')

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

// AOS-049: actual signed-JWT HTTP concurrency against the disposable game.
// 80 independent read RPCs across all 10 party identities after an immutable
// parliamentary vote and cabinet signature, plus 10 outsider denials.
// No mocking, production Auth traffic, fabricated time or privileged API key.
const durations=[]
let failures=0
for(let passNo=0;passNo<6;passNo++){
  const reads=await Promise.allSettled(players.map(async actor=>{
    const start=performance.now()
    const {data,error}=await actor.client.rpc('get_match_world',{p_match_id:match.id})
    durations.push(performance.now()-start)
    if(error)throw error
    if(data?.match?.id!==match.id||data.players.length!==10||
      data.events.length!==1||data.events[0]?.id!==decision.id||
      data.government.treasury_m_eur!==10600)
      throw Error('LOAD_INCONSISTENT_LEDGER')
  }))
  failures+=reads.filter(v=>v.status==='rejected').length
}
for(let passNo=0;passNo<2;passNo++){
  const reads=await Promise.allSettled(players.map(async actor=>{
    const start=performance.now()
    const {data,error}=await actor.client.rpc('get_election_state',{p_match_id:match.id})
    durations.push(performance.now()-start)
    if(error)throw error
    if(data?.projection?.modelVersion!=='electoral-districts-v2'||
      data.projection.parties.reduce((sum,p)=>sum+p.seats,0)!==100||
      data.projection.districts.length!==6)throw Error('LOAD_INCONSISTENT_ELECTION')
  }))
  failures+=reads.filter(v=>v.status==='rejected').length
}
const rejectedReads=await Promise.allSettled(Array.from({length:10},async()=>{
  const {error}=await outsider.client.rpc('get_match_world',{p_match_id:match.id})
  return !!error && /MATCH_FORBIDDEN/.test(error.message)
}))
pass(rejectedReads.every(x=>x.status==='fulfilled'&&x.value===true),
  'Concurrent foreign-JWT reads escaped match isolation')
const load=loadReceipt(durations,failures,{ceilingMs:15_000})
pass(load.reads===80 && load.withinBudget,
  'Ten-party HTTP throughput exceeded safe CI budget or ledger inconsistent: '+JSON.stringify(load))
console.log('AOS_MATCH_LOAD_PASS',JSON.stringify({
  ...load,players:10,foreignDenials:10,signatures:1,
  scope:'disposable local GoTrue/PostgREST; not hosted performance SLO'
}))

const browser=await chromium.launch({
  ...(process.env.AOS_CHROMIUM_CHANNEL==='bundled'?{}:{channel:'chrome'}),
  headless:true,args:['--no-sandbox']
})
try {
  const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8')
  for (const {index,width} of Array.from({length:10},(_,index)=>({
    index,width:index===5?390:1440
  }))) {
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
    if(index===0 || index===5) {
      await board.getByRole('button',{name:'Reformas'}).click()
      await board.getByRole('button',{name:/Pacto de pensiones y generaciones/})
        .waitFor()
      pass(await board.getByText('REFORMA FICTICIA · SOCIETY').count()>0,
        'Reform content not independently labeled as fiction')
    }
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
    const geometry=await page.evaluate(()=>({
      width:innerWidth,scroll:document.documentElement.scrollWidth
    }))
    pass(geometry.scroll<=geometry.width+2,'Browser overflow for party '+(index+1))
    const persisted=await page.evaluate(key=>{
      const record=localStorage.getItem(key)
      try { return !!JSON.parse(record??'null')?.access_token } catch { return false }
    },authStoreKey)
    pass(persisted,'Party '+(index+1)+' did not retain real signed-in session')
    if(index===0 || index===5) {
      await page.addScriptTag({content:axe})
      const errors=await page.evaluate(async()=>(await window.axe.run(document.body,{
        runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
      })).violations.filter(x=>x.impact==='critical'||x.impact==='serious').map(x=>x.id))
      pass(errors.length===0,'WCAG violation in real signed-in '+width+'px UI: '+errors)
      await page.screenshot({path:'test-results/browser/auth-real-'+width+'.png',
        fullPage:true})
    }
    pass(failures.length===0,'React browser runtime errors: '+failures.join('; '))
    await context.close()
  }
} finally { await browser.close() }

/**
 * AOS-050: genuinely authenticated TEN-PARTY parliamentary approval of the
 * second, newly authored permanent campaign, on the SAME immutable nation.
 * Existing founding historical act, training policies and real editorial
 * dossier embargo stay separate. No production users, email or privileged API.
 */
const reformId='pension-covenant'
const reformChoice='levy-pension-covenant'
const reformWorld=await rpc(players[2],'get_match_world',{p_match_id:match.id})
const newReforms=reformWorld.dossiers.filter(d=>d.release_kind==='intro' &&
  d.programme_chapter && !['founding','diplomacy'].includes(d.programme_chapter))
pass(newReforms.length===18 && new Set(newReforms.map(d=>d.id)).size===18,
  'Real Supabase catalogue is missing the 18 permanent national reforms')
pass(reformWorld.dossiers.filter(d=>d.programme_chapter==='founding').length===10 &&
  reformWorld.options.length===155,
  'The ten unchanged founding scenarios and 155 alternatives were not visible')
pass(newReforms.every(d=>d.context.startsWith('Escenario ficticio:') &&
  d.source_url===null && d.available_from===null),
  'Permanent fiction was misrepresented as sourced news')
const reformStances=await Promise.allSettled(players.map(actor=>
  rpc(actor,'record_match_stance',{p_match_id:match.id,
    p_dossier_id:reformId,p_dossier_version:1,p_option_id:reformChoice})
))
pass(reformStances.every(v=>v.status==='fulfilled'),
  'All ten real-JWT parties must be able to take a reform policy stance')
const reformBill=await rpc(host,'propose_parliament_bill',{
  p_match_id:match.id,p_dossier_id:reformId,p_dossier_version:1,
  p_option_id:reformChoice
})
pass(reformBill.status==='open','Real reform bill proposal was not permitted')
for(const actor of players.slice(0,4))
  await rpc(actor,'cast_parliament_vote',{p_bill_id:reformBill.id,p_choice:'no'})
for(const actor of players.slice(4,10))
  await rpc(actor,'cast_parliament_vote',{p_bill_id:reformBill.id,p_choice:'yes'})
const reformParliament=await rpc(players[7],'get_parliament_state',{
  p_match_id:match.id
})
pass(reformParliament.bills.find(x=>x.id===reformBill.id)?.status==='passed' &&
  reformParliament.votes.filter(v=>v.bill_id===reformBill.id).length===10,
  'Reform failed to pass an authentic ten-person binding vote')
const reformAct=await rpc(host,'submit_decision',{
  p_government_id:govId,p_dossier_id:reformId,
  p_dossier_version:1,p_option_id:reformChoice
})
pass(reformAct.state_before.treasury_m_eur===10600 &&
  reformAct.state_after.treasury_m_eur===10840 &&
  reformAct.option_title_snapshot?.length>3,
  'Versioned economic consequence of the national pension reform was not signed')
const reformRetry=await rpc(host,'submit_decision',{
  p_government_id:govId,p_dossier_id:reformId,
  p_dossier_version:1,p_option_id:reformChoice
})
pass(reformRetry.id===reformAct.id,'Reform network retry produced two signed laws')
await rejectedRpc(host,'submit_decision',{
  p_government_id:govId,p_dossier_id:reformId,
  p_dossier_version:1,p_option_id:'basic-pension-floor'
},/DOSSIER_ALREADY_DECIDED/)
const reformObserved=await rpc(players[8],'get_match_world',{p_match_id:match.id})
pass(reformObserved.events.length===2 &&
  reformObserved.events.some(event=>event.id===decision.id) &&
  reformObserved.events.some(event=>event.id===reformAct.id) &&
  reformObserved.government.treasury_m_eur===10840,
  'Independent opposition identity cannot see both persistent reforms and founding act')
await rejectedRpc(outsider,'get_match_world',{
  p_match_id:match.id
},/MATCH_FORBIDDEN/)
console.log('AOS_REFORM_PARLIAMENT_PASS',JSON.stringify({
  permanentCases:31,foundingUnchanged:10,reforms:18,alternatives:155,
  authenticPlayers:10,signedActs:2,finalTreasuryM:10840,
  preservedHistoricalAct:true,
  note:'Local GoTrue verified; no real news or human participant account'
}))

// AOS-055: a real ten-party treaty vote is mandatory before an immutable
// government signature can move all three diplomatic blocs.
const treatyId='diplomacy-europe'
const treatyOption='europe-social-treaty'
const initialDiplomacy=await rpc(players[6],'get_diplomacy_state',{
  p_government_id:govId
})
pass(initialDiplomacy.blocs.length===3 &&
 initialDiplomacy.blocs.every(b=>b.relation===50 && b.tradeIndex===100),
 'Public diplomacy must start neutral without invented historic alliances')
await rejectedRpc(outsider,'get_diplomacy_state',{
 p_government_id:govId
},/DIPLOMACY_FORBIDDEN/)
const treatyStances=await Promise.allSettled(players.map(actor=>rpc(actor,
 'record_match_stance',{p_match_id:match.id,p_dossier_id:treatyId,
 p_dossier_version:1,p_option_id:treatyOption})))
pass(treatyStances.every(x=>x.status==='fulfilled'),
 'Ten parties cannot independently debate the same diplomatic option')
const treatyBill=await rpc(host,'propose_parliament_bill',{
 p_match_id:match.id,p_dossier_id:treatyId,p_dossier_version:1,
 p_option_id:treatyOption
})
for(const actor of players.slice(0,4)) await rpc(actor,'cast_parliament_vote',{
 p_bill_id:treatyBill.id,p_choice:'no'
})
for(const actor of players.slice(4,10)) await rpc(actor,'cast_parliament_vote',{
 p_bill_id:treatyBill.id,p_choice:'yes'
})
const approvedDiplomacy=await rpc(players[3],'get_parliament_state',{
 p_match_id:match.id
})
pass(approvedDiplomacy.bills.some(x=>x.id===treatyBill.id&&x.status==='passed'),
 'European diplomatic treaty did not obtain binding ten-party mandate')
const treatyAct=await rpc(host,'submit_decision',{
 p_government_id:govId,p_dossier_id:treatyId,p_dossier_version:1,
 p_option_id:treatyOption
})
pass(treatyAct.state_before.treasury_m_eur===10840 &&
 treatyAct.state_after.treasury_m_eur===10400,
 'Treaty did not enforce the signed state-owned fiscal consequence')
const treatyRetry=await rpc(host,'submit_decision',{
 p_government_id:govId,p_dossier_id:treatyId,p_dossier_version:1,
 p_option_id:treatyOption
})
pass(treatyRetry.id===treatyAct.id,
 'Treaty retry generated a new political decision')
const signedDiplomacy=await rpc(players[7],'get_diplomacy_state',{
 p_government_id:govId
})
pass(signedDiplomacy.blocs[0].relation===64 &&
 signedDiplomacy.blocs[1].relation===47 &&
 signedDiplomacy.blocs[2].relation===52 &&
 signedDiplomacy.recentEffects.length===3 &&
 signedDiplomacy.recentEffects.every(e=>e.eventId===treatyAct.id),
 'Authenticated opposition cannot verify signed cross-bloc effects')
await rejectedRpc(players[8],'submit_decision',{
 p_government_id:govId,p_dossier_id:'diplomacy-asia',p_dossier_version:1,
 p_option_id:'asia-supply-compact'
},/GOVERNMENT_NOT_FOUND_OR_FORBIDDEN/)
console.log('AOS_DIPLOMACY_AUTH_PASS',JSON.stringify({
 blocs:3,permanentCases:31,alternatives:155,
 tenPartyMandate:true,governmentSigned:true,
 effects:3,treasuryM:10400,outsiderReadDenied:true
}))

console.log('AOS_LIVE_AUTH_PASS',JSON.stringify({
  signedUp:actors.length,distinctPlayers:10,realHttp:true,
  fixedSignedActs:3,browserContexts:10,decayV2:true,permanentCases:31,assertions,
  note:'Ten authentic HTTP/JWT browser contexts, local GoTrue; no production SMTP or real people'
}))
