import puppeteer from './node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const failures = []
function check(name, ok, detail = '') {
  const line = `${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

try {
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto('http://localhost:3000/mercadito', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.market-cover, h1', { timeout: 30000 })
  const first = await page.evaluate(() => document.body.innerText)
  check('portada', Boolean(await page.$('.market-cover')))
  check('pasos', first.includes('Menú') && first.includes('Entrega') && first.includes('Pago'))
  check('sin selector de pan', !first.includes('Pan incluido') && !first.includes('Elegí el pan'))
  check('sin línea de pan', !first.includes('Pan integral') && !first.includes('Pan francés'))
  await page.click('.market-product .extras-stepper button[aria-label^="Sumar"]')
  const summary = await page.$eval('.market-summary', (el) => el.innerText)
  check('resumen sin pan', !/Pan /.test(summary) && summary.includes('Gratis'), summary.slice(0, 200))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-wizard-1.png', fullPage: true })

  await page.click('button.primary-button')
  await page.waitForSelector('input[name="customer_name"]', { visible: true, timeout: 10000 })
  const delivery = await page.evaluate(() => document.body.innerText)
  check('paso entrega', delivery.includes('Dónde lo llevamos'))
  check('foto entrega', Boolean(await page.$('.market-step-media')))
  await page.type('input[name="customer_name"]', 'QA Wizard')
  await page.type('input[name="phone"]', '3815557777')
  await page.type('input[name="address"]', 'San Martín 300, San Miguel de Tucumán')
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-wizard-2.png', fullPage: true })

  const buttons = await page.$$eval('.market-summary-actions button', (els) => els.map((el) => el.textContent.trim()))
  check('botón a pago', buttons.some((text) => text.includes('pago')), buttons.join(', '))
  await page.click('.market-summary-actions .primary-button')
  await page.waitForFunction(() => document.body.innerText.includes('Cómo pagás'), { timeout: 10000 })
  await page.click('input[value="TRANSFERENCIA"]')
  await page.waitForSelector('.market-transfer')
  const pay = await page.evaluate(() => document.body.innerText)
  check('instrucción transferencia', pay.includes('Transferí') || pay.includes('alias') || pay.includes('mora.gastro'))
  check('menciona WhatsApp', /WhatsApp/i.test(pay))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-wizard-3.png', fullPage: true })

  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.evaluate(() => document.querySelector('.market-summary-actions button[type="submit"]')?.click()),
  ])
  check('gracias', page.url().includes('/mercadito/pedido/'), page.url())
  await page.waitForFunction(() => document.body.innerText.includes('Pedido tomado'), { timeout: 20000 })
  const thanks = await page.evaluate(() => document.body.innerText)
  check('detalle sin pan', !thanks.includes('Pan integral') && !thanks.includes('Pan francés') && !thanks.includes('Incluido'))
  check('detalle con envío', thanks.includes('Envío a domicilio'))
  check('quedó transferencia', thanks.includes('Transferencia') || thanks.includes('comprobante'), thanks.slice(0, 280))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-wizard-thanks.png', fullPage: true })

  const orderId = page.url().split('/').pop()
  const { createClient } = await import('@supabase/supabase-js')
  const { readFileSync } = await import('node:fs')
  const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1)]
  }))
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await supabase.from('market_orders').delete().eq('id', orderId)
  if (error) throw error
} catch (error) {
  console.error(error)
  failures.push(String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} fallos`)
  process.exit(1)
}
console.log('\nOK wizard mercadito')
