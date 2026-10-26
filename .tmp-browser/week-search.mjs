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
await page.waitForSelector('.week-grid-panel .catalog-search input')
await page.type('.week-grid-panel .catalog-search input', 'pan')
const search = await page.evaluate(() => ({
  names: [...document.querySelectorAll('.week-grid-panel tbody tr:not(.week-grid-category) .option-col span')].map((el) => el.textContent?.trim()),
  categories: [...document.querySelectorAll('.week-grid-panel .week-grid-category .option-col')].map((el) => el.textContent?.trim()),
}))
console.log(JSON.stringify(search, null, 2))
await browser.close()
