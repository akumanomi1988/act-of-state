// Chromium E2E: public /demo, real browser storage, no backend calls.
// Credentials, real Supabase Auth and multiplayer are intentionally out of scope.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright'

const BASE = process.env.AOS_BROWSER_BASE_URL ?? 'http://127.0.0.1:4173'
const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8')
mkdirSync('test-results/browser', { recursive: true })
const browser = await chromium.launch({ ...(process.env.AOS_CHROMIUM_CHANNEL === 'bundled' ? {} : { channel: 'chrome' }), headless: true, args: ['--no-sandbox'] })

try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const context = await browser.newContext({ viewport })
    const page = await context.newPage()
    const externalRequests = []
    page.on('request', request => {
      if (/\/auth\/v1\/|\/rest\/v1\/|\/functions\/v1\//.test(request.url())) {
        externalRequests.push(request.url())
      }
    })
    await page.goto(BASE + '/demo')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.getByRole('heading', { name: 'Gobierna antes de registrarte.' }).waitFor()
    assert.match(await page.locator('main').innerText(), /MODO DE ENSAYO, NO PARTIDA OFICIAL/)
    assert.equal(await page.getByText('0 / 4 expedientes').count(), 1)
    await page.getByRole('radio', { name: /Ayuda directa a familias/ }).check()
    await page.getByRole('button', { name: 'Revisar medida de prueba' }).click()
    await page.getByRole('button', { name: 'Aplicar medida de prueba' }).click()
    await page.getByText('1 / 4 expedientes').waitFor()
    assert.equal(await page.getByRole('heading', { name: 'Ayuda directa a familias' }).count(), 1)
    await page.reload()
    await page.getByText('1 / 4 expedientes').waitFor()
    await page.getByRole('button', { name: 'Siguiente expediente pendiente' }).click()
    await page.getByRole('heading', { name: 'El acceso a la vivienda' }).waitFor()
    await page.getByRole('radio', { name: /Agilizar licencias de obra/ }).check()
    await page.getByRole('button', { name: 'Revisar medida de prueba' }).click()
    await page.getByRole('button', { name: 'Aplicar medida de prueba' }).click()
    await page.getByText('2 / 4 expedientes').waitFor()
    await page.getByRole('button', { name: 'Reiniciar ensayo' }).click()
    await page.getByRole('button', { name: 'Sí, reiniciar ensayo' }).click()
    await page.getByText('0 / 4 expedientes').waitFor()
    const layout = await page.evaluate(() => ({
      document: document.documentElement.scrollWidth,
      viewport: window.innerWidth
    }))
    assert.ok(layout.document <= layout.viewport + 1,
      'Guest sandbox overflows at viewport ' + viewport.width)
    await page.addScriptTag({ content: axeSource })
    const accessibility = await page.evaluate(async () => {
      // @ts-ignore runtime injected through axe-core source
      return window.axe.run(document, { runOnly: { type: 'tag',
        values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } })
    })
    assert.deepEqual(accessibility.violations.map(v => v.id), [],
      'WCAG violations for ' + viewport.width)
    assert.deepEqual(externalRequests, [], 'Demo must never contact Supabase')
    await page.screenshot({ path: 'test-results/browser/demo-' + viewport.width + '.png',
      fullPage: true })
    await context.close()
  }
  console.log('Guest sandbox: 2 Chromium viewports, review/sign, reload, reset, no backend, responsive, WCAG PASS')
} finally {
  await browser.close()
}
