import puppeteer from './node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const failures = []
function check(name, ok, detail = '') {
  const line = `${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

async function shot(page, name) {
  await page.screenshot({
    path: `/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/${name}.png`,
    fullPage: true,
  })
}

async function login(context, email, password) {
  const page = await context.newPage()
  await page.setViewport({ width: 1440, height: 900 })
  await page.goto('http://localhost:3000/login', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('input[name="email"]')
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', password)
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.click('button.login-submit'),
  ])
  await page.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 60000 })
  return page
}

async function navLabels(page) {
  return page.$$eval('.nav-item span', (els) => els.map((el) => el.textContent.trim()))
}

async function waitText(page, text) {
  await page.waitForFunction((value) => document.body.innerText.includes(value), { timeout: 30000 }, text)
}

try {
  const mariaContext = await browser.createBrowserContext()
  const maria = await login(mariaContext, 'maria.gonzalez@balcarce.test', 'Balcarce2026')
  const mariaNav = await navLabels(maria)
  check('maría no ve Pedidos', !mariaNav.includes('Pedidos'), mariaNav.join(', '))
  await maria.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await maria.waitForFunction(() => !location.pathname.includes('/pedidos'), { timeout: 15000 })
  check('maría /pedidos va a inicio', maria.url().includes('/inicio') && !maria.url().includes('/pedidos'), maria.url())
  await shot(maria, 'pedidos-maria')

  const amparoContext = await browser.createBrowserContext()
  const amparo = await login(amparoContext, 'amparo@mora.com', 'Balcarce2026')
  const switcher = await amparo.$('select[name="space_id"]')
  if (switcher) {
    const options = await amparo.$$eval('select[name="space_id"] option', (els) => els.map((el) => ({ value: el.value, label: el.textContent.trim(), selected: el.selected })))
    const balcarce = options.find((item) => item.label === 'Balcarce')
    const current = options.find((item) => item.selected)
    if (balcarce && current?.label !== 'Balcarce') {
      await Promise.all([
        amparo.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
        amparo.select('select[name="space_id"]', balcarce.value),
      ])
      await amparo.waitForFunction(() => location.pathname.includes('/inicio'), { timeout: 30000 })
    }
  }
  const amparoNav = await navLabels(amparo)
  check('amparo ve Pedidos', amparoNav.includes('Pedidos'), amparoNav.join(', '))
  await amparo.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await waitText(amparo, 'Control de pedidos y plata')
  const dayText = await amparo.evaluate(() => document.body.innerText)
  check('cards de resumen', ['Pedidos', 'Viandas', 'Total', 'Efectivo', 'Transferencia'].every((label) => dayText.includes(label)))
  check('desglose de cocina', dayText.includes('Para producir'))
  check('datos y transferencia', dayText.includes('Datos y transferencia'))
  await shot(amparo, 'pedidos-amparo-dia')

  await amparo.select('select[name="vista"]', 'mes')
  await amparo.waitForFunction(() => location.search.includes('vista=mes'), { timeout: 15000 })
  await waitText(amparo, 'Pedidos del mes')
  const monthText = await amparo.evaluate(() => document.body.innerText)
  check('mes sin cocina', !monthText.includes('Para producir'))
  check('mes con cards', monthText.includes('plata del mercadito del mes'))
  await shot(amparo, 'pedidos-amparo-mes')

  const publicContext = await browser.createBrowserContext()
  const publicPage = await publicContext.newPage()
  await publicPage.setViewport({ width: 390, height: 844 })
  await publicPage.goto('http://localhost:3000/mercadito', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await publicPage.waitForSelector('h1', { timeout: 30000 })
  const publicTitle = await publicPage.$eval('h1', (el) => el.textContent.trim())
  check('mercadito público', publicPage.url().includes('/mercadito') && !publicPage.url().includes('/login'), publicPage.url())
  check('menú público', /Menú de (hoy|mañana)|no hay menú|no estamos tomando/i.test(publicTitle) || publicTitle.length > 0, publicTitle)
  const canOrder = await publicPage.$('.extras-stepper button[aria-label^="Sumar"]')
  if (canOrder) {
    await publicPage.click('.extras-stepper button[aria-label^="Sumar"]')
    await publicPage.type('input[name="customer_name"]', 'QA Mercadito Admin')
    await publicPage.type('input[name="phone"]', '3815559999')
    await publicPage.type('input[name="address"]', 'San Martín 100, San Miguel de Tucumán')
    await publicPage.click('input[value="EFECTIVO"]')
    await Promise.all([
      publicPage.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
      publicPage.click('button[type="submit"]'),
    ])
    check('pedido público', publicPage.url().includes('/mercadito/pedido/'), publicPage.url())
    await amparo.goto('http://localhost:3000/pedidos', { waitUntil: 'domcontentloaded', timeout: 60000 })
    await waitText(amparo, 'QA Mercadito Admin')
    const afterOrder = await amparo.evaluate(() => document.body.innerText)
    check('pedido en admin', afterOrder.includes('QA Mercadito Admin'))
    check('cocina con cantidad', /Para producir[\s\S]*\n.*\n.*\d/.test(afterOrder) || afterOrder.includes('Para producir'))
    const cancel = await amparo.evaluateHandle(() => {
      const row = [...document.querySelectorAll('.market-order')].find((el) => el.textContent.includes('QA Mercadito Admin'))
      return row ? [...row.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Cancelar') : null
    })
    if (cancel.asElement()) {
      await Promise.all([
        amparo.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }).catch(() => null),
        cancel.asElement().click(),
      ])
      await waitText(amparo, 'Cancelado')
      const cancelled = await amparo.evaluate(() => {
        const row = [...document.querySelectorAll('.market-order')].find((el) => el.textContent.includes('QA Mercadito Admin'))
        return {
          cancelled: Boolean(row?.classList.contains('is-cancelled')),
          cards: [...document.querySelectorAll('.stat-card.money')].map((card) => card.innerText.replace(/\s+/g, ' ')),
        }
      })
      check('cancelado tachado', cancelled.cancelled)
      check('cancelado no suma', cancelled.cards.some((card) => card.includes('cancelado') && card.includes('no suman')), cancelled.cards.join(' | '))
    } else {
      check('botón cancelar', false)
    }
    await shot(amparo, 'pedidos-amparo-cancelado')
  } else {
    console.log('SKIP pedido público — no hay menú para pedir')
  }
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
console.log('\nOK pedidos admin')
