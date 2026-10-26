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

async function login(context, email, password) {
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('input[name="email"]')
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', password)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.click('button.login-submit'),
  ])
  await page.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 60000 })
  return page
}

let orderId = ''

try {
  const publicPage = await (await browser.createBrowserContext()).newPage()
  await publicPage.setViewport({ width: 1280, height: 900 })
  await publicPage.goto('http://localhost:3000/mercadito', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await publicPage.waitForSelector('.market-checkout', { timeout: 30000 })
  await publicPage.click('.market-product .extras-stepper button[aria-label^="Sumar"]')
  await publicPage.click('.market-checkout-main .primary-button')
  await publicPage.waitForSelector('input[name="customer_name"]', { visible: true, timeout: 10000 })
  await publicPage.type('input[name="customer_name"]', 'QA Mapa')
  await publicPage.type('input[name="phone"]', '3815554321')
  await publicPage.type('input[name="address"]', 'San Martín 500, San Miguel de Tucumán')
  await publicPage.click('.market-checkout-main .primary-button')
  await publicPage.waitForFunction(() => document.body.innerText.includes('Cómo pagás'), { timeout: 10000 })
  await Promise.all([
    publicPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    publicPage.click('.market-summary button[type="submit"]'),
  ])
  check('pedido creado', publicPage.url().includes('/mercadito/pedido/'), publicPage.url())
  orderId = publicPage.url().split('/').pop() ?? ''

  const amparo = await login(await browser.createBrowserContext(), 'amparo@mora.com', 'Balcarce2026')
  const switcher = await amparo.$('select[name="space_id"]')
  if (switcher) {
    const options = await amparo.$$eval('select[name="space_id"] option', (els) => els.map((el) => ({ value: el.value, label: el.textContent.trim(), selected: el.selected })))
    const balcarce = options.find((item) => item.label === 'Balcarce')
    const current = options.find((item) => item.selected)
    if (balcarce && current?.label !== 'Balcarce') {
      await Promise.all([
        amparo.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
        amparo.select('select[name="space_id"]', balcarce.value),
      ])
      await amparo.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 30000 })
    }
  }

  await amparo.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await amparo.waitForFunction(() => document.body.innerText.includes('Pedidos del día') || document.body.innerText.includes('Pedidos del mes'), { timeout: 30000 })

  const wa = await amparo.$eval('.market-order-wa', (el) => ({
    href: el.getAttribute('href') ?? '',
    text: el.textContent.replace(/\s+/g, ' ').trim(),
  })).catch(() => null)
  check('whatsapp en tarjeta', Boolean(wa?.href.includes('wa.me') && wa.href.includes('3815554321') && /WhatsApp/i.test(wa.text)), JSON.stringify(wa))
  check('mensaje prellenado', Boolean(wa?.href.includes('Hola') || wa?.href.includes('Mora')), wa?.href.slice(0, 120) ?? '')

  await amparo.waitForSelector('.leaflet-container', { timeout: 20000 })
  check('mapa del día', Boolean(await amparo.$('.leaflet-container, .market-map.leaflet-container')))
  const maps = await amparo.$eval('a[href*="google.com/maps/dir"]', (el) => el.getAttribute('href') ?? '')
  check('ruta google maps', maps.includes('San') && maps.includes('Tucum'), maps.slice(0, 180))
  await amparo.waitForSelector('.market-map-pin', { timeout: 25000 })
  check('pin de entrega', Boolean(await amparo.$('.market-map-pin')))
  await amparo.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/pedidos-map-dia.png', fullPage: true })

  await amparo.select('select[name="vista"]', 'mes')
  await amparo.waitForFunction(() => location.search.includes('vista=mes'), { timeout: 15000 })
  await amparo.waitForFunction(() => document.body.innerText.includes('Pedidos del mes'), { timeout: 15000 })
  check('mes sin mapa', !(await amparo.$('.leaflet-container')))
  const monthWa = await amparo.$eval('.market-order-wa', (el) => el.getAttribute('href') ?? '')
  check('whatsapp en el mes', monthWa.includes('wa.me'))
  await amparo.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/pedidos-map-mes.png', fullPage: true })
} catch (error) {
  console.error(error)
  failures.push(String(error))
} finally {
  if (orderId) {
    const { createClient } = await import('@supabase/supabase-js')
    const { readFileSync } = await import('node:fs')
    const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }))
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
    await supabase.from('market_orders').delete().eq('id', orderId)
  }
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} fallos`)
  process.exit(1)
}
console.log('\nOK whatsapp y mapa')
