import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const context = await browser.createBrowserContext()
const page = await context.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'amparo@mora.com')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])

const options = await page.$$eval('select[name="space_id"] option', (els) => els.map((el) => ({ value: el.value, label: el.textContent.trim() })))
const eventosId = options.find((o) => o.label === 'Eventos')?.value
if (eventosId) {
  const current = await page.$eval('select[name="space_id"]', (el) => el.value)
  if (current !== eventosId) {
    await page.select('select[name="space_id"]', eventosId)
    await page.waitForNavigation({ waitUntil: 'networkidle0' })
  }
}

await page.goto('http://localhost:3000/eventos', { waitUntil: 'networkidle0' })
const info = await page.evaluate(() => ({
  title: document.querySelector('h1')?.textContent.trim(),
  description: document.querySelector('.welcome-row .muted')?.textContent.trim(),
  cards: [...document.querySelectorAll('.event-row')].map((row) => ({
    name: row.querySelector('.event-identity strong')?.textContent.trim(),
    client: row.querySelector('.event-client')?.textContent.trim(),
    money: row.querySelector('.event-money strong')?.textContent.trim(),
    paid: row.querySelector('.event-money small')?.textContent.trim(),
    badges: [...row.querySelectorAll('.status-badge')].map((el) => el.textContent.trim()),
  })),
  table: Boolean(document.querySelector('table')),
}))
console.log(JSON.stringify(info, null, 2))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/eventos-list.png', fullPage: false })
await page.click('.event-row-main')
await page.waitForNavigation({ waitUntil: 'networkidle0' })
console.log('opened', page.url())

await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 })
await page.reload({ waitUntil: 'networkidle0' })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/eventos-list-mobile.png', clip: { x: 0, y: 0, width: 390, height: 520 } })

await browser.close()
