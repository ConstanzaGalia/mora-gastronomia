import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const env = Object.fromEntries(
  readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((line) => line && !line.startsWith('#'))
    .map((line) => {
      const index = line.indexOf('=')
      return [line.slice(0, index), line.slice(index + 1)]
    }),
)

function setPostre(active) {
  const sql = `
    update public.company_gastronomic_categories cgc
    set active = ${active}
    from public.companies co, public.gastronomic_categories cat
    where cgc.company_id = co.id
      and cgc.category_id = cat.id
      and co.nombre_comercial = 'Grupo Horizonte'
      and cat.slug = 'postre';
  `
  const result = spawnSync('psql', [env.DATABASE_URL, '-v', 'ON_ERROR_STOP=1', '-c', sql], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'no se pudo actualizar postre')
}

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => { window.print = () => { window.__printed = true } })

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
  await login('ledesma.encargado@balcarce.test')
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const headers = await page.$$eval('table thead th', (cells) => cells.map((cell) => cell.textContent.trim()))
  const ana = await page.$$eval('table tbody tr', (rows) => {
    const row = rows.find((item) => item.querySelector('td')?.textContent?.includes('Álvarez, Ana'))
    return row ? [...row.querySelectorAll('td')].map((cell) => cell.textContent.trim()) : null
  })
  const lopez = await page.$$eval('table tbody tr', (rows) => {
    const row = rows.find((item) => item.querySelector('td')?.textContent?.includes('López, Diego'))
    return row ? [...row.querySelectorAll('td')].slice(1).map((cell) => cell.textContent.trim()) : null
  })
  const selected = await page.$eval('.diner-days a.is-selected', (el) => el.textContent.trim())
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('a[aria-label="Día siguiente"]'),
  ])
  const nextUrl = page.url()
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('.diner-days a[href*="fecha=2026-10-08"]'),
  ])
  const dayUrl = page.url()
  await logout()

  setPostre('false')
  await login('horizonte.encargado@balcarce.test')
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const horizonteHeaders = await page.$$eval('table thead th', (cells) => cells.map((cell) => cell.textContent.trim()))
  await logout()
  setPostre('true')

  await login('maria.gonzalez@balcarce.test')
  await page.goto('http://localhost:3002/comensales?fecha=2026-10-09', { waitUntil: 'networkidle0' })
  const href = await page.$eval('a[href*="/comensales/imprimir"]', (el) => el.getAttribute('href'))
  await page.goto('http://localhost:3002' + href, { waitUntil: 'networkidle0' })
  await new Promise((resolve) => setTimeout(resolve, 500))
  const sheet = await page.$eval('.diner-sheet', (el) => el.innerText)
  await page.emulateMediaType('print')
  const calendarDisplay = await page.$eval('.diner-calendar', (el) => getComputedStyle(el).display).catch(() => 'absent')
  const sidebar = await page.$eval('.sidebar', (el) => getComputedStyle(el).display)

  const report = { headers, ana, lopez, selected, nextUrl, dayUrl, horizonteHeaders, sheetIncludes: sheet.includes('Bandeja') && sheet.includes('Milanesa con puré') && !sheet.includes('Bandeja:'), calendarDisplay, sidebar }
  console.log(JSON.stringify(report, null, 2))
  const ok = headers.join('|') === 'EMPLEADO|Bandeja|Postre|Bebida|Pan'
    && ana?.[1] === 'Milanesa con puré'
    && ana?.[2] === 'Flan'
    && ana?.[3] === 'Agua'
    && ana?.[4] === '—'
    && lopez?.every((cell) => cell === '—')
    && selected === '9'
    && nextUrl.includes('fecha=2026-10-10')
    && dayUrl.includes('fecha=2026-10-08')
    && horizonteHeaders.includes('Bandeja')
    && horizonteHeaders.includes('Bebida')
    && horizonteHeaders.includes('Pan')
    && !horizonteHeaders.includes('Postre')
    && report.sheetIncludes
    && sidebar === 'none'
  if (!ok) throw new Error('column check failed')
} catch (error) {
  setPostre('true')
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
