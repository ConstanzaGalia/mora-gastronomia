import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })

async function login(email) {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ])
}

async function logout() {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button.logout-button'),
  ])
}

try {
  await login('maria.gonzalez@balcarce.test')
  await page.goto('http://localhost:3002/reportes?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const totalTitle = await page.$eval('h1', (el) => el.textContent.trim())
  const options = await page.$$eval('select[name="empresa"] option', (nodes) => nodes.map((node) => node.textContent.trim()))
  const totalViandas = await page.$eval('h2', (el) => el.parentElement.textContent.trim())
  const breakdown = await page.$eval('body', (el) => el.innerText.includes('Por empresa y opción'))
  const dayLink = await page.$eval('.diner-days a, .diner-date-button', (el) => el.textContent.trim())
  await page.click('.diner-date-button')
  await page.waitForSelector('.diner-month')
  const dayHref = await page.$eval('.diner-days a.is-selected', (el) => el.getAttribute('href'))
  await page.select('select[name="empresa"]', await page.$eval('select[name="empresa"] option:nth-child(2)', (el) => el.value))
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('form.form-row button[type="submit"]'),
  ])
  const companyTitle = await page.$eval('h1', (el) => el.textContent.trim())
  const companyViandas = await page.$eval('h2', (el) => el.parentElement.textContent.trim())
  const companyBreakdown = await page.$eval('body', (el) => el.innerText.includes('Por empresa y opción'))
  const companyUrl = page.url()
  await logout()

  await login('ledesma.encargado@balcarce.test')
  await page.goto('http://localhost:3002/reportes?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const encargado = {
    title: await page.$eval('h1', (el) => el.textContent.trim()),
    filter: await page.$('select[name="empresa"]'),
    breakdown: await page.$eval('body', (el) => el.innerText.includes('Por empresa y opción')),
  }
  console.log(JSON.stringify({ totalTitle, options, totalViandas, breakdown, dayLink, dayHref, companyTitle, companyViandas, companyBreakdown, companyUrl, encargado }, null, 2))
  const totalCount = Number(totalViandas.match(/\d+/)?.[0])
  const companyCount = Number(companyViandas.match(/\d+/)?.[0])
  if (totalTitle !== 'Total del día' || !options.includes('Todas') || !options.includes('Estudio Ledesma') || !breakdown || !dayHref?.startsWith('/reportes?fecha=2026-10-09') || companyTitle !== 'Estudio Ledesma' || companyBreakdown || !companyUrl.includes('empresa=') || !(companyCount > 0 && companyCount < totalCount) || encargado.title !== 'Estudio Ledesma' || encargado.filter || encargado.breakdown) {
    throw new Error('report filter check failed')
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
