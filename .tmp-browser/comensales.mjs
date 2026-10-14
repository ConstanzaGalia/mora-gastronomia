import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})

function compare(a, b) {
  const [aLast, aFirst] = a.split(', ')
  const [bLast, bFirst] = b.split(', ')
  const last = aLast.localeCompare(bLast, 'es')
  if (last !== 0) return last
  return (aFirst ?? '').localeCompare(bFirst ?? '', 'es')
}

async function login(page, email) {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.evaluate(() => { document.querySelector('input[name="email"]').value = '' })
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ])
}

async function logout(page) {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button.logout-button'),
  ])
}

async function rows(page) {
  return page.$$eval('table tbody tr', (trs) => trs.map((tr) => [...tr.querySelectorAll('td')].map((td) => td.textContent.trim())))
}

const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })

const report = {}
try {
  await login(page, 'ledesma.encargado@balcarce.test')
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const ledesma = await rows(page)
  const ledesmaNames = ledesma.map((row) => row[0])
  const ledesmaMenu = Object.fromEntries(ledesma)
  report.ledesma = {
    count: ledesma.length,
    sorted: ledesmaNames.join('|') === [...ledesmaNames].sort(compare).join('|'),
    anaBeforeBruno: ledesmaNames.indexOf('Álvarez, Ana') < ledesmaNames.indexOf('Álvarez, Bruno'),
    lopez: ledesmaMenu['López, Diego'],
    perez: ledesmaMenu['Pérez, Facundo'],
    anaMenu: ledesmaMenu['Álvarez, Ana'],
    hasNunez: ledesmaNames.includes('Núñez, Elena'),
    hasNonio: ledesmaNames.includes('Ñoño, Luis'),
    export: await page.$('a[href*="/comensales/imprimir"]'),
    nav: await page.$eval('a[href="/comensales"]', (el) => el.textContent.trim()),
  }
  await page.goto('http://localhost:3002/comensales/imprimir?fecha=2026-10-09&empresa=00000000-0000-0000-0000-000000000000', { waitUntil: 'networkidle0' })
  report.encargadoPrintBlocked = !page.url().includes('/imprimir')
  await logout(page)

  await login(page, 'horizonte.encargado@balcarce.test')
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const horizonte = await rows(page)
  const horizonteNames = horizonte.map((row) => row[0])
  const horizonteMenu = Object.fromEntries(horizonte)
  report.horizonte = {
    count: horizonte.length,
    sorted: horizonteNames.join('|') === [...horizonteNames].sort(compare).join('|'),
    acostaBeforeBenitez: horizonteNames.indexOf('Acosta, Bruno') < horizonteNames.indexOf('Benítez, Camila'),
    castro: horizonteMenu['Castro, Diego'],
    export: await page.$('a[href*="/comensales/imprimir"]'),
  }
  await logout(page)

  await login(page, 'maria.gonzalez@balcarce.test')
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const companies = await page.$$eval('select[name="empresa"] option', (options) => options.map((option) => option.textContent.trim()))
  const href = await page.$eval('a[href*="/comensales/imprimir"]', (el) => el.getAttribute('href'))
  await page.goto('http://localhost:3002' + href, { waitUntil: 'networkidle0' })
  await new Promise((resolve) => setTimeout(resolve, 700))
  const printed = await page.evaluate(() => window.__printed === true)
  const sheet = await page.$eval('.diner-sheet', (el) => el.innerText)
  await page.emulateMediaType('print')
  const sidebar = await page.$eval('.sidebar', (el) => getComputedStyle(el).display)
  const toolbar = await page.$eval('.diner-toolbar', (el) => getComputedStyle(el).display)
  report.mora = {
    companies,
    href,
    printed,
    sidebar,
    toolbar,
    hasMora: sheet.includes('Mora'),
    hasCompany: sheet.includes('Estudio Ledesma'),
    hasDate: sheet.toLowerCase().includes('octubre'),
    hasAna: sheet.includes('Álvarez, Ana'),
  }
  console.log(JSON.stringify(report, null, 2))
  const ok = report.ledesma.count >= 8
    && report.ledesma.sorted
    && report.ledesma.anaBeforeBruno
    && report.ledesma.lopez === 'No eligió'
    && report.ledesma.perez === 'No eligió'
    && report.ledesma.anaMenu.includes('Bandeja: Milanesa con puré')
    && report.ledesma.anaMenu.includes('Postre: Flan')
    && report.ledesma.anaMenu.includes('Bebida: Agua')
    && report.ledesma.hasNunez
    && report.ledesma.hasNonio
    && report.ledesma.export === null
    && report.encargadoPrintBlocked
    && report.horizonte.sorted
    && report.horizonte.acostaBeforeBenitez
    && report.horizonte.castro === 'No eligió'
    && report.horizonte.export === null
    && report.mora.companies.includes('Estudio Ledesma')
    && report.mora.companies.includes('Grupo Horizonte')
    && report.mora.printed
    && report.mora.sidebar === 'none'
    && report.mora.toolbar === 'none'
    && report.mora.hasMora
    && report.mora.hasCompany
    && report.mora.hasDate
    && report.mora.hasAna
  if (!ok) throw new Error('comensales check failed')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
