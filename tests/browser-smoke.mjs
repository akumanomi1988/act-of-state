// ACT OF STATE browser verification: real Chromium + isolated mocked Supabase HTTP.
// This is NOT a substitute for an actual SMTP-backed login or live multi-account playtest.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.AOS_BROWSER_BASE_URL ?? 'http://127.0.0.1:4173'
const API = 'https://aos-browser-tests.supabase.co'
const OUT = 'test-results/browser'
mkdirSync(OUT,{recursive:true})
const ua = '70000000-0000-4000-8000-000000000001'
const govId = '90000000-0000-4000-8000-000000000009'
const now = Date.now()
const fakeToken = [
  Buffer.from(JSON.stringify({alg:'HS256',typ:'JWT'})).toString('base64url'),
  Buffer.from(JSON.stringify({iss:API+'/auth/v1',sub:ua,role:'authenticated',
    aud:'authenticated',exp:Math.floor(now/1000)+7200,
    iat:Math.floor(now/1000)})).toString('base64url'),
  'fake-signature-for-intercepted-browser-tests-only'
].join('.')

function createServerState(userId=ua,governmentId=govId) {
  const user = {
    id:userId,aud:'authenticated',role:'authenticated',
    email:'synthetic-browser@example.invalid',
    app_metadata:{provider:'email',providers:['email']},user_metadata:{},
    created_at:'2026-10-23T00:00:00Z',
    confirmed_at:'2026-10-23T00:00:00Z'
  }
  const government = {
    id:governmentId,owner_id:userId,country_name:'República de Arcadia',
    treasury_m_eur:12000,approval:50,trust:50,debt_m_eur:0,gdp_index:100,
    unemployment_bp:700,inflation_bp:250,
    created_at:'2026-10-23T00:00:00Z',updated_at:'2026-10-23T00:00:00Z'
  }
  const dossier = {
    id:'energy-resilience',version:1,title:'Plan de resiliencia energética',
    context:'Expediente inicial sintético para la comprobación del navegador.',
    category:'Economía',release_kind:'intro',available_from:null,available_until:null
  }
  const option = {
    dossier_id:dossier.id,dossier_version:1,id:'household-support',
    title:'Proteger a los hogares',description:'Ayudas focalizadas.',
    treasury_delta_m_eur:-1400,policy_target:25,response_intensity:35,
    trust_base_delta:2
  }
  const state = {
    user,government,dossier,option,
    events:[],otpCount:0,
    policy:{
      government_id:governmentId,health:35,education:25,infrastructure:25,
      security:15,tax_rate:25,revised_this_week:false,
      revision_week:'2026-10-19',updated_at:'2026-10-23T00:00:00Z'
    },
    get fiscal() {
      return {
        governmentId,serverDay:'2026-10-23',currentWeek:'2026-10-19',
        canEdit:true,canRevise:!this.policy.revised_this_week,
        policy:this.policy,projectedRevenueM:this.policy.tax_rate*95,
        projectedSpendingM:this.policy.health*24+this.policy.education*20+
          this.policy.infrastructure*30+this.policy.security*22,
        indicators:{
          treasuryM:this.government.treasury_m_eur,debtM:this.government.debt_m_eur,
          gdpIndex:100,unemploymentBp:700,inflationBp:250,
          approval:this.government.approval,trust:this.government.trust
        },
        history:[]
      }
    },
    get world() {
      return {
        government:this.government,gameDay:'2026-10-23',
        calendar:{weekStart:'2026-10-19',friday:'2026-10-23',dayOfWeek:5,
          fridayReached:true,weeklyTotal:0,weeklyResolved:0,weeklyTreasuryDeltaM:0},
        dossiers:[this.dossier],options:[this.option],
        cohorts:[{
          id:'a',government_id:governmentId,code:'households',
          label:'Hogares y trabajadores',population_weight:65,
          ideal_policy:25,support:50,trust:50
        },{
          id:'b',government_id:governmentId,code:'industry',
          label:'Industria y empresas',population_weight:35,
          ideal_policy:75,support:50,trust:50
        }],events:this.events
      }
    }
  }
  return state
}

