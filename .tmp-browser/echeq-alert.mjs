import puppeteer from '/private/tmp/echeq-verify/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(25000)
page.on('dialog', (dialog) => dialog.accept())
await page.setViewport({ width: 1280, height: 900 })

async function fill(name, value) {
  await page.$eval(`input[name="${name}"]`, (input, next) => { input.value = next }, value)
}

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])

  await page.goto('http://localhost:3002/balance?mes=2026-10&seccion=proveedores', { waitUntil: 'networkidle0' })
  await fill('name', 'Proveedor eCheq prueba')
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('Proveedor eCheq prueba')),
    page.$eval('input[name="name"]', (input) => input.closest('form').querySelector('button[type="submit"]').click()),
  ])

  await page.goto('http://localhost:3002/balance?mes=2026-10&seccion=echeqs', { waitUntil: 'networkidle0' })
  const tabs = await page.$$eval('.balance-tabs a', (links) => links.map((link) => link.textContent.trim()))
  if (!tabs.includes('eCheqs')) throw new Error(`tabs ${tabs.join('|')}`)
  const heading = await page.$eval('h2', (node) => node.textContent.trim())
  if (heading !== 'eCheqs emitidos') throw new Error(`heading ${heading}`)

  const supplierId = await page.$eval('select[name="supplier_id"]', (select) => [...select.options].find((option) => option.textContent.includes('Proveedor eCheq prueba'))?.value ?? '')
  async function emit(number, due, concept) {
    await page.select('select[name="supplier_id"]', supplierId)
    await fill('paid_on', '2026-10-12')
    await fill('concept', concept)
    await fill('amount', '100')
    await fill('echeq_number', number)
    await fill('echeq_date', due)
    await Promise.all([
      page.waitForFunction((value) => document.body.innerText.includes(value), {}, number),
      page.$eval('input[name="echeq_number"]', (input) => input.closest('form').querySelector('button[type="submit"]').click()),
    ])
  }
  await emit('111222', '2026-10-15', 'vence pronto')
  await emit('333444', '2026-11-01', 'vence lejos')
  const list = await page.$eval('body', (body) => body.innerText)
  if (!list.includes('Vence en') || !list.includes('333444')) throw new Error('echeq list missing rows')

  await page.goto('http://localhost:3002/inicio', { waitUntil: 'networkidle0' })
  await page.waitForSelector('.echeq-alert')
  const alertText = await page.$eval('.echeq-alert', (node) => node.innerText)
  if (!alertText.includes('111222') || alertText.includes('333444')) throw new Error(`alert ${alertText}`)
  await page.screenshot({ path: '.tmp-browser/echeq-inicio.png' })

  await page.goto('http://localhost:3002/balance?mes=2026-10&seccion=echeqs', { waitUntil: 'networkidle0' })
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('Pagados en este')),
    page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('111222'))
      row.querySelector('button[type="submit"]').click()
    }),
  ])
  await page.goto('http://localhost:3002/inicio', { waitUntil: 'networkidle0' })
  const still = await page.$('.echeq-alert')
  const after = still ? await page.$eval('.echeq-alert', (node) => node.innerText) : ''
  if (after.includes('111222')) throw new Error(`paid check still alerting ${after}`)
  console.log(JSON.stringify({ tabs, alertText, afterAlert: after || null }))
} catch (error) {
  console.error(error)
  const text = await page.$eval('body', (body) => body.innerText.slice(0, 1500)).catch(() => '')
  console.error(text)
  process.exitCode = 1
} finally {
  await browser.close()
}
