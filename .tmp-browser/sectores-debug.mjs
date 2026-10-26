import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
await page.waitForSelector('input[name="email"]')
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
  page.click('button[type="submit"]'),
])
await page.goto('http://localhost:3000/empresas/38f3ff23-e991-4534-8d10-15a40aa4f324', { waitUntil: 'networkidle0', timeout: 60000 })
const headings = await page.$$eval('h2', (els) => els.map((el) => el.textContent))
const text = await page.evaluate(() => document.body.innerText)
console.log('H2s', headings)
console.log('HAS_SECTORES', text.includes('Sectores'))
console.log('TEXT_SNIP', text.slice(0, 1800))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/sectores-debug.png', fullPage: true })
await browser.close()
