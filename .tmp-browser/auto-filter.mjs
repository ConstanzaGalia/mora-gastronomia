import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  await page.goto('http://localhost:3002/reportes?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const before = await page.$eval('body', (el) => [...el.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Ver'))
  const value = await page.$eval('select[name="empresa"] option:nth-child(2)', (el) => el.value)
  await Promise.all([
    page.waitForFunction(() => document.querySelector('h1')?.textContent?.includes('Estudio Ledesma')),
    page.select('select[name="empresa"]', value),
  ])
  const title = await page.$eval('h1', (el) => el.textContent.trim())
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const comensalesVer = await page.$eval('body', (el) => [...el.querySelectorAll('button')].some((button) => button.textContent.trim() === 'Ver'))
  const other = await page.$eval('select[name="empresa"] option:nth-child(2)', (el) => el.value)
  await Promise.all([
    page.waitForFunction(() => location.search.includes('empresa=') && document.querySelector('h1')?.textContent?.trim() === 'Grupo Horizonte'),
    page.select('select[name="empresa"]', other),
  ])
  const company = await page.$eval('h1', (el) => el.textContent.trim())
  console.log(JSON.stringify({ before, title, comensalesVer, company, url: page.url() }))
  if (before || title !== 'Estudio Ledesma' || comensalesVer || !page.url().includes('empresa=')) throw new Error('auto filter failed')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
