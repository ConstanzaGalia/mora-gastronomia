import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const context = await browser.createBrowserContext()
const page = await context.newPage()
await page.setViewport({ width: 1440, height: 1100 })
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
await page.click('.event-row-main')
await page.waitForNavigation({ waitUntil: 'networkidle0' })
const info = await page.evaluate(() => ({
  panels: [...document.querySelectorAll('.panel h2')].map((el) => el.textContent.trim()),
  tables: document.querySelectorAll('table').length,
  ledger: document.querySelectorAll('.event-ledger-item').length,
  summary: [...document.querySelectorAll('.event-summary h2')].map((el) => el.textContent.trim()),
}))
console.log(JSON.stringify(info))
const wrap = await page.$('.content-wrap')
await wrap.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/eventos-detail.png' })
await browser.close()
