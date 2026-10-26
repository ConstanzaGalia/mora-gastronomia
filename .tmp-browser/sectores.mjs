import puppeteer from 'puppeteer-core'

const failures = []
function check(name, ok, detail = '') {
  const line = `${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

const LEDESMA = '38f3ff23-e991-4534-8d10-15a40aa4f324'
const HORIZONTE = '1c8a45b5-79fe-4615-87d3-aaf82d168739'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('input[name="email"]')
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.click('button.login-submit'),
  ])
  await page.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 60000 })

  await page.goto(`http://localhost:3000/empresas/${LEDESMA}`, { waitUntil: 'networkidle0', timeout: 60000 })
  await page.waitForFunction(() => document.body.innerText.includes('Sectores') && document.body.innerText.includes('Personas'), { timeout: 30000 })
  check('ficha ledesma', await page.$eval('h1', (el) => el.textContent.includes('Ledesma')), await page.$eval('h1', (el) => el.textContent.trim()))
  check('panel sectores', await page.$eval('body', (el) => el.innerText.includes('Si la empresa tiene sectores')))

  async function addSector(name) {
    await page.$eval('input[placeholder="Administración, Planta…"]', (el, value) => {
      el.value = value
    }, name)
    await page.evaluate((value) => {
      const input = document.querySelector('input[placeholder="Administración, Planta…"]')
      const form = input?.closest('form')
      if (input) input.value = value
      form?.requestSubmit()
    }, name)
    await page.waitForFunction((label) => [...document.querySelectorAll('.option-row span')].some((el) => el.textContent.trim() === label), { timeout: 15000 }, name)
  }
  await addSector('Administración')
  await addSector('Planta')
  const sectorText = await page.$eval('body', (el) => el.innerText)
  check('sectores creados', sectorText.includes('Administración') && sectorText.includes('Planta'))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/sectores-ficha.png', fullPage: true })

  await page.click('button[aria-label="Editar"]')
  await page.waitForSelector('dialog[open] select[name="sector_id"]')
  await page.select('dialog[open] select[name="sector_id"]', await page.$eval('dialog[open] select[name="sector_id"] option:nth-child(2)', (el) => el.value))
  await page.click('dialog[open] button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 15000 })
  const table = await page.$eval('table', (el) => el.innerText)
  check('empleado con sector en ficha', table.includes('Administración') || table.includes('Planta'), table.slice(0, 500))

  await page.goto(`http://localhost:3000/comensales?empresa=${LEDESMA}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.body.innerText.includes('Agrupado por sector') || document.body.innerText.includes('Ordenado por apellido'), { timeout: 30000 })
  const comensales = await page.$eval('body', (el) => el.innerText)
  check('comensales agrupados', comensales.includes('Agrupado por sector') && /Administraci[oó]n|Planta|Sin sector/i.test(comensales), comensales.slice(400, 1600))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/sectores-comensales.png', fullPage: true })

  await page.goto(`http://localhost:3000/comensales?empresa=${HORIZONTE}`, { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForFunction(() => document.body.innerText.includes('Ordenado por apellido') || document.body.innerText.includes('Agrupado por sector'), { timeout: 30000 })
  const horizonte = await page.$eval('body', (el) => el.innerText)
  check('horizonte sigue plano', horizonte.includes('Ordenado por apellido') && !horizonte.includes('Agrupado por sector'))
  check('horizonte sin filas de sector', !(await page.$('.diner-sector-row')))
} catch (error) {
  console.error(error)
  failures.push(String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} fallos`)
  process.exit(1)
}
console.log('\nOK sectores')
