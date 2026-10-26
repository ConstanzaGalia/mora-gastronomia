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
  const publicContext = await browser.createBrowserContext()
  const page = await publicContext.newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto('http://localhost:3000/mercadito', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('h1', { timeout: 30000 })
  const body = await page.evaluate(() => document.body.innerText)
  check('checkout público', page.url().includes('/mercadito') && !page.url().includes('/login'), page.url())
  check('oferta bandeja pan envío', body.includes('Bandeja + pan + envío gratis') || body.includes('Bandeja, pan y envío'))
  check('envío gratis', /envío gratis/i.test(body))
  check('pan incluido', /pan incluido/i.test(body))
  check('no vende postre', !documentHasSection('Postre'))
  check('no vende bebida', !documentHasSection('Bebida'))
  function documentHasSection(name) {
    return body.split('\n').some((line) => line.trim() === name)
  }
  const products = await page.$$eval('.market-product-copy strong', (els) => els.map((el) => el.textContent.trim()))
  check('hay bandejas', products.length > 0, products.join(', '))
  check('precio visible', await page.$('.market-hero-price') !== null)
  await page.click('.market-product .extras-stepper button[aria-label^="Sumar"]')
  await page.click('.market-product .extras-stepper button[aria-label^="Sumar"]')
  const summary = await page.$eval('.market-summary', (el) => el.innerText)
  check('resumen con incluido', /Incluido/.test(summary) && /Gratis/.test(summary), summary.slice(0, 240))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-checkout.png', fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-checkout-mobile.png', fullPage: true })
  await page.setViewport({ width: 1280, height: 900 })
  await page.type('input[name="customer_name"]', 'QA Checkout')
  await page.type('input[name="phone"]', '3815558888')
  await page.type('input[name="address"]', 'San Martín 200, San Miguel de Tucumán')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.click('.market-summary button[type="submit"]'),
  ])
  check('gracias', page.url().includes('/mercadito/pedido/'), page.url())
  await page.waitForFunction(() => document.body.innerText.includes('Pedido tomado'), { timeout: 20000 })
  const thanks = await page.evaluate(() => document.body.innerText)
  check('gracias incluido', thanks.includes('Incluido'))
  check('gracias envío', /Envío a domicilio[\s\S]*Gratis/.test(thanks))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-thanks.png', fullPage: true })
  const orderId = page.url().split('/').pop()

  const adminContext = await browser.createBrowserContext()
  const admin = await adminContext.newPage()
  await admin.setViewport({ width: 1440, height: 900 })
  await admin.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await admin.waitForSelector('input[name="email"]')
  await admin.type('input[name="email"]', 'amparo@mora.com')
  await admin.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    admin.click('button.login-submit'),
  ])
  await admin.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 60000 })
  const switcher = await admin.$('select[name="space_id"]')
  if (switcher) {
    const options = await admin.$$eval('select[name="space_id"] option', (els) => els.map((el) => ({ value: el.value, label: el.textContent.trim(), selected: el.selected })))
    const balcarce = options.find((item) => item.label === 'Balcarce')
    if (balcarce && !options.find((item) => item.selected)?.label.includes('Balcarce')) {
      await Promise.all([
        admin.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
        admin.select('select[name="space_id"]', balcarce.value),
      ])
    }
  }
  await admin.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await admin.waitForFunction(() => document.body.innerText.includes('QA Checkout'), { timeout: 20000 })
  const pedidos = await admin.evaluate(() => document.body.innerText)
  check('pedido en admin', pedidos.includes('QA Checkout'))
  check('cocina con pan', /Para producir[\s\S]*Pan/i.test(pedidos) || pedidos.includes('Pan'))
  const settingsBtn = await admin.evaluateHandle(() => [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Datos y transferencia')))
  await settingsBtn.asElement().click()
  await admin.waitForSelector('dialog[open] input[name="unit_price"]')
  const dialog = await admin.$eval('dialog[open]', (el) => el.innerText)
  check('precio por vianda', dialog.includes('Precio por vianda'))
  check('copy bandeja pan envío', /bandeja \+ pan \+ envío/i.test(dialog))
  await admin.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-settings.png' })

  const { createClient } = await import('@supabase/supabase-js')
  const { readFileSync } = await import('node:fs')
  const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1)]
  }))
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await supabase.from('market_orders').delete().eq('id', orderId)
  if (error) throw error
  console.log('deleted qa order')
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
console.log('\nOK checkout mercadito')
