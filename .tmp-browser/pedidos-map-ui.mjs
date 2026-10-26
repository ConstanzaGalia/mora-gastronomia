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
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('input[name="email"]')
  await page.type('input[name="email"]', 'amparo@mora.com')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.click('button.login-submit'),
  ])
  await page.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 60000 })
  const switcher = await page.$('select[name="space_id"]')
  if (switcher) {
    const options = await page.$$eval('select[name="space_id"] option', (els) => els.map((el) => ({ value: el.value, label: el.textContent.trim(), selected: el.selected })))
    const balcarce = options.find((item) => item.label === 'Balcarce')
    const current = options.find((item) => item.selected)
    if (balcarce && current?.label !== 'Balcarce') {
      await Promise.all([
        page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
        page.select('select[name="space_id"]', balcarce.value),
      ])
    }
  }
  await page.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.body.innerText.includes('Pedidos del día'), { timeout: 30000 })

  const wa = await page.$eval('.market-order-wa', (el) => ({
    href: el.getAttribute('href') ?? '',
    text: el.textContent.replace(/\s+/g, '').trim(),
    svg: Boolean(el.querySelector('svg')),
    label: el.getAttribute('aria-label') ?? '',
  }))
  check('solo icono whatsapp', wa.svg && wa.text === '' && /WhatsApp/i.test(wa.label) && wa.href.includes('wa.me'), JSON.stringify(wa))
  check('telefono visible aparte', Boolean(await page.$('.market-order-contact .event-client')))

  await page.waitForSelector('.market-map-panel .leaflet-container', { timeout: 20000 })
  const embed = await page.evaluate(() => {
    const wrap = document.querySelector('.market-map-wrap')
    const map = document.querySelector('.market-map')
    const panel = document.querySelector('.market-map-panel')
    const route = document.querySelector('.market-map-route')
    if (!wrap || !map || !panel || !route) return null
    const wrapRect = wrap.getBoundingClientRect()
    const panelRect = panel.getBoundingClientRect()
    return {
      fullBleed: Math.abs(wrapRect.left - panelRect.left) < 2 && Math.abs(wrapRect.right - panelRect.right) < 2,
      routeOnMap: route.className.includes('market-map-route'),
      height: Math.round(map.getBoundingClientRect().height),
    }
  })
  check('mapa a todo el panel', Boolean(embed?.fullBleed), JSON.stringify(embed))
  check('ruta superpuesta', Boolean(embed?.routeOnMap))
  check('mapa más alto', (embed?.height ?? 0) >= 380, String(embed?.height))
  await page.waitForSelector('.market-map-pin', { timeout: 25000 })
  check('pin gota', Boolean(await page.$('.market-map-pin i')))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/pedidos-map-ui.png', fullPage: true })
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
console.log('\nOK mapa y whatsapp ui')
