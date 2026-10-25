/**
 * Visual/WCAG E2E of the public service status page. Mock only the external
 * Auth HTTP response; the React app and its manifest are served by real Vite.
 */
import assert from 'node:assert/strict'
import {mkdirSync,readFileSync} from 'node:fs'
import {chromium} from 'playwright'

const origin=process.env.AOS_BROWSER_BASE_URL??'http://127.0.0.1:4173'
if(!/^http:\/\/127\.0\.0\.1:4173$/.test(origin))
  throw new Error('AOS_STATUS_LOCAL_ONLY')
mkdirSync('test-results/browser',{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true,args:['--no-sandbox']})
try{
 const axe=readFileSync('node_modules/axe-core/axe.min.js','utf8')
 for(const width of [390,1440]){
  const page=await browser.newPage({viewport:{width,height:900}})
  const failures=[]
  page.on('pageerror',x=>failures.push(x.message))
  await page.route('https://aos-browser-tests.supabase.co/auth/v1/health',
   route=>route.fulfill({status:200,contentType:'application/json',
    body:JSON.stringify({version:'synthetic-local-browser-health'})}))
  await page.goto(origin+'/status',{waitUntil:'networkidle'})
  await page.getByRole('heading',{name:'Estado técnico del juego'}).waitFor()
  await page.getByText('electoral-districts-v2').waitFor()
  await page.getByText('Endpoint de autenticación accesible').waitFor()
  await page.getByRole('button',{name:'Comprobar de nuevo'}).click()
  await page.getByText('Endpoint de autenticación accesible').waitFor()
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth)
  assert.ok(overflow<=2,'Status page overflow at '+width+'px: '+overflow)
  await page.addScriptTag({content:axe})
  const violations=await page.evaluate(async()=>{
    const report=await window.axe.run(document.body,{
      runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}
    })
    return report.violations.filter(v=>v.impact==='critical'||v.impact==='serious')
      .map(v=>v.id)
  })
  assert.deepEqual(violations,[],'Serious accessibility violations at '+width+'px')
  assert.deepEqual(failures,[],'Runtime JS exception in status UI')
  await page.screenshot({path:'test-results/browser/status-'+width+'.png',
    fullPage:true})
  await page.close()
 }
 console.log('AOS_STATUS_BROWSER_PASS: two Chromium viewports and WCAG AA')
}finally{await browser.close()}
