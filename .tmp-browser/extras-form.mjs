import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'ledesma.encargado@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/elecciones?fecha=2026-10-27', { waitUntil: 'networkidle0' })
await page.waitForSelector('.extras-form')
const before = await page.evaluate(() => ({
  groups: [...document.querySelectorAll('.extras-group')].map((group) => ({
    name: group.querySelector('h3')?.textContent?.trim() ?? '',
    rows: [...group.querySelectorAll('.extras-row')].map((row) => ({
      option: row.querySelector('span')?.textContent?.trim() ?? '',
      qty: row.querySelector('input[name="quantity"]')?.value ?? '',
    })),
  })),
  fieldsets: document.querySelectorAll('.extras-form fieldset').length,
}))
const polloPlus = await page.$('.extras-row')
await polloPlus.evaluate((row) => {
  const plus = [...row.querySelectorAll('button')].find((button) => button.getAttribute('aria-label') === 'Sumar')
  plus?.click()
  plus?.click()
})
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/extras-form.png', fullPage: true })
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('.extras-form button[type="submit"]'),
])
const saved = await page.evaluate(() => {
  const first = document.querySelector('.extras-row input[name="quantity"]')
  return { qty: first?.value ?? '', error: document.querySelector('.error-banner')?.textContent?.trim() ?? null }
})
await page.setViewport({ width: 390, height: 844 })
await page.goto('http://localhost:3000/elecciones?fecha=2026-10-27', { waitUntil: 'networkidle0' })
await page.waitForSelector('.extras-form')
await page.evaluate(() => document.querySelector('.extras-form')?.scrollIntoView())
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/extras-form-mobile.png' })
console.log(JSON.stringify({ before, saved }, null, 2))
await browser.close()