async function routeApi(page,state,{emailLimit=false}={}) {
  await page.route(API+'/**', async route => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    const json = body => route.fulfill({
      status:200,contentType:'application/json',
      headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},
      body:JSON.stringify(body)
    })
    if(request.method()==='OPTIONS')
      return route.fulfill({status:204,headers:{
        'access-control-allow-origin':'*','access-control-allow-methods':'GET,POST,OPTIONS',
        'access-control-allow-headers':'*'}})
    if (path==='/auth/v1/user') return json(state.user)
    if (path==='/auth/v1/logout')
      return route.fulfill({status:204,headers:{'access-control-allow-origin':'*'}})
    if (path==='/auth/v1/otp') {
      state.otpCount++
      state.lastOtp = {url:request.url(),body:request.postData()??''}
      if(emailLimit) return route.fulfill({
        status:429,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({message:'email rate limit exceeded',
          code:'over_email_send_rate_limit'})
      })
      return json({})
    }
    if (path==='/rest/v1/rpc/start_government') return json(state.government)
    if (path==='/rest/v1/rpc/get_government_world') return json(state.world)
    if (path==='/rest/v1/rpc/submit_decision') {
      const before={
        treasury_m_eur:state.government.treasury_m_eur,
        approval:state.government.approval,trust:state.government.trust
      }
      if(!state.events.length) {
        state.government={...state.government,
          treasury_m_eur:before.treasury_m_eur-1400,approval:62,trust:58}
        state.events.push({
          id:'a0000000-0000-4000-8000-000000000001',
          government_id:state.government.id,dossier_id:state.dossier.id,
          dossier_version:1,option_id:state.option.id,
          decided_on:'2026-10-23',created_at:'2026-10-23T12:00:00Z',
          dossier_title_snapshot:state.dossier.title,
          option_title_snapshot:state.option.title,
          engine_version:'weighted-cohorts-v1',
          parameters_snapshot:{treasury_delta_m_eur:-1400,policy_target:25,
            response_intensity:35,trust_base_delta:2},
          state_before:before,
          state_after:{treasury_m_eur:state.government.treasury_m_eur,
            approval:62,trust:58},
          cohort_effects:[]
        })
      }
      return json(state.events[0])
    }
    if (path==='/rest/v1/rpc/get_fiscal_state') return json(state.fiscal)
    if (path==='/rest/v1/rpc/set_fiscal_policy') {
      const post=request.postDataJSON()
      state.policy={...state.policy,
        health:post.p_health,education:post.p_education,
        infrastructure:post.p_infrastructure,security:post.p_security,
        tax_rate:post.p_tax_rate,revised_this_week:true
      }
      return json(state.policy)
    }
    if (path==='/rest/v1/rpc/list_my_matches') return json([])
    if (path.startsWith('/rest/v1/'))
      return route.fulfill({status:404,contentType:'application/json',
        headers:{'access-control-allow-origin':'*'},
        body:JSON.stringify({message:'No mock configured for '+path})})
    return route.abort()
  })
}
async function injectUser(page,state) {
  await page.addInitScript(({key,session})=>{
    window.localStorage.setItem(key,JSON.stringify(session))
  },{
    key:'sb-aos-browser-tests-auth-token',
    session:{
      access_token:fakeToken,token_type:'bearer',refresh_token:'synthetic-browser-refresh',
      expires_in:7200,expires_at:Math.floor(now/1000)+7200,user:state.user
    }
  })
}
function reportFailures(failures) {
  return failures.map(f=>({
    id:f.id,impact:f.impact,
    nodes:f.nodes.slice(0,2).map(n=>n.target)
  }))
}
async function checkA11y(page, label) {
  const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8')
  await page.addScriptTag({content:axe})
  const violations=await page.evaluate(async()=> {
    const report=await window.axe.run(document.body,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
    })
    return report.violations
  })
  const serious=violations.filter(v=>v.impact==='critical'||v.impact==='serious')
  assert.equal(serious.length,0,
    label+': serious accessibility failures '+JSON.stringify(reportFailures(serious)))
}
async function checkMobileOverflow(page,label) {
  const geometry=await page.evaluate(()=>({
    width:window.innerWidth,documentWidth:document.documentElement.scrollWidth
  }))
  assert.ok(geometry.documentWidth<=geometry.width+2,
    label+' has horizontal overflow: '+JSON.stringify(geometry))
}
let browser
const passed=[]
const failed=[]
async function run(name,fn) {
  try {
    await fn()
    passed.push(name)
    console.log('PASS '+name)
  } catch (error) {
    failed.push(name)
    console.error('FAIL '+name,error)
  }
}
try {
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']})

  await run('Anonymous login, redirect origin and responsive root',async()=>{
    const context=await browser.newContext({viewport:{width:375,height:812}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    await page.getByLabel('Correo electrónico').fill('browser@example.invalid')
    await page.getByRole('button',{name:'Enviar enlace de acceso'}).click()
    try { await page.getByText(/se ha solicitado el enlace de acceso/i).waitFor({timeout:8000}) }
    catch (err) {
      console.error('Browser OTP diagnostics:', JSON.stringify({
        count:state.otpCount,lastOtp:state.lastOtp,
        body:(await page.locator('body').innerText()).slice(0,1600)
      }))
      await page.screenshot({path:OUT+'/login-debug.png',fullPage:true})
      throw err
    }
    assert.equal(state.otpCount,1)
    assert.equal(new URL(state.lastOtp.url).searchParams.get('redirect_to'),BASE)
    await checkMobileOverflow(page,'anonymous home')
    await checkA11y(page,'anonymous home')
    await page.screenshot({path:OUT+'/login-mobile.png',fullPage:true})
    await context.close()
  })

  await run('Failed Supabase email rate limit is visible and not a success',async()=>{
    const context=await browser.newContext({viewport:{width:1440,height:900}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state,{emailLimit:true})
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    await page.getByLabel('Correo electrónico').fill('browser@example.invalid')
    await page.getByRole('button',{name:'Enviar enlace de acceso'}).click()
    await page.getByRole('alert').waitFor()
    assert.equal(await page.getByText(/se ha solicitado el enlace de acceso/i).count(),0)
    assert.equal(state.otpCount,1)
    await context.close()
  })

  await run('Authenticated national decisions survive browser reload',async()=>{
    const context=await browser.newContext({viewport:{width:1440,height:1000}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'La agenda de gobierno'}).waitFor()
    await page.getByRole('heading',{name:'Presupuesto del Estado'}).waitFor()
    await page.getByRole('radio',{name:/Proteger a los hogares/}).check()
    await page.getByRole('button',{name:'Revisar decisión'}).click()
    await page.getByRole('button',{name:'Firmar y ejecutar decisión'}).click()
    await page.getByText(/Tesorería.*10.600|10.600 M€/).first().waitFor()
    assert.equal(state.events.length,1)
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Presupuesto del Estado'}).waitFor()
    assert.equal(state.events.length,1)
    assert.equal(state.government.treasury_m_eur,10600)
    await checkMobileOverflow(page,'desktop authenticated nation')
    await checkA11y(page,'authenticated nation')
    await page.screenshot({path:OUT+'/nation-desktop.png',fullPage:true})
    await context.close()
  })

  await run('National decision analytics attributes persisted impact after reload',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    const archive=page.getByRole('region',{name:'Archivo estratégico nacional'})
    await archive.getByRole('button',{name:'Explorar impacto'}).waitFor()
    await archive.getByRole('button',{name:'Explorar impacto'}).click()
    await archive.getByRole('status').filter({hasText:'No hay decisiones firmadas'}).waitFor()
    await page.getByRole('radio',{name:/Proteger a los hogares/}).check()
    await page.getByRole('button',{name:'Revisar decisión'}).click()
    await page.getByRole('button',{name:'Firmar y ejecutar decisión'}).click()
    await archive.getByRole('button',{name:/Proteger a los hogares/}).waitFor()
    await archive.getByRole('radio',{name:'7 días'}).check()
    await archive.getByRole('heading',{name:'Plan de resiliencia energética'}).waitFor()
    await archive.getByText('-1.400 M€',{exact:true}).first().waitFor()
    assert.equal(state.events.length,1)
    await page.reload({waitUntil:'networkidle'})
    const restored=page.getByRole('region',{name:'Archivo estratégico nacional'})
    await restored.getByRole('button',{name:'Explorar impacto'}).click()
    await restored.getByRole('button',{name:/Proteger a los hogares/}).waitFor()
    await restored.getByText('-1.400 M€',{exact:true}).first().waitFor()
    assert.equal(state.events.length,1,'archive must not resubmit any decision')
    await checkMobileOverflow(page,'mobile strategic archive')
    await checkA11y(page,'mobile strategic archive')
    await page.screenshot({path:OUT+'/analytics-mobile.png',fullPage:true})
    await context.close()
  })

  await run('Budget reallocation remains server-confirmed after reload',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Presupuesto del Estado'}).waitFor()
    await page.getByLabel('Nuevo tipo fiscal').fill('27')
    await page.getByRole('button',{name:'Revisar nueva distribución'}).click()
    await page.getByRole('button',{name:'Aprobar presupuesto semanal'}).click()
    await page.getByText(/Presupuesto registrado/).waitFor()
    assert.equal(state.policy.health,40)
    assert.equal(state.policy.security,10)
    assert.equal(state.policy.tax_rate,27)
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Presupuesto del Estado'}).waitFor()
    await page.getByText('40 %',{exact:true}).waitFor()
    await checkMobileOverflow(page,'mobile authenticated nation')
    await checkA11y(page,'mobile authenticated nation')
    await page.screenshot({path:OUT+'/nation-mobile.png',fullPage:true})
    await context.close()
  })

  await run('Anonymous multiplayer route and accessibility',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await page.goto(BASE+'/multiplayer',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'El poder no se ejerce solo.'}).waitFor()
    await checkMobileOverflow(page,'anonymous multiplayer')
    await checkA11y(page,'anonymous multiplayer')
    await page.screenshot({path:OUT+'/multiplayer-mobile.png',fullPage:true})
    await context.close()
  })
  console.log('Browser scenarios passed: '+passed.length+'/5')
  if (failed.length) throw new Error('Failed scenarios: '+failed.join(', '))
} catch (error) {
  console.error('BROWSER SMOKE FAILED',error)
  process.exitCode=1
} finally {
  await browser?.close()
}
