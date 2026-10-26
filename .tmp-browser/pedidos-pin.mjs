import puppeteer from './node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})

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
  await page.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.leaflet-container', { timeout: 20000 })
  await page.waitForFunction(() => document.querySelectorAll('.leaflet-tile-loaded').length > 4, { timeout: 20000 })
  await page.waitForSelector('.market-map-mark svg', { timeout: 25000 })
  await new Promise((r) => setTimeout(r, 800))
  const pin = await page.$eval('.market-map-mark', (el) => ({
    hasSvg: Boolean(el.querySelector('svg')),
    paths: el.querySelectorAll('path').length,
  }))
  console.log(JSON.stringify(pin))
  const map = await page.$('.market-map-panel')
  await map.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/pedidos-pin.png' })
} finally {
  await browser.close()
}
