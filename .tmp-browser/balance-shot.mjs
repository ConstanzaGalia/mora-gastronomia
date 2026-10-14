import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1200 })
await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3002/balance?mes=2026-10', { waitUntil: 'networkidle0' })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/balance-desktop.png', fullPage: true })
const layout = await page.evaluate(() => ({
  filters: document.querySelector('.balance-filters')?.innerText.replace(/\s+/g, ' '),
  cards: document.querySelectorAll('.account-card').length,
  priceLabels: [...document.querySelectorAll('.price-form .field')].slice(0, 2).map((el) => el.childNodes[0]?.textContent?.trim()),
  paymentLabels: [...document.querySelectorAll('.ledger-form .field')].slice(0, 4).map((el) => el.childNodes[0]?.textContent?.trim()),
}))
console.log(JSON.stringify(layout))
await browser.close()
