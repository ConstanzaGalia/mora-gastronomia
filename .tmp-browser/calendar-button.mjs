import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ])
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09&empresa=38f3ff23-e991-4534-8d10-15a40aa4f324', { waitUntil: 'networkidle0' })
  const closed = await page.$('.diner-month')
  const label = await page.$eval('.diner-date-button', (el) => el.textContent.trim())
  await page.click('.diner-date-button')
  await page.waitForSelector('.diner-month')
  const month = await page.$eval('.diner-month-nav span', (el) => el.textContent.trim())
  await page.click('button[aria-label="Mes siguiente"]')
  const nextMonth = await page.$eval('.diner-month-nav span', (el) => el.textContent.trim())
  const stayed = page.url()
  await Promise.all([
    page.waitForFunction(() => location.search.includes('fecha=2026-11-03')),
    page.click('.diner-days a[href*="fecha=2026-11-03"]'),
  ])
  const after = page.url()
  const closedAgain = await page.$('.diner-month')
  const tableTop = await page.$eval('table', (el) => el.getBoundingClientRect().top)
  console.log(JSON.stringify({ closed: closed === null, label, month, nextMonth, stayed, after, closedAgain: closedAgain === null, tableTop }))
  if (closed !== null || !label.startsWith('Viernes, 9 de octubre') || month !== 'Octubre de 2026' || nextMonth !== 'Noviembre de 2026' || !stayed.includes('fecha=2026-10-09') || !after.includes('fecha=2026-11-03') || closedAgain !== null || tableTop > 700) {
    throw new Error('calendar button check failed')
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
