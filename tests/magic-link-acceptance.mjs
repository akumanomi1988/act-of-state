/**
 * AOS-046: real email-link sign-in, invitation return, persistent Auth session,
 * browser-created/joined parliament, and one-time token consumption.
 *
 * An isolated local-only CI experiment: GoTrue sends email to Mailpit, not
 * the internet; each Chromium browser opens its own real verification link.
 * This suite NEVER injects a JWT into browser localStorage.
 */
import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { mkdirSync, readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { chromium } from 'playwright'

const api = process.env.API_URL
const key = process.env.ANON_KEY
const app = process.env.AOS_BROWSER_BASE_URL ?? 'http://127.0.0.1:4173'
const mail = process.env.AOS_MAILPIT_URL ?? 'http://127.0.0.1:54324'
if (process.env.CI !== 'true' || !api || !key ||
  api !== 'http://127.0.0.1:54321' ||
  app !== 'http://127.0.0.1:4173' ||
  mail !== 'http://127.0.0.1:54324') {
  throw new Error('REFUSING_NONLOCAL_EMAIL_ACCEPTANCE')
}
const runId = randomBytes(8).toString('hex')
const testName = 'Email Link Parliament ' + runId
const authKey = 'sb-127-auth-token'
let assertions = 0
const check = (value,message) => { assert.ok(value,message); assertions++ }
const browser = await chromium.launch({
  ...(process.env.AOS_CHROMIUM_CHANNEL === 'bundled' ? {} : {channel:'chrome'}),
  headless:true,args:['--no-sandbox']
})
const pause = ms => new Promise(resolve=>setTimeout(resolve,ms))
function newClient() {
  return createClient(api,key,{auth:{
    persistSession:false, autoRefreshToken:false,detectSessionInUrl:false
  }})
}
async function accountFromBrowser(page) {
  const session = await page.evaluate(storageKey=>{
    const record = localStorage.getItem(storageKey)
    if (!record) return null
    try {
      const parsed=JSON.parse(record)
      return {access_token:parsed.access_token,refresh_token:parsed.refresh_token}
    } catch { return null }
  },authKey)
  check(!!session?.access_token && !!session?.refresh_token,
    'Browser Auth did not persist the signed session')
  const actor=newClient()
  const {data,error}=await actor.auth.setSession(session)
  if(error)throw error
  check(!!data.user?.id && data.session?.user.id===data.user.id,
    'Browser-stored tokens were not accepted by GoTrue')
  return {actor,user:data.user}
}
async function mailbox(email) {
  for(let attempt=0;attempt<35;attempt++) {
    const response=await fetch(mail+'/api/v1/messages?limit=100')
    check(response.ok,'Local Mailpit API unavailable')
    const listing=await response.json()
    const item=(listing.messages ?? []).find(message=>
      (message.To ?? []).some(to=>to.Address?.toLowerCase()===email.toLowerCase()))
    if(item) {
      const result=await fetch(mail+'/api/v1/message/'+encodeURIComponent(item.ID))
      if(!result.ok)throw Error('MAILPIT_MESSAGE_UNREADABLE')
      const body=await result.json()
      check((body.To??[]).some(to=>to.Address?.toLowerCase()===email.toLowerCase()),
        'Magic-link email leaked across recipients')
      const raw=(body.Text??'')+' '+(body.HTML??'')
      const links=raw.match(/https?:\/\/[^\s"'<>]+/g)??[]
      for(const item of links) {
        try {
          const unescaped=item.replaceAll('&amp;','&').replaceAll('&#38;','&')
            .replaceAll('&#x3D;','=')
          const target=new URL(unescaped)
          if(target.origin===api && target.pathname==='/auth/v1/verify' &&
             target.searchParams.has('token')) return target.href
        } catch { /* Look for the link in the next part. */ }
      }
      throw Error('MAILPIT_VERIFICATION_URL_MISSING')
    }
    await pause(400)
  }
  throw Error('MAGIC_EMAIL_NOT_DELIVERED_TO_LOCAL_MAILPIT')
}
async function login(page,email,path='/multiplayer') {
  await page.goto(app+path,{waitUntil:'networkidle'})
  // Legacy link flow no longer silently creates accounts. Register from
  // the real password UI first, then sign out and request a real email link.
  await page.getByRole('button',{name:'Crear cuenta'}).click()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByLabel('Contraseña',{exact:true}).fill('AOS-local-passphrase-'+runId)
  await page.getByLabel('Confirmar contraseña').fill('AOS-local-passphrase-'+runId)
  await page.getByRole('button',{name:'Registrar cuenta'}).click()
  await page.getByRole('button',{name:'Cerrar sesión'}).waitFor({timeout:15000})
  await page.getByRole('button',{name:'Cerrar sesión'}).click()
  await page.getByRole('button',{name:'Iniciar sesión'}).waitFor({timeout:15000})
  await page.getByText('¿Olvidaste tu contraseña o tienes una cuenta antigua?').click()
  await page.getByRole('button',{name:'Acceder por correo'}).click()
  await page.getByLabel('Correo electrónico').fill(email)
  await page.getByRole('button',{name:'Enviar enlace'}).click()
  await page.getByText(/Si la cuenta existe, recibirás un enlace de acceso/).waitFor({timeout:12000})
  const link=await mailbox(email)
  const linkUrl=new URL(link)
  const redirect=linkUrl.searchParams.get('redirect_to') ??
    linkUrl.searchParams.get('redirectTo')
  if(redirect) {
    check(redirect.startsWith(app+path),'Magic link discarded its approved game route')
  }
  // Test actual browser redirect: GoTrue verifies single-use link, and
  // supabase-js must consume its hash and persist a valid session.
  await page.goto(link,{waitUntil:'networkidle'})
  if((page.viewportSize()?.width??1440)<=760)
    await page.getByRole('navigation',{name:'Navegación de la asamblea'})
      .getByRole('button',{name:'Partidas'}).click()
  await page.getByRole('heading',{name:'Sala de partidas'}).waitFor({timeout:15000})
  const identity=await accountFromBrowser(page)
  check(identity.user.email===email,'Magic link authenticated the wrong recipient')
  return {link,identity}
}
mkdirSync('test-results/browser',{recursive:true})
const errors=[]
try {
  const hostContext=await browser.newContext({viewport:{width:1440,height:900}})
  const host=await hostContext.newPage()
  host.on('pageerror',error=>errors.push('host '+error.message))
  const hostEmail='aos-46-'+runId+'-host@example.invalid'
  const first=await login(host,hostEmail)
  // Hosting a game is performed through the genuine app form, not RPC fixtures.
  await host.getByLabel('Nombre de la partida').fill(testName)
  await host.getByLabel('Nombre del partido anfitrión').fill('Gobierno verificable')
  await host.getByRole('button',{name:'Fundar partida'}).click()
  await host.getByRole('heading',{name:testName}).waitFor({timeout:15000})
  const {data:matches,error:listError}=await first.identity.actor.rpc('list_my_matches')
  if(listError)throw listError
  check(matches.length===1 && matches[0].host_user_id===first.identity.user.id,
    'Real app did not create a privately owned match')
  const matchId=matches[0].id
  const {data:world,error:worldError}=await first.identity.actor.rpc('get_match_world',
    {p_match_id:matchId})
  if(worldError)throw worldError
  const invite=world.match.invite_code
  check(/^[a-f0-9]{32}$/.test(invite),'Browser-created match has invalid invite')

  const guestContext=await browser.newContext({viewport:{width:390,height:844}})
  const guest=await guestContext.newPage()
  guest.on('pageerror',error=>errors.push('guest '+error.message))
  const guestEmail='aos-46-'+runId+'-guest@example.invalid'
  const invitation='/multiplayer?invite='+invite
  const second=await login(guest,guestEmail,invitation)
  const prefilled=guest.getByLabel('Código de invitación')
  check(await prefilled.inputValue()===invite,'Magic-link roundtrip lost invite code')
  await guest.getByLabel('Partido invitado').fill('Oposición auténtica')
  await guest.getByRole('button',{name:'Ocupar escaño'}).click()
  await guest.getByRole('heading',{name:testName}).waitFor({timeout:15000})
  const {data:guestMatches,error:guestListError}=
    await second.identity.actor.rpc('list_my_matches')
  if(guestListError)throw guestListError
  check(guestMatches.some(item=>item.id===matchId && item.seat_no===2),
    'Invitation did not persist second participant')

  // Existing user returns after closing/reloading the browser tab.
  await guest.reload({waitUntil:'networkidle'})
  await guest.getByRole('heading',{name:testName}).waitFor()
  check(await guest.getByText('Gobierno verificable').count()>0,
    'Guest did not recover the hosting party after refresh')

  await host.reload({waitUntil:'networkidle'})
  await host.getByRole('heading',{name:testName}).waitFor()
  await host.getByRole('button',{name:'Comenzar legislatura'}).click()
  await host.getByRole('region',{name:'Expedientes del Parlamento'})
    .waitFor({timeout:15000})
  await guest.reload({waitUntil:'networkidle'})
  // The player now sees the active dossier first. Open the secondary
  // agenda explicitly before checking its parliamentary authorizations.
  await guest.locator('.match-game-agenda summary').click()
  const board=guest.getByRole('region',{name:'Expedientes del Parlamento'})
  await board.waitFor({timeout:15000})
  await board.getByText('Partido de oposición').waitFor()
  check(await guest.getByText('COMPETENCIA DEL GOBIERNO').count()===0,
    'Actual invited guest has cabinet privileges')
  await host.getByText('COMPETENCIA DEL GOBIERNO').waitFor()
  check((await first.identity.actor.auth.getUser()).data.user?.id===
    first.identity.user.id,'Host token no longer validates')

  // A consumed magic link must not authorize a third browser.
  const replayContext=await browser.newContext()
  const replay=await replayContext.newPage()
  await replay.goto(second.link,{waitUntil:'networkidle'})
  await replay.goto(app+'/multiplayer',{waitUntil:'networkidle'})
  await replay.getByRole('button',{name:'Iniciar sesión'})
    .waitFor({timeout:12000})
  check(await replay.getByRole('heading',{name:'Sala de partidas'}).count()===0,
    'Consumed one-time token authorized a second device')
  await replayContext.close()

  // Logout clears identity and private match UI even after reload.
  await guest.getByRole('button',{name:'Cerrar sesión'}).click()
  await guest.getByRole('button',{name:'Iniciar sesión'}).waitFor()
  await guest.reload({waitUntil:'networkidle'})
  await guest.getByRole('button',{name:'Iniciar sesión'}).waitFor()
  check(await guest.getByRole('heading',{name:testName}).count()===0,
    'Private match leaked after browser sign-out')
  const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8')
  for(const [page,label] of [[host,'host'],[guest,'signed-out-guest']]) {
    await page.addScriptTag({content:axe})
    const a11y=await page.evaluate(async()=>(await window.axe.run(document.body,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
    })).violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>v.id))
    check(a11y.length===0,'WCAG regression on '+label+': '+a11y.join(','))
    const width=await page.evaluate(()=>({
      viewport:innerWidth,document:document.documentElement.scrollWidth
    }))
    check(width.document<=width.viewport+2,'Horizontal overflow on '+label)
    await page.screenshot({
      path:'test-results/browser/magic-email-'+label+'.png',fullPage:true
    })
  }
  check(errors.length===0,'Real app runtime errors: '+errors.join('; '))
  await hostContext.close()
  await guestContext.close()
  console.log('AOS_REAL_EMAIL_PASS',JSON.stringify({
    realGoTrueEmailLinks:2, browserCreatedMatch:true,
    realInvitedBrowser:true,persistedBrowserReload:true,
    consumedLinkRejected:true,logoutIsolation:true,
    parliamentStarted:true,assertions,
    note:'Mailpit is a local SMTP capture; external email deliverability not tested'
  }))
} finally { await browser.close() }
