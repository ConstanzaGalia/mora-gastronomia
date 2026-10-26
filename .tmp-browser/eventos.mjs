import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
let page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
const failures = []
function check(name, ok, detail = '') {
  const line = `${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

async function login(email, password) {
  const context = await browser.createBrowserContext()
  page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', password)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
}

async function navLabels() {
  return page.$$eval('.nav-item span', (els) => els.map((el) => el.textContent.trim()))
}

await login('maria.gonzalez@balcarce.test', 'Balcarce2026')
check('maría en inicio', page.url().includes('/inicio'), page.url())
const mariaNav = await navLabels()
check('maría ve calendario', mariaNav.includes('Calendario'), mariaNav.join(', '))
check('maría no ve eventos', !mariaNav.includes('Eventos'), mariaNav.join(', '))
const mariaSwitcher = await page.$('select[name="space_id"]')
check('maría sin switcher', !mariaSwitcher)

await page.goto('http://localhost:3000/eventos', { waitUntil: 'networkidle0' })
check('maría no entra a /eventos', !page.url().includes('/eventos'), page.url())

await login('amparo@mora.com', 'Balcarce2026')
if (page.url().includes('/login')) {
  console.log('FAIL amparo login')
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/eventos-amparo-login.png' })
  await browser.close()
  process.exit(1)
}
check('amparo en inicio', page.url().includes('/inicio'), page.url())
const amparoRole = await page.$eval('.profile-mini span', (el) => el.textContent.trim())
check('amparo es administrador mora', amparoRole.includes('Administrador Mora'), amparoRole)
const switcher = await page.$('select[name="space_id"]')
check('amparo tiene switcher', Boolean(switcher))
const options = switcher ? await page.$$eval('select[name="space_id"] option', (els) => els.map((el) => ({ value: el.value, label: el.textContent.trim() }))) : []
check('switcher tiene balcarce y eventos', options.some((o) => o.label === 'Balcarce') && options.some((o) => o.label === 'Eventos'), JSON.stringify(options))

const eventosId = options.find((o) => o.label === 'Eventos')?.value
await page.select('select[name="space_id"]', eventosId)
await page.waitForNavigation({ waitUntil: 'networkidle0' })
const eventosNav = await navLabels()
check('nav de eventos', eventosNav.includes('Eventos') && !eventosNav.includes('Calendario'), eventosNav.join(', '))
check('inicio de eventos', await page.$eval('h1', (el) => el.textContent.includes('Buen día')), await page.$eval('h1', (el) => el.textContent.trim()))

await page.goto('http://localhost:3000/calendario', { waitUntil: 'networkidle0' })
check('calendario en eventos redirige', page.url().includes('/inicio') && !page.url().includes('/calendario'), page.url())

await page.goto('http://localhost:3000/eventos', { waitUntil: 'networkidle0' })
await page.click('button.primary-button')
await page.waitForSelector('dialog[open] input[name="name"]')
await page.type('dialog[open] input[name="name"]', 'Cumpleaños López')
await page.type('dialog[open] input[name="client_name"]', 'Familia López')
await page.click('dialog[open] input[name="quoted_amount"]', { clickCount: 3 })
await page.type('dialog[open] input[name="quoted_amount"]', '100000')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('dialog[open] button[type="submit"]'),
])
check('detalle del evento', /\/eventos\/[0-9a-f-]{36}/.test(page.url()), page.url())

async function addDialog(trigger, fill) {
  const buttons = await page.$$('button')
  for (const button of buttons) {
    const text = await page.evaluate((el) => el.textContent.trim(), button)
    if (text === trigger) {
      await button.click()
      break
    }
  }
  await page.waitForSelector('dialog[open]')
  await fill()
  await page.click('dialog[open] button[type="submit"]')
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 15000 })
  await page.waitForSelector('.event-figures')
}

await addDialog('Agregar ítem', async () => {
  await page.type('dialog[open] input[name="name"]', 'Bandeja principal')
  await page.type('dialog[open] input[name="quantity"]', '20')
  await page.type('dialog[open] input[name="unit_cost"]', '1500')
})
await page.waitForFunction(() => document.body.innerText.includes('Bandeja principal'))
await addDialog('Anotar gasto', async () => {
  await page.type('dialog[open] input[name="concept"]', 'Mozos')
  await page.type('dialog[open] input[name="amount"]', '8000')
})
await page.waitForFunction(() => document.body.innerText.includes('Mozos'))
await addDialog('Anotar cobro', async () => {
  await page.type('dialog[open] input[name="amount"]', '40000')
  await page.type('dialog[open] input[name="note"]', 'Seña')
})
await page.waitForFunction(() => document.body.innerText.includes('Seña'))
await addDialog('Anotar cobro', async () => {
  await page.type('dialog[open] input[name="amount"]', '30000')
  await page.type('dialog[open] input[name="note"]', 'Segundo pago')
})
await page.waitForFunction(() => document.body.innerText.includes('Segundo pago'))
await page.reload({ waitUntil: 'networkidle0' })

const figures = await page.$$eval('.event-figures div', (els) => Object.fromEntries(els.map((el) => {
  const dt = el.querySelector('dt')?.textContent.trim()
  const dd = el.querySelector('dd')?.textContent.replace(/\s+/g, ' ').trim()
  return [dt, dd]
})))
console.log('figures', JSON.stringify(figures))
check('acordado 100000', (figures.Acordado ?? '').includes('100.000'))
check('cobrado 70000', (figures.Cobrado ?? '').includes('70.000'))
check('saldo 30000', (figures.Saldo ?? '').includes('30.000'))
check('costo catering 30000', (figures['Costo catering'] ?? '').includes('30.000'))
check('gastos 8000', (figures.Gastos ?? '').includes('8.000'))
check('margen 62000', (figures.Margen ?? '').includes('62.000'))
check('cobro parcial', (figures.Cobro ?? '').includes('Parcial'))

await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/eventos-detalle.png' })

await page.goto('http://localhost:3000/inicio', { waitUntil: 'networkidle0' })
const summary = await page.$$eval('.stat-card.money', (els) => els.map((el) => ({
  label: el.querySelector('.stat-label')?.textContent.trim(),
  value: el.querySelector('strong')?.textContent.trim(),
})))
console.log('summary', JSON.stringify(summary))
check('resumen acordado', summary.some((s) => s.label === 'Acordado' && s.value.includes('100.000')))
check('resumen cobrado', summary.some((s) => s.label === 'Cobrado' && s.value.includes('70.000')))
check('resumen pendiente', summary.some((s) => s.label === 'Pendiente' && s.value.includes('30.000')))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/eventos-resumen.png' })

const balcarceId = options.find((o) => o.label === 'Balcarce')?.value
await page.select('select[name="space_id"]', balcarceId)
await page.waitForNavigation({ waitUntil: 'networkidle0' })
const backNav = await navLabels()
check('volver a balcarce muestra calendario', backNav.includes('Calendario') && !backNav.includes('Eventos'), backNav.join(', '))
await page.goto('http://localhost:3000/empresas', { waitUntil: 'networkidle0' })
check('empresas de balcarce sigue', page.url().includes('/empresas') && !page.url().includes('/login'), page.url())
const empresas = await page.$$eval('table tbody tr', (rows) => rows.length)
check('hay empresas de viandas', empresas > 0, String(empresas))

await browser.close()
if (failures.length) {
  console.error(`\n${failures.length} fallos`)
  process.exit(1)
}
console.log('done')
