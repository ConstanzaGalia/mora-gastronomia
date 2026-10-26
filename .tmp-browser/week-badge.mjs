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
const info = await page.evaluate(() => {
  const badge = document.querySelector('.title-row .status-badge')
  const panel = document.querySelector('.week-grid-panel')
  const stray = [...document.querySelectorAll('.status-badge')].filter((el) => !el.closest('.title-row') && !el.closest('.welcome-row'))
  return {
    badge: badge?.textContent?.trim() ?? null,
    inHeader: !!badge?.closest('.welcome-row'),
    onCard: !!panel?.querySelector('.status-badge'),
    stray: stray.map((el) => el.textContent?.trim()),
  }
})
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/week-badge.png' })
console.log(JSON.stringify(info, null, 2))
await browser.close()
