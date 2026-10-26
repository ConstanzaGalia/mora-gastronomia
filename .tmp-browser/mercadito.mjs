import puppeteer from 'puppeteer-core'

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

try {
  const admin = await browser.newPage()
  await admin.setViewport({ width: 1440, height: 900 })
  await admin.goto('http://localhost:3000/login', { waitUntil: 'networkidle0', timeout: 60000 })
  await admin.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await admin.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([admin.waitForNavigation({ waitUntil: 'networkidle0' }), admin.click('button[type="submit"]')])
  const nav = await admin.$$eval('.nav-item span', (els) => els.map((el) => el.textContent.trim()))
  check('maría ve pedidos', nav.includes('Pedidos'), nav.join(', '))
  await admin.goto('http://localhost:3000/pedidos', { waitUntil: 'networkidle0' })
  check('pedidos carga', admin.url().includes('/pedidos'), admin.url())
  const settingsBtn = await admin.evaluateHandle(() => [...document.querySelectorAll('button')].find((el) => el.textContent.includes('Datos y transferencia')))
  await settingsBtn.asElement().click()
  await admin.waitForSelector('dialog[open] input[name="unit_price"]')
  const buttons = await admin.$$eval('dialog[open] button', (els) => els.map((el) => el.textContent.trim()))
  check('dialog de datos', buttons.includes('Guardar'), buttons.join(', '))
  await admin.$eval('dialog[open]', (dialog) => {
    const set = (name, value) => {
      const input = dialog.querySelector(`[name="${name}"]`)
      if (input) input.value = value
    }
    set('unit_price', '8500')
    set('transfer_holder', 'Mora Gastronomía')
    set('transfer_bank', 'Mercado Pago')
    set('transfer_alias', 'mora.gastro')
    set('transfer_cbu', '0000003100000000000001')
  })
  await Promise.all([
    admin.waitForNavigation({ waitUntil: 'networkidle0' }),
    admin.click('dialog[open] button[type="submit"]'),
  ])
  check('guardó datos', admin.url().includes('/pedidos') && !admin.url().includes('error='), admin.url())
  await admin.waitForFunction(() => document.body.innerText.includes('mora.gastro') || !document.body.innerText.includes('Faltan alias'))
  await shot(admin, 'mercadito-pedidos')

  const publicContext = await browser.createBrowserContext()
  const publicPage = await publicContext.newPage()
  await publicPage.setViewport({ width: 390, height: 844 })
  await publicPage.goto('http://localhost:3000/mercadito', { waitUntil: 'networkidle0', timeout: 60000 })
  check('mercadito público', publicPage.url().includes('/mercadito') && !publicPage.url().includes('/login'), publicPage.url())
  const title = await publicPage.$eval('h1', (el) => el.textContent.trim())
  check('muestra el menú del día', /Menú de (hoy|mañana)/.test(title), title)
  const options = await publicPage.$$eval('.market-group .extras-row span', (els) => els.map((el) => el.textContent.trim()))
  check('hay opciones publicadas', options.length > 0, options.join(', '))
  await publicPage.click('.extras-stepper button[aria-label^="Sumar"]')
  await publicPage.click('.extras-stepper button[aria-label^="Sumar"]')
  await publicPage.type('input[name="customer_name"]', 'Ana Pérez')
  await publicPage.type('input[name="phone"]', '3815551212')
  await publicPage.type('input[name="address"]', 'San Martín 450, San Miguel de Tucumán')
  await publicPage.click('input[value="TRANSFERENCIA"]')
  await publicPage.waitForSelector('.market-transfer')
  const transfer = await publicPage.$eval('.market-transfer', (el) => el.textContent)
  check('muestra alias', transfer.includes('mora.gastro'), transfer)
  check('muestra CBU', transfer.includes('0000003100000000000001'), transfer)
  await shot(publicPage, 'mercadito-form-mobile')
  await publicPage.setViewport({ width: 1280, height: 900 })
  await shot(publicPage, 'mercadito-form')
  await Promise.all([
    publicPage.waitForNavigation({ waitUntil: 'networkidle0' }),
    publicPage.click('.market-bar-bottom button[type="submit"]'),
  ])
  check('gracias', /\/mercadito\/pedido\//.test(publicPage.url()), publicPage.url())
  const thanks = await publicPage.$eval('h1', (el) => el.textContent.trim())
  check('gracias a Ana', thanks.includes('Ana'), thanks)
  const wa = await publicPage.$eval('a.market-whatsapp', (el) => ({ href: el.getAttribute('href'), text: el.textContent.trim() }))
  check('whatsapp comprobante', wa.href.includes('wa.me/5493813201368') && wa.href.includes('comprobante') && wa.text.includes('comprobante'), decodeURIComponent(wa.href))
  check('whatsapp trae el pedido', decodeURIComponent(wa.href).includes('Ana Pérez') && decodeURIComponent(wa.href).includes('San Martín 450'), decodeURIComponent(wa.href))
  await shot(publicPage, 'mercadito-gracias')

  await admin.goto('http://localhost:3000/pedidos', { waitUntil: 'networkidle0' })
  await admin.waitForFunction(() => document.querySelector('h1')?.textContent.includes('Pedidos'))
  const body = await admin.$eval('body', (el) => el.innerText)
  check('pedido en el dashboard', body.includes('Ana Pérez') && body.includes('San Martín 450'), body.slice(0, 1200))
  await shot(admin, 'mercadito-pedido-nuevo')

  await publicPage.setViewport({ width: 1280, height: 900 })
  await publicPage.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
  const landing = await publicPage.$eval('body', (el) => el.innerText)
  check('landing tiene mercadito', landing.includes('Mercadito'), landing.slice(0, 400))
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
console.log('\nOK mercadito')
