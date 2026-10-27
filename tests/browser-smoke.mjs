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
    aud:'authenticated',exp:Math.floor(now/1000)+9000,
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
        dossiers:this.foundationalDossiers??[this.dossier],
        options:this.foundationalOptions??[this.option],
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
    if (path==='/rest/v1/rpc/get_diplomacy_state') return json({
      governmentId:state.government.id,modelVersion:'diplomacy-v1',
      blocs:[
        {id:'europe',label:'Europa',relation:50,tradeIndex:100,signedEffects:0},
        {id:'asia',label:'Asia',relation:50,tradeIndex:100,signedEffects:0},
        {id:'usa',label:'Estados Unidos',relation:50,tradeIndex:100,signedEffects:0}
      ],recentEffects:[]
    })
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
    if (path==='/rest/v1/editorial_members') return json([{role:'publisher'}])
    if (path==='/rest/v1/editorial_weeks') return json([])
    if (path==='/rest/v1/rpc/get_editorial_review_state') return json([])
    if (path==='/rest/v1/rpc/get_editorial_staff') return json([])
    if (path==='/functions/v1/news-discovery') {
      const feeds=['elpais-spain','elpais-economy','guardian-politics',
        'guardian-world','bbc-politics','bbc-business']
      const hosts=['elpais.com','elpais.com','www.theguardian.com',
        'www.theguardian.com','www.bbc.com','www.bbc.com']
      const i=feeds.indexOf(url.searchParams.get('feed'))
      if (i<0) return json({error:'INVALID_FEED'})
      return json({feed:feeds[i],fetchedAt:new Date().toISOString(),
        articles:[0,1,2].map(n=>({
          title:'Published source headline for section '+i+' story '+n,
          url:'https://'+hosts[i]+'/news/'+i+'/'+n,
          source:'Approved editorial section '+i,
          publishedAt:new Date(Date.now()-3600000).toISOString()
        }))})
    }
    if (state.weeklyMatch) {
      const mid='80000000-0000-4000-8000-000000000037'
      const player=state.syntheticRoster?.find(p=>p.user_id===state.user.id) ?? {
        match_id:mid,user_id:state.user.id,seat_no:1,
        party_name:'Gobierno compartido',manifesto_policy:50,mandate_seats:100,
        joined_at:'2026-10-12T09:00:00Z',is_ready:true
      }
      const leaderId=state.syntheticRoster?.[0]?.user_id??state.user.id
      if(path==='/rest/v1/rpc/list_my_matches') return json([{
        id:mid,title:'Prueba de legislatura',status:'active',
        host_user_id:leaderId,government_id:state.government.id,
        seat_no:player.seat_no,party_name:player.party_name,player_count:state.syntheticRoster?.length??2,
        created_at:'2026-10-12T09:00:00Z'
      }])
      if(path==='/rest/v1/rpc/get_match_world') return json({
        match:{id:mid,title:'Prueba de legislatura',status:'active',
          host_user_id:leaderId,government_id:state.government.id,
          invite_code:'abcdefabcdefabcdefabcdefabcdefab',
          created_at:'2026-10-12T09:00:00Z',started_at:'2026-10-12T10:00:00Z',
          is_public:false,readiness_required:false,max_players:10},
        me:player,gameDay:state.syntheticGameDay??'2026-10-24',players:state.syntheticRoster??[player],
        government:state.government,cohorts:state.world.cohorts,
        dossiers:state.syntheticDossiers??[],options:state.syntheticOptions??[],
        events:state.events,stances:state.syntheticStances??[]
      })
      if(path==='/rest/v1/rpc/get_parliament_state') return json(state.syntheticParliament??{
        bills:[],votes:[],serverNow:'2026-10-24T12:00:00Z'
      })
      if(path==='/rest/v1/rpc/get_governance_state') return json({
        hostUserId:leaderId,totalSeats:100,coalitionSeats:10,
        coalition:[],motions:[],votes:[],serverNow:'2026-10-24T12:00:00Z'
      })
      if(path==='/rest/v1/rpc/get_party_finances') return json({
        matchId:mid,serverDay:'2026-10-24',weekStart:'2026-10-19',
        financeModel:'equal-public-weekly-v1',active:true,
        earnedCredits:16,spentCredits:0,availableCredits:16,
        costs:{dialogue:4,field_visit:7,policy_forum:10},
        recentSpending:[]
      })
      if(path==='/rest/v1/rpc/get_campaign_state') return json({
        serverDay:'2026-10-24',weekStart:'2026-10-19',
        campaignClosesOn:'2027-01-03',available:true,usedThisWeek:false,
        influenceModel:'campaign-decay-v2',
        cohorts:[{code:'workers',label:'Trabajadores',weight:55,
          idealPolicy:45,myInfluence:7,nextDecayOn:'2026-10-31'},
          {code:'youth',label:'Jóvenes',weight:45,idealPolicy:60,
          myInfluence:0,nextDecayOn:null}],
        recentActs:[]
      })
      if(path==='/rest/v1/rpc/get_election_state'){
        const second='80000000-0000-4000-8000-000000000099'
        return json({
          projection:{modelVersion:'electoral-districts-v1',householdSampleSize:300,
            cohorts:[],
            districts:[
              ['capital','Distrito Capital',25],
              ['industrial','Corredor Industrial',20],
              ['coastal','Región Costera',18],
              ['agrarian','Llanuras Agrarias',15],
              ['highland','Territorios de Montaña',12],
              ['frontier','Frontera Interior',10]
            ].map(([code,label,seats])=>{
              const first=Math.ceil(seats*0.54)
              return {code,label,seats,households:30,residents:90,
                parties:[
                  {userId:state.user.id,partyName:'Gobierno compartido',
                    voteSharePct:54,seats:first},
                  {userId:second,partyName:'Oposición de prueba',
                    voteSharePct:46,seats:seats-first}
                ]}
            }),
            parties:[
              {userId:state.user.id,seatNo:1,partyName:'Gobierno compartido',
                manifestoPolicy:50,voteSharePct:54,seats:54},
              {userId:second,seatNo:2,partyName:'Oposición de prueba',
                manifestoPolicy:25,voteSharePct:46,seats:46}
            ]},
          nextDueOn:'2027-01-10',campaignClosesOn:'2027-01-03',
          canCertify:false,serverDay:'2026-10-24',history:[]
        })
      }
      if(path==='/rest/v1/rpc/get_match_opinion_history'){
        const days=request.postDataJSON()?.p_days??30
        const second='80000000-0000-4000-8000-000000000099'
        const make=(day,vote)=>({
          day,capturedAt:day+'T00:15:00Z',modelVersion:'electoral-districts-v1',
          householdSampleSize:300,
          parties:[
            {userId:state.user.id,seatNo:1,partyName:'Gobierno compartido',
              manifestoPolicy:50,voteSharePct:vote,seats:54},
            {userId:second,seatNo:2,partyName:'Oposición de prueba',
              manifestoPolicy:25,voteSharePct:100-vote,seats:46}
          ],districts:[{code:'capital',label:'Distrito Capital',
            seats:25,households:75,residents:225,
            parties:[{userId:state.user.id,partyName:'Gobierno compartido',
              voteSharePct:vote,seats:14}]}]
        })
        return json({matchId:mid,serverDay:'2026-10-24',
          fromDay:days===7?'2026-10-18':'2026-09-25',
          days,expectedDays:days,recordedDays:2,
          polls:[make('2026-10-22',52),make('2026-10-23',54)]})
      }
      if(path==='/rest/v1/rpc/get_match_calendar') return json(state.syntheticCalendar??{
        gameDay:'2026-10-24',monday:'2026-10-19',friday:'2026-10-23',
        fridayReached:true,weeklyPublished:false,weeklyTotal:0,
        weeklyResolved:0,latestFriday:null
      })
      if(path==='/rest/v1/rpc/get_match_action_inbox') {
        const items=[
          {key:'campaign:2026-10-19',kind:'action',section:'campaign',
            title:'Planifica la actividad de campaña semanal',
            detail:'Tu partido aún no ha registrado una acción territorial esta semana.',
            dossierId:null},
          {key:'friday:2026-10-12',kind:'news',section:'history',
            title:'Acta semanal certificada',
            detail:'Cierre del 2026-10-16: 1 decisiones.',dossierId:null}
        ].map(item=>({...item,read:state.inboxRead?.has(item.key)??false}))
        return json({matchId:mid,serverDay:'2026-10-24',
          unreadCount:items.filter(i=>!i.read).length,items})
      }
      if(path==='/rest/v1/rpc/mark_match_inbox_read') {
        const body=request.postDataJSON()
        state.inboxRead ??=new Set()
        if(!['campaign:2026-10-19','friday:2026-10-12'].includes(body.p_task_key))
          return route.fulfill({status:403,contentType:'application/json',
            headers:{'access-control-allow-origin':'*'},
            body:JSON.stringify({message:'INBOX_TASK_NOT_FOUND'})})
        state.inboxRead.add(body.p_task_key)
        return json(true)
      }
      if(path==='/rest/v1/rpc/get_match_weekly_accountability')
        return json({serverDay:'2026-10-24',weeks:[
          {weekStart:'2026-10-19',friday:'2026-10-23',
            status:'awaiting-settlement',published:false,
            dossiers:[],parties:[{seatNo:1,partyName:player.party_name,
              positions:0,votes:0}],fridayAct:null,elections:[]},
          {weekStart:'2026-10-12',friday:'2026-10-16',
            status:'closed',published:true,
            dossiers:[{id:'qa-week-dossier',title:'Plan político archivado',
              category:'Economía',sourceTitle:'Fuente verificada de prueba',
              sourceUrl:'https://example.org/test-source',positions:1,
              decision:{optionId:'qa-option',decidedOn:'2026-10-14',
                treasuryDelta:-100,approval:'55',trust:'54'},
              bill:{status:'passed',closesAt:'2026-10-16T12:00:00Z',
                yesVotes:1,noVotes:0,abstentions:0}}],
            parties:[{seatNo:1,partyName:player.party_name,positions:1,votes:1}],
            fridayAct:{week_start:'2026-10-12',dossiers_published:1,
              decisions_resolved:1,treasury_delta_m_eur:-100,
              treasury_at_friday_m_eur:11900,approval_at_friday:55,
              trust_at_friday:54},
            elections:[{certifiedOn:'2026-10-16',electionNo:1,
              winnerParty:player.party_name}]}
        ]})
    }
    if (path==='/rest/v1/rpc/list_my_matches') return json([])
    if (path==='/rest/v1/rpc/list_public_lobbies') return json(state.publicLobbies ?? [])
    if (path==='/rest/v1/rpc/join_public_lobby') {
      const args=JSON.parse(request.postData() ?? '{}')
      state.lastPublicJoin=args
      state.publicLobbies=[]
      return json({match_id:args.p_match_id,user_id:state.user.id,
        seat_no:2,party_name:args.p_party_name})
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
    if (path==='/rest/v1/rpc/get_population_profile') return json({
      modelVersion:'households-v1',households:300,sampleResidents:900,
      districts:[
        {code:'capital',label:'Distrito Capital',seats:25},
        {code:'industrial',label:'Corredor Industrial',seats:20},
        {code:'coastal',label:'Región Costera',seats:18},
        {code:'agrarian',label:'Llanuras Agrarias',seats:15},
        {code:'highland',label:'Territorios de Montaña',seats:12},
        {code:'frontier',label:'Frontera Interior',seats:10}
      ],
      segments:[
        {dimension:'district',code:'capital',households:75,residents:225,support:48,trust:52},
        {dimension:'district',code:'industrial',households:60,residents:180,support:57,trust:56},
        {dimension:'district',code:'coastal',households:54,residents:162,support:53,trust:57},
        {dimension:'district',code:'agrarian',households:45,residents:135,support:55,trust:54},
        {dimension:'district',code:'highland',households:36,residents:108,support:49,trust:53},
        {dimension:'district',code:'frontier',households:30,residents:90,support:50,trust:51},
        {dimension:'income',code:'low',households:90,residents:270,support:48,trust:52},
        {dimension:'income',code:'middle',households:150,residents:450,support:57,trust:56},
        {dimension:'income',code:'high',households:60,residents:180,support:54,trust:58},
        {dimension:'age',code:'young',households:90,residents:270,support:48,trust:52},
        {dimension:'age',code:'working',households:150,residents:450,support:57,trust:56},
        {dimension:'age',code:'senior',households:60,residents:180,support:54,trust:58}
      ]
    })
    if (path==='/rest/v1/rpc/get_living_conditions') {
      if (state.livingError) return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Unavailable'})})
      const days=request.postDataJSON()?.p_days??30
      const summary={households:300,residents:900,economicSecurity:62.5,
        serviceAccess:50,wellbeing:57.5,approvalBefore:50,approvalAfter:51,
        trustBefore:50,trustAfter:50}
      const history=['2026-10-22','2026-10-24'].map(day=>({day,capturedAt:day+'T00:15:00Z',
        modelVersion:'living-conditions-v1',summary}))
      const segment=(dimension,code,households,residents)=>({dimension,code,households,residents,
        economicSecurity:62.5,serviceAccess:50,wellbeing:57.5,support:51})
      return json({governmentId:state.government.id,serverDay:'2026-10-24',fromDay:'2026-10-22',days,
        recordedDays:state.livingEmpty?0:2,expectedDays:state.livingEmpty?0:3,
        history:state.livingEmpty?[]:history,
        latest:state.livingEmpty?null:{...history[1],segments:[
          ...['low','middle','high'].map(code=>segment('income',code,100,300)),
          ...['capital','industrial','coastal','agrarian','highland','frontier'].map(code=>segment('district',code,50,150))
        ],inputs:{gdpIndex:100,unemploymentBp:700,inflationBp:250,policy:state.policy}}})
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
      expires_in:9000,expires_at:Math.floor(now/1000)+9000,user:state.user
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
  browser=await chromium.launch({...(process.env.AOS_CHROMIUM_CHANNEL==='bundled'?{}:{channel:'chrome'}),headless:true,args:['--no-sandbox']})

  await run('Bilingual public guide preserves chapter navigation, language link and mobile accessibility',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    await page.goto(BASE+'/guide?lang=en',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'From your first decision to a shared mandate'}).waitFor()
    await page.getByRole('heading',{name:'Government and opposition'}).waitFor()
    const sections=page.locator('main section')
    assert.equal(await sections.count(),16)
    await page.getByRole('link',{name:'Working through a political week'}).click()
    assert.equal(new URL(page.url()).hash,'#weekly-operations')
    await page.getByRole('button',{name:'Español'}).click()
    await page.getByRole('heading',{name:'Una semana política',exact:true}).waitFor()
    assert.equal(new URL(page.url()).searchParams.get('lang'),null)
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'De tu primera decisión a un mandato compartido'}).waitFor()
    await page.getByRole('button',{name:'English'}).click()
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'From your first decision to a shared mandate'}).waitFor()
    assert.equal(await page.getByRole('link',{name:'Try the demo'}).getAttribute('href'),
      '/demo?lang=en')
    assert.equal(await page.getByRole('link',{name:'Service status'}).getAttribute('href'),
      '/status?lang=en')
    await checkMobileOverflow(page,'English player guide')
    await checkA11y(page,'English player guide')
    await context.close()
  })

  await run('English guest demo signs an isolated choice and survives language reload',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    await page.goto(BASE+'/demo?lang=en',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Govern before signing up.'}).waitFor()
    assert.equal(await page.getByRole('link',{name:'Guide'}).getAttribute('href'),
      '/guide?lang=en')
    await page.getByRole('radio',{name:/Direct assistance to families/}).check()
    await page.getByRole('button',{name:'Review practice choice'}).click()
    await page.getByRole('button',{name:'Apply practice choice'}).click()
    await page.getByText('1 / 4 dossiers').waitFor()
    await page.getByRole('button',{name:'Español'}).click()
    await page.getByRole('heading',{name:'Ayuda directa a familias'}).waitFor()
    await page.reload({waitUntil:'networkidle'})
    await page.getByText('1 / 4 expedientes').waitFor()
    await checkMobileOverflow(page,'bilingual guest training')
    await checkA11y(page,'bilingual guest training')
    await context.close()
  })

  await run('English real-account entry remains safe across Cabinet and Assembly',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await page.goto(BASE+'/?lang=en',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'To govern is to choose which consequences to accept.'}).waitFor()
    await page.getByRole('button',{name:'Sign in with password'}).waitFor()
    assert.equal(await page.getByRole('link',{name:'Try four decisions without an account'})
      .getAttribute('href'),'/demo?lang=en')
    await checkMobileOverflow(page,'English Cabinet account entry')
    await checkA11y(page,'English Cabinet account entry')
    await page.goto(BASE+'/multiplayer?lang=en',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Power is never exercised alone.'}).waitFor()
    await page.getByRole('button',{name:'Sign in with password'}).waitFor()
    assert.equal(await page.getByRole('link',{name:'Player guide'})
      .getAttribute('href'),'/guide?lang=en')
    await checkMobileOverflow(page,'English Parliament account entry')
    await checkA11y(page,'English Parliament account entry')
    await context.close()
  })

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
    const context=await browser.newContext({viewport:{width:1800,height:900}})
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

  await run('Diplomacy panel shows authoritative blocs and routes into treaty dossier',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    const treaty={...state.dossier,id:'diplomacy-europe',title:'Pacto político con Europa',
      programme_chapter:'diplomacy',programme_order:1,category:'Europa'}
    state.foundationalDossiers=[state.dossier,treaty]
    state.foundationalOptions=[state.option,{...state.option,
      dossier_id:'diplomacy-europe',id:'europe-social-treaty',
      title:'Tratado de movilidad social'}]
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    const diplomacy=page.getByRole('region',{name:'Diplomacia y relaciones internacionales'})
    await diplomacy.getByRole('progressbar',{name:'Relación con Europa'}).waitFor()
    assert.equal(await diplomacy.getByRole('progressbar',{
      name:'Relación con Europa'}).getAttribute('aria-valuenow'),'50')
    await diplomacy.getByRole('button',{name:'Negociar expediente'}).first().click()
    await page.getByRole('heading',{name:'Pacto político con Europa'}).last().waitFor()
    assert.equal(state.events.length,0,'just opening a treaty must never sign it')
    await checkMobileOverflow(page,'diplomacy mobile')
    await checkA11y(page,'diplomacy mobile')
    await context.close()
  })

  await run('Strategic portfolio compares two permanent reforms without authorizing any act',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    const pension={...state.dossier,id:'fiction-pension-reform',
      title:'Jubilaciones sostenibles',programme_chapter:'society',programme_order:1}
    const choice={...state.option,dossier_id:pension.id,id:'targeted-pensions',
      title:'Financiación intergeneracional',treasury_delta_m_eur:-600}
    state.foundationalDossiers=[state.dossier,pension]
    state.foundationalOptions=[state.option,choice]
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    const planner=page.getByRole('region',{name:'Planificador de cartera legislativa'})
    await planner.getByRole('button',{name:'Abrir planificación'}).click()
    await planner.getByLabel('Planificar Plan de resiliencia energética')
      .selectOption('household-support')
    await planner.getByLabel('Planificar Jubilaciones sostenibles')
      .selectOption('targeted-pensions')
    await planner.getByLabel('Medidas seleccionadas').getByRole('listitem').first().waitFor()
    await planner.getByText('-2.000 M€').waitFor()
    await planner.getByText('10.000 M€').waitFor()
    assert.equal(state.events.length,0,'draft must not submit a national act')
    await checkMobileOverflow(page,'multi-policy portfolio')
    await checkA11y(page,'multi-policy portfolio')
    await page.screenshot({path:OUT+'/policy-portfolio-mobile.png',fullPage:true})
    await planner.getByRole('button',{name:'Vaciar borrador'}).click()
    await planner.locator('.policy-portfolio-fiscal').getByText('0 M€', { exact: true }).first().waitFor()
    await context.close()
  })

  await run('Authenticated national decisions survive browser reload',async()=>{
    const context=await browser.newContext({viewport:{width:1800,height:1000}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'La agenda de gobierno'}).waitFor()
    await page.getByRole('heading',{name:'Presupuesto del Estado'}).waitFor()
    await page.getByRole('button',{name:'Explorar población'}).waitFor()
    await page.getByRole('radio',{name:/Proteger a los hogares/}).check()
    await page.getByRole('button',{name:'Revisar decisión'}).click()
    await page.getByRole('button',{name:'Firmar y ejecutar decisión'}).click()
    await page.getByText(/Tesorería.*10.600|10.600 M€/).first().waitFor()
    assert.equal(state.events.length,1)
    await page.reload({waitUntil:'networkidle'})
    await page.getByRole('heading',{name:'Presupuesto del Estado'}).waitFor()
    await page.getByRole('button',{name:'Explorar población'}).click()
    await page.getByRole('heading',{name:'Ingresos bajos'}).waitFor()
    await page.getByRole('progressbar',{name:'Apoyo de Ingresos bajos'}).waitFor()
    assert.equal(state.events.length,1)
    assert.equal(state.government.treasury_m_eur,10600)
    await checkMobileOverflow(page,'desktop authenticated nation')
    await checkA11y(page,'authenticated nation')
    await page.screenshot({path:OUT+'/nation-desktop.png',fullPage:true})
    await context.close()
  })

  await run('Authenticated regional electorate is accessible and mobile WCAG-safe',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/',{waitUntil:'networkidle'})
    await page.getByRole('button',{name:'Explorar población'}).click()
    await page.getByRole('button',{name:'Circunscripciones'}).click()
    await page.getByRole('heading',{name:'Distrito Capital'}).waitFor()
    await page.getByRole('heading',{name:'Frontera Interior'}).waitFor()
    await page.getByText(/25 escaños territoriales/).waitFor()
    await checkMobileOverflow(page,'territorial population')
    await checkA11y(page,'territorial population')
    await page.screenshot({path:OUT+'/territorial-population-mobile.png',fullPage:true})
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
  await run('Authenticated weekly history is accessible and reloadable on mobile',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    state.weeklyMatch=true
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/multiplayer',{waitUntil:'networkidle'})
    const inbox=page.getByRole('region',{name:'Bandeja de actividad política'})
    await inbox.getByText('Planifica la actividad de campaña semanal').waitFor()
    assert.equal(await inbox.getByLabel('Avisos sin leer',{exact:true}).innerText(),'2 sin leer')
    await inbox.getByRole('button',{name:'Marcar leído'}).first().click()
    await page.getByText('1 sin leer',{exact:true}).waitFor()
    const observatory=page.getByRole('region',{name:'Observatorio electoral histórico'})
    await observatory.getByRole('heading',{name:'Observatorio de intención de voto'}).waitFor()
    await observatory.getByText('2 / 30').waitFor()
    await observatory.getByText('+2.00 puntos desde la primera captura del periodo').waitFor()
    await observatory.getByRole('radio',{name:'7 días'}).check()
    await observatory.getByText('2 / 7').waitFor()
    await page.getByRole('heading',{name:'Seguimiento de la legislatura'}).waitFor()
    await page.getByText(/No se ha publicado ninguna agenda editorial/).waitFor()
    await page.getByRole('combobox',{name:'Semana política'}).selectOption('2026-10-12')
    await page.getByText('Plan político archivado').waitFor()
    assert.equal(await page.getByRole('link',{
      name:'Fuente: Fuente verificada de prueba'
    }).getAttribute('href'),'https://example.org/test-source')
    await page.getByText(/Acta oficial del viernes/).waitFor()
    await checkMobileOverflow(page,'weekly legislature history')
    await checkA11y(page,'weekly legislature history')
    await page.screenshot({path:OUT+'/weekly-history-mobile.png',fullPage:true})
    await page.reload({waitUntil:'networkidle'})
    await page.getByText('1 sin leer',{exact:true}).waitFor()
    await page.getByRole('region',{name:'Observatorio electoral histórico'})
      .getByText('2 / 30').waitFor()
    await page.getByRole('heading',{name:'Seguimiento de la legislatura'}).waitFor()
    await page.getByRole('combobox',{name:'Semana política'}).selectOption('2026-10-12')
    await page.getByText('Plan político archivado').waitFor()
    await context.close()
  })
  await run('Direct invitation preserves the room through OTP login and reload',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    const code='ab12ab12ab12ab12ab12ab12ab12ab12'
    await routeApi(page,state)
    await page.goto(BASE+'/multiplayer?invite='+code,{waitUntil:'networkidle'})
    await page.getByLabel('Correo electrónico').fill('newplayer@example.invalid')
    await page.getByRole('button',{name:'Recibir enlace de acceso'}).click()
    assert.equal(state.otpCount,1)
    assert.equal(new URL(state.lastOtp.url).searchParams.get('redirect_to'),
      BASE+'/multiplayer?invite='+code)
    await injectUser(page,state)
    await page.reload({waitUntil:'networkidle'})
    assert.equal(await page.getByRole('textbox',{name:'Código de invitación'}).inputValue(),code)
    await checkMobileOverflow(page,'multiplayer invitation deep link')
    await checkA11y(page,'multiplayer invitation deep link')
    await page.screenshot({path:OUT+'/invitation-mobile.png',fullPage:true})
    await context.close()
  })
  await run('Authenticated public lobby joins without exposure of invite tokens',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    const publicMatchId='c0000000-0000-4000-8000-000000000033'
    state.publicLobbies=[{
      id:publicMatchId,title:'Parlamento ciudadano abierto',
      player_count:4,open_seats:6,created_at:'2026-10-24T10:00:00Z'
    }]
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/multiplayer',{waitUntil:'networkidle'})
    await page.getByText('Parlamento ciudadano abierto').waitFor()
    await page.getByRole('button',{name:/Parlamento ciudadano abierto/}).click()
    await page.getByRole('textbox',{
      name:'Nombre del partido para partida pública'}).fill('Alianza Reforma')
    await checkMobileOverflow(page,'public multiplayer directory')
    await checkA11y(page,'public multiplayer directory')
    await page.getByRole('button',{name:'Unirme a la asamblea'}).click()
    await page.waitForFunction(()=>window.document.querySelector(
      'input[aria-label="Nombre del partido para partida pública"]')===null)
    assert.deepEqual(state.lastPublicJoin,{
      p_match_id:publicMatchId,p_party_name:'Alianza Reforma'
    })
    await page.screenshot({path:OUT+'/matchmaking-mobile.png',fullPage:true})
    await context.close()
  })
  await run('Ten-source editorial import remains unpublished after browser reload',async()=>{
    const context=await browser.newContext({viewport:{width:390,height:844}})
    const page=await context.newPage()
    const state=createServerState()
    await routeApi(page,state)
    await injectUser(page,state)
    await page.goto(BASE+'/editorial',{waitUntil:'networkidle'})
    await page.getByRole('button',{name:'Preparar 10 fuentes automáticamente'}).waitFor()
    await page.getByRole('button',{name:'Preparar 10 fuentes automáticamente'}).click()
    await page.getByText(/Se han preparado 10 referencias/).waitFor()
    const progress=page.getByRole('progressbar',{name:'Expedientes preparados'})
    assert.equal(await progress.getAttribute('aria-valuenow'),'0')
    assert.equal(await page.getByRole('button',{name:'Revisar publicación'}).isDisabled(),true)
    await page.getByRole('button',{name:'Preparar diez escenarios políticos'}).click()
    await page.getByRole('textbox',{name:'Decisión option-c'}).waitFor()
    assert.equal(await progress.getAttribute('aria-valuenow'),'10')
    assert.equal(await page.getByRole('button',{name:'Revisar publicación'}).isDisabled(),true)
    assert.equal(await page.getByRole('textbox',{name:'Título de la fuente'}).inputValue(),
      'Published source headline for section 0 story 0')
    await checkMobileOverflow(page,'editorial source import')
    await checkA11y(page,'editorial source import')
    await page.screenshot({path:OUT+'/editorial-sources-mobile.png',fullPage:true})
    await page.getByRole('button',{name:'Preparar diez escenarios políticos'}).click()
    await page.getByRole('textbox',{name:'Decisión option-e'}).waitFor()
    assert.equal(await progress.getAttribute('aria-valuenow'),'10')
    assert.equal(await page.getByRole('button',{name:'Revisar publicación'}).isDisabled(),true)
    await checkMobileOverflow(page,'five-way editorial slate')
    await checkA11y(page,'five-way editorial slate')
    // Import is a local draft, not an unreviewed publication or implicit save.
    await page.reload({waitUntil:'networkidle'})
    assert.equal(await page.getByRole('textbox',{name:'Título de la fuente'}).inputValue(),'')
    assert.equal(await progress.getAttribute('aria-valuenow'),'0')
    await context.close()
  })
  await run('Daily living conditions: income, regions, history, reload and recoverable failures',async()=>{
    for(const width of [375,390,1440]){
      const context=await browser.newContext({viewport:{width,height:900}})
      const page=await context.newPage()
      const state=createServerState()
      await routeApi(page,state)
      await injectUser(page,state)
      await page.goto(BASE+'/',{waitUntil:'networkidle'})
      const panel=page.getByRole('region',{name:'Condiciones de vida de la población'})
      await panel.getByRole('meter',{name:'Bienestar'}).waitFor()
      await panel.getByRole('button',{name:'Explorar balance social'}).click()
      await panel.getByRole('heading',{name:'Ingresos bajos'}).waitFor()
      await panel.getByText('2 / 3 días registrados.',{exact:false}).waitFor()
      assert.equal(await panel.getByRole('table').getByText('2026-10-23').count(),0)
      await panel.getByRole('button',{name:'Por territorio'}).click()
      await panel.getByRole('heading',{name:'Distrito Capital'}).waitFor()
      await panel.getByRole('combobox').selectOption('7')
      await panel.getByRole('table').waitFor()
      await checkMobileOverflow(page,'daily social '+width)
      await checkA11y(page,'daily social '+width)
      await page.screenshot({path:OUT+'/daily-social-'+width+'.png',fullPage:true})
      await page.reload({waitUntil:'networkidle'})
      await panel.getByRole('meter',{name:'Bienestar'}).waitFor()
      state.livingEmpty=true
      await page.reload({waitUntil:'networkidle'})
      await panel.getByText(/La primera medición diaria está pendiente/).waitFor()
      state.livingEmpty=false;state.livingError=true
      await page.reload({waitUntil:'networkidle'})
      await panel.getByRole('alert').waitFor()
      state.livingError=false
      await panel.getByRole('button',{name:'Reintentar balance social'}).click()
      await panel.getByRole('meter',{name:'Bienestar'}).waitFor()
      assert.equal(await panel.getByRole('alert').count(),0)
      await context.close()
    }
  })
  await run('Ten-dossier authoritative founding programme, persist, filter and mobile accessibility',async()=>{
    for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
      const context=await browser.newContext({viewport})
      const page=await context.newPage()
      const state=createServerState()
      state.foundationalDossiers=[state.dossier,...Array.from({length:9},(_,i)=>({
        ...state.dossier,id:'founding-'+i,title:'Capítulo político '+(i+1),
        category:'Instituciones',release_kind:'intro'
      }))]
      state.foundationalOptions=[state.option,...state.foundationalDossiers.slice(1).map(dossier=>({
        ...state.option,dossier_id:dossier.id
      }))]
      await routeApi(page,state)
      await injectUser(page,state)
      await page.goto(BASE+'/',{waitUntil:'networkidle'})
      const agenda=page.getByRole('region',{name:'Programa político y expedientes'})
      await agenda.getByText('0 / 10').waitFor()
      await agenda.getByRole('progressbar',{name:'Decisiones del programa firmadas'}).waitFor()
      await agenda.getByRole('button',{name:'Esta semana'}).click()
      await agenda.getByRole('status').filter({hasText:'No hay expedientes'}).waitFor()
      await agenda.getByRole('button',{name:'Programa inicial'}).click()
      assert.equal(await agenda.getByRole('button',{name:/FICTICIO/}).count(),10)
      await page.getByRole('radio',{name:/Proteger a los hogares/}).check()
      await page.getByRole('button',{name:'Revisar decisión'}).click()
      await page.getByRole('button',{name:'Firmar y ejecutar decisión'}).click()
      await agenda.getByText('1 / 10').waitFor()
      await agenda.getByLabel('Impactos acumulados de las decisiones fundacionales')
        .getByText('-1.400 M€').waitFor()
      await page.reload({waitUntil:'networkidle'})
      await page.getByRole('region',{name:'Programa político y expedientes'}).getByText('1 / 10').waitFor()
      const restored=page.getByRole('region',{name:'Programa político y expedientes'})
      await restored.getByRole('button',{name:'Pendientes'}).click()
      assert.equal(await restored.getByRole('button',{name:/FICTICIO/}).count(),9)
      assert.equal(state.events.length,1)
      await checkMobileOverflow(page,'founding political programme')
      await checkA11y(page,'founding political programme')
      await page.screenshot({path:OUT+'/founding-programme-'+viewport.width+'.png',fullPage:true})
      await context.close()
    }
  })

  await run('Ten-party roster on two isolated Chromium identities: government vs opposition',async()=>{
    const partyIds=Array.from({length:10},(_,i)=>
      '71000000-0000-4000-8000-'+String(i+1).padStart(12,'0'))
    const roster=partyIds.map((user_id,i)=>({
      match_id:'80000000-0000-4000-8000-000000000037',
      user_id,seat_no:i+1,party_name:'Partido '+(i+1),
      manifesto_policy:50,mandate_seats:10,
      joined_at:'2026-10-12T09:00:00Z',is_ready:true
    }))
    const openDossier={
      id:'weekly-published',version:1,title:'Ley semanal verificada de prueba',
      context:'Escenario editorial sintético; no corresponde a una noticia real.',
      category:'Instituciones',release_kind:'weekly',
      available_from:'2026-10-19',available_until:'2026-10-23',
      source_url:'https://example.invalid/weekly',source_title:'Fuente sintética'
    }
    const introDossier={
      id:'energy-resilience',version:1,title:'Política energética ficticia',
      context:'Escenario ficticio permanente',category:'Energía',release_kind:'intro',
      available_from:null,available_until:null
    }
    for(const role of [{index:0,width:1440,language:'es'},{index:4,width:390,language:'es'},
      {index:9,width:390,language:'en'}]) {
      const context=await browser.newContext({
        viewport:{width:role.width,height:900}
      })
      const page=await context.newPage()
      const state=createServerState(partyIds[role.index])
      state.weeklyMatch=true
      state.syntheticRoster=roster
      state.syntheticGameDay='2026-10-21'
      state.syntheticCalendar={gameDay:'2026-10-21',monday:'2026-10-19',
        friday:'2026-10-23',fridayReached:false,weeklyPublished:true,
        weeklyTotal:1,weeklyResolved:0,latestFriday:null}
      state.syntheticParliament={
        bills:[{id:'aos-047-bill',match_id:roster[0].match_id,
          dossier_id:openDossier.id,dossier_version:1,option_id:state.option.id,
          proposed_by:roster[0].user_id,status:'open',
          rule_version:'parliament-mandates-v2',created_at:'2026-10-20T10:00:00Z',
          closes_at:'2026-10-23T18:00:00Z',closed_at:null}],
        votes:[],serverNow:'2026-10-21T11:00:00Z'}
      state.syntheticDossiers=[introDossier,openDossier]
      state.syntheticOptions=[
        {...state.option,dossier_id:introDossier.id},
        {...state.option,dossier_id:openDossier.id}
      ]
      await routeApi(page,state)
      await injectUser(page,state)
      await page.goto(BASE+'/multiplayer'+(role.language==='en'?'?lang=en':''),{waitUntil:'networkidle'})
      if(role.language==='en') {
        const board=page.getByRole('region',{name:'Assembly decision centre'})
        const mission=page.getByRole('region',{name:'Legislative operations centre'})
        await board.getByRole('heading',{name:'Political council'}).waitFor()
        await mission.getByRole('heading',{name:'Legislative operations'}).waitFor()
        await mission.getByText('YOUR VOTE NEEDED').waitFor()
        await mission.getByRole('button',{name:/Open next item/}).click()
        await page.getByRole('region',{name:'Parliamentary vote'})
          .getByRole('heading',{name:'Assembly mandate'}).waitFor()
        await page.getByRole('button',{name:'In favor'}).waitFor()
        await board.getByRole('button',{name:'Diplomacy'}).click()
        await board.getByText(/No items match this filter/).waitFor()
        assert.equal(await page.locator('.match-seat.occupied').count(),10)
        await checkMobileOverflow(page,'English ten-party command board')
        await checkA11y(page,'English ten-party command board')
        await page.screenshot({path:OUT+'/multi-command-english-390.png',fullPage:true})
        await context.close()
        continue
      }
      const board=page.getByRole('region',{name:'Centro de decisiones de la asamblea'})
      await board.getByRole('heading',{name:'Consejo político'}).waitFor()
      const campaign=page.getByRole('region',{name:'Campaña electoral'})
      await campaign.getByText('Influencia efectiva actual:',{exact:false}).first().waitFor()
      await campaign.getByText('Próximo desgaste: 2026-10-31 (UTC)').waitFor()
      await campaign.getByRole('heading',{name:'Financiación pública ficticia'}).waitFor()
      await campaign.getByText('Disponibles').waitFor()
      await campaign.getByText('Coste de esta estrategia: 4 créditos.').waitFor()
      await campaign.getByText(/se desgasta dos puntos cada siete días/).waitFor()
      const mission=page.getByRole('region',{name:'Sala de operaciones legislativas'})
      await mission.getByRole('heading',{name:'Operaciones legislativas'}).waitFor()
      await mission.getByText('TU VOTO PENDIENTE').waitFor()
      assert.match(await mission.getByLabel('Progreso legislativo semanal').innerText(),/1 \/ 1/)
      await mission.getByRole('button',{name:/Abrir siguiente asunto/}).click()
      await page.getByText('Ley semanal verificada de prueba',{exact:true}).first().waitFor()
      await page.locator('.match-seat.occupied').filter({hasText:'Partido 10'}).waitFor()
      assert.equal(await page.locator('.match-seat.occupied').count(),10)
      assert.equal(await board.getByText('0 / 1 firmados').count(),2)
      const choices=await board.getByRole('button',{name:/PLAZO SEMANAL|PROGRAMA INICIAL FICTICIO/}).all()
      assert.match(await choices[0].innerText(),/Ley semanal verificada de prueba/)
      if(role.index===0) {
        await board.getByText('Gobierno ejecutivo').waitFor()
        await page.getByText('COMPETENCIA DEL GOBIERNO').waitFor()
      } else {
        await board.getByText('Partido de oposición').waitFor()
        assert.equal(await page.getByText('COMPETENCIA DEL GOBIERNO').count(),0)
      }
      await board.getByRole('button',{name:'Esta semana'}).click()
      assert.equal(await board.getByRole('button',{name:/PLAZO SEMANAL/}).count(),1)
      await board.getByRole('button',{name:'Programa inicial'}).click()
      assert.equal(await board.getByRole('button',{name:/PROGRAMA INICIAL FICTICIO/}).count(),1)
      await checkMobileOverflow(page,'ten-party command board '+role.width)
      await checkA11y(page,'ten-party command board '+role.width)
      await page.screenshot({path:OUT+'/multi-command-'+role.width+'.png',fullPage:true})
      await context.close()
    }
  })

  await run('Public player manual is readable without authentication',async()=>{
    const context=await browser.newContext({viewport:{width:375,height:844}})
    const page=await context.newPage()
    await page.goto(BASE+'/guide',{waitUntil:'networkidle'})
    await page.getByRole('heading',{level:1}).waitFor()
    await page.getByRole('navigation',{name:'Contenido del manual'}).getByRole('link',{name:'Una semana política',exact:true}).click()
    await page.getByRole('heading',{name:'Una semana política',exact:true}).waitFor()
    await checkMobileOverflow(page,'public player manual')
    await checkA11y(page,'public player manual')
    await context.close()
  })
  console.log('Browser scenarios passed: '+passed.length)
  if (failed.length) throw new Error('Failed scenarios: '+failed.join(', '))
} catch (error) {
  console.error('BROWSER SMOKE FAILED',error)
  process.exitCode=1
} finally {
  await browser?.close()
}
