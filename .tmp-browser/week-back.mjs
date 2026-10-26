import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/calendario/9735021c-3781-43d0-9a18-20dd3823dfe3', { waitUntil: 'networkidle0' })
const onWeek = await page.evaluate(() => ({
  path: location.pathname,
  back: document.querySelector('.header-actions a.outline-button')?.textContent?.trim() ?? null,
  href: document.querySelector('.header-actions a.outline-button')?.getAttribute('href') ?? null,
}))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/week-back.png' })
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('.header-actions a.outline-button'),
])
const after = await page.evaluate(() => ({
  path: location.pathname,
  title: document.querySelector('.welcome-row h1')?.textContent?.trim() ?? '',
}))
await page.setViewport({ width: 390, height: 844 })
await page.goto('http://localhost:3000/calendario/9735021c-3781-43d0-9a18-20dd3823dfe3', { waitUntil: 'networkidle0' })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/week-back-mobile.png' })
console.log(JSON.stringify({ onWeek, after }, null, 2))
await browser.close()
