import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1280, height: 900 })

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  await page.goto('http://localhost:3002/reportes?fecha=2026-10-09&empresa=38f3ff23-e991-4534-8d10-15a40aa4f324', { waitUntil: 'networkidle0' })
  const headers = await page.$$eval('.report-table th', (cells) => cells.map((cell) => cell.textContent.trim()))
  const bandeja = await page.$eval('.category-cell', (cell) => ({ text: cell.textContent.trim(), span: cell.getAttribute('rowspan') }))
  const firstQty = await page.$eval('.report-table td.num', (cell) => getComputedStyle(cell).textAlign)
  const dump = await page.$eval('body', (el) => el.innerText.includes('Por empresa y opción'))
  await page.goto('http://localhost:3002/reportes?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const viandas = await page.$$eval('.report-table-narrow tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim()))
  console.log(JSON.stringify({ headers, bandeja, firstQty, dump, viandas }, null, 2))
  if (headers.join('|') !== 'Categoría|Opción|Cantidad' || bandeja.text !== 'Bandeja' || Number(bandeja.span) < 2 || firstQty !== 'right' || dump || !viandas.some((row) => row.startsWith('Total'))) {
    throw new Error('report table check failed')
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
