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
await page.goto('http://localhost:3000/calendario/01c8790b-3190-4fb4-b60d-7a94a0207910', { waitUntil: 'networkidle0' })
const info = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.week-grid-panel tbody tr')]
  let category = ''
  const byCategory = {}
  for (const row of rows) {
    if (row.classList.contains('week-grid-category')) {
      category = row.querySelector('.option-col')?.textContent?.trim() ?? ''
      byCategory[category] = []
      continue
    }
    byCategory[category].push({
      name: row.querySelector('.option-col span')?.textContent?.trim() ?? '',
      allDays: !!row.querySelector('.all-days'),
    })
  }
  return byCategory
})
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/week-no-tray-todos.png' })
console.log(JSON.stringify(info, null, 2))
await browser.close()
