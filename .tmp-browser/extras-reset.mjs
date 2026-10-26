import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'ledesma.encargado@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/elecciones?fecha=2026-10-27', { waitUntil: 'networkidle0' })
await page.waitForSelector('.extras-form')
await page.evaluate(() => document.querySelector('.extras-form')?.scrollIntoView({ block: 'start' }))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/extras-desktop.png' })
await page.evaluate(() => {
  const input = document.querySelector('.extras-row input[name="quantity"]')
  const minus = document.querySelector('.extras-row button[aria-label="Restar"]')
  if (input) {
    input.value = '0'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.dispatchEvent(new Event('change', { bubbles: true }))
  }
  minus?.click()
  minus?.click()
})
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('.extras-form button[type="submit"]'),
])
const qty = await page.$eval('.extras-row input[name="quantity"]', (input) => input.value)
console.log(JSON.stringify({ qty }))
await browser.close()
