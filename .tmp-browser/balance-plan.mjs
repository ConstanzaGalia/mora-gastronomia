import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(25000)
page.on('dialog', (dialog) => dialog.accept())
await page.setViewport({ width: 1280, height: 900 })

function money(text) {
  const normalized = text.replace(/\s/g, '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  return Number(normalized)
}

async function cards() {
  return page.$$eval('.stat-card.money', (nodes) => nodes.map((node) => ({
    label: node.querySelector('.stat-label')?.textContent?.trim() ?? '',
    value: node.querySelector('strong')?.textContent?.trim() ?? '',
  })))
}

function card(stats, label) {
  return money(stats.find((item) => item.label === label)?.value ?? '0')
}

const base = 'http://localhost:3002/balance?mes=2026-10'
const failures = []

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.balance-tabs')
  const tabs = await page.$$eval('.balance-tabs a', (links) => links.map((link) => link.textContent.trim()))
  const mixed = await page.$eval('body', (body) => body.innerText.includes('Por empresa') || body.innerText.includes('Pagos del mes'))
  const onlyCompanies = await page.$eval('h2', (node) => node.textContent.trim())
  if (tabs.join(',') !== 'Empresas,Gastos,Proveedores,Fijos' || mixed || onlyCompanies !== 'Empresas') {
    failures.push(`tabs ${tabs.join('|')} mixed=${mixed} heading=${onlyCompanies}`)
  }

  const before = await cards()
  const beforeFacturado = card(before, 'Facturado')
  const beforeGastos = card(before, 'Gastos')
  const beforeResultado = card(before, 'Resultado')
  const beforeDebt = card(before, 'Deuda')
  const rowsBefore = await page.$$eval('.balance-table tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim()))

  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('Precio por hora')),
    page.click('.stretch-link'),
  ])
  const company = await page.$eval('h2', (node) => node.textContent.trim())
  const hourForm = (await page.$$('form.price-form'))[1]
  const pricesBefore = await page.$$eval('.price-current', (nodes) => nodes.length)
  await hourForm.$eval('input[name="effective_from"]', (input) => { input.value = '2026-10-01' })
  await hourForm.$eval('input[name="unit_price"]', (input) => { input.value = '1000' })
  await Promise.all([
    page.waitForFunction((count) => document.querySelectorAll('.price-current').length > count, {}, pricesBefore),
    hourForm.$eval('button[type="submit"]', (button) => button.click()),
  ])
  await page.$eval('input[name="worked_on"]', (input) => { input.value = '2026-10-09' })
  await page.$eval('input[name="hours"]', (input) => { input.value = '2' })
  await page.$eval('input[name="note"]', (input) => { input.value = 'Cocina prueba' })
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('Cocina prueba')),
    page.$eval('input[name="hours"]', (input) => input.closest('form').querySelector('button[type="submit"]').click()),
  ])
  const line = await page.$eval('.detail-block table', (table) => table.innerText)
  if (!line.includes('Cocina prueba') || (!line.includes('2.000') && !line.includes('2000'))) failures.push(`hour line ${line}`)

  await page.goto(base, { waitUntil: 'networkidle0' })
  const afterHours = await cards()
  const facturadoDelta = card(afterHours, 'Facturado') - beforeFacturado
  const debtDelta = card(afterHours, 'Deuda') - beforeDebt
  const rowsAfter = await page.$$eval('.balance-table tbody tr', (rows) => rows.map((row) => row.innerText.replace(/\s+/g, ' ').trim()))
  const changed = rowsAfter.filter((row, index) => row !== rowsBefore[index])
  if (Math.abs(facturadoDelta - 2000) > 0.01) failures.push(`facturado delta ${facturadoDelta}`)
  if (Math.abs(debtDelta - 2000) > 0.01) failures.push(`debt delta ${debtDelta}`)
  if (changed.length !== 1) failures.push(`changed rows ${changed.length}: ${changed.join(' || ')}`)

  await page.goto(`${base}&seccion=proveedores`, { waitUntil: 'networkidle0' })
  await page.$eval('input[name="name"]', (input) => { input.value = 'Proveedor prueba balance' })
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('Proveedor prueba balance')),
    page.$eval('input[name="name"]', (input) => input.closest('form').querySelector('button[type="submit"]').click()),
  ])
  const supplierId = await page.$eval('select[name="supplier_id"]', (select) => [...select.options].find((option) => option.textContent.includes('Proveedor prueba balance'))?.value ?? '')
  await page.select('select[name="supplier_id"]', supplierId)
  await page.select('select[name="method"]', 'ECHEQ')
  await page.waitForSelector('input[name="echeq_number"]')
  await page.$eval('input[name="paid_on"]', (input) => { input.value = '2026-10-09' })
  await page.$eval('input[name="concept"]', (input) => { input.value = 'eCheq prueba' })
  await page.$eval('input[name="amount"]', (input) => { input.value = '500' })
  await page.$eval('input[name="echeq_number"]', (input) => { input.value = '998877' })
  await page.$eval('input[name="echeq_date"]', (input) => { input.value = '2026-10-20' })
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('eCheq prueba')),
    page.$eval('input[name="concept"]', (input) => input.closest('form').querySelector('button[type="submit"]').click()),
  ])
  const pending = await cards()
  if (Math.abs(card(pending, 'Gastos') - beforeGastos) > 0.01) failures.push(`pending moved gastos ${card(pending, 'Gastos')} vs ${beforeGastos}`)
  if (Math.abs(card(pending, 'Resultado') - beforeResultado) > 0.01) failures.push(`pending moved resultado`)
  const showsEcheq = await page.$eval('body', (body) => body.innerText.includes('998877'))
  if (!showsEcheq) failures.push('echeq number missing')

  await Promise.all([
    page.waitForFunction(() => [...document.querySelectorAll('button.fixed-state')].some((button) => button.textContent.trim() === 'Pagado')),
    page.click('button.fixed-state.pending'),
  ])
  const paid = await cards()
  if (Math.abs(card(paid, 'Gastos') - (beforeGastos + 500)) > 0.01) failures.push(`paid gastos ${card(paid, 'Gastos')} expected ${beforeGastos + 500}`)
  if (Math.abs(card(paid, 'Resultado') - (beforeResultado - 500)) > 0.01) failures.push(`paid resultado ${card(paid, 'Resultado')} expected ${beforeResultado - 500}`)

  await page.goto(`${base}&seccion=fijos`, { waitUntil: 'networkidle0' })
  await page.$eval('input[name="name"]', (input) => { input.value = 'Alquiler prueba balance' })
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('Alquiler prueba balance')),
    page.$eval('input[name="name"]', (input) => input.closest('form').querySelector('button[type="submit"]').click()),
  ])
  const october = await page.evaluateHandle(() => {
    const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('Alquiler prueba balance'))
    return [...row.querySelectorAll('button.fixed-state')][9]
  })
  await october.click()
  await page.waitForSelector('.fixed-amount input')
  await page.type('.fixed-amount input', '300')
  await Promise.all([
    page.waitForFunction(() => {
      const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('Alquiler prueba balance'))
      return Boolean(row?.querySelector('button.fixed-state.paid'))
    }),
    page.click('.fixed-amount button'),
  ])
  const fixedPaid = await cards()
  if (Math.abs(card(fixedPaid, 'Gastos') - (beforeGastos + 500 + 300)) > 0.01) failures.push(`fixed gastos ${card(fixedPaid, 'Gastos')}`)

  const paidCell = await page.$$eval('button.fixed-state.paid', (buttons) => buttons.map((button) => button.textContent.trim()))
  await Promise.all([
    page.waitForFunction(() => document.body.innerText.includes('No aplica')),
    page.evaluate(() => {
      const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('Alquiler prueba balance'))
      row.querySelector('button.fixed-state.paid').click()
    }),
  ])
  const fixedNa = await cards()
  if (Math.abs(card(fixedNa, 'Gastos') - (beforeGastos + 500)) > 0.01) failures.push(`na gastos ${card(fixedNa, 'Gastos')} cells ${paidCell.join('|')}`)

  await page.screenshot({ path: '.tmp-browser/balance-fijos.png', fullPage: true })
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(base, { waitUntil: 'networkidle0' })
  await page.screenshot({ path: '.tmp-browser/balance-mobile.png', fullPage: true })

  console.log(JSON.stringify({
    company,
    before,
    facturadoDelta,
    debtDelta,
    changed,
    failures,
  }, null, 2))
  if (failures.length) throw new Error(failures.join('\n'))
} catch (error) {
  console.error(error)
  const banner = await page.$eval('body', (body) => body.innerText.slice(0, 1200)).catch(() => '')
  console.error(banner)
  process.exitCode = 1
} finally {
  try {
    await page.setViewport({ width: 1280, height: 900 })
    await page.goto(`${base}&seccion=fijos`, { waitUntil: 'networkidle0' })
    if (await page.evaluate(() => document.body.innerText.includes('Alquiler prueba balance'))) {
      const na = await page.$('tr button.fixed-state.na')
      if (na) await Promise.all([page.waitForNetworkIdle({ idleTime: 500 }).catch(() => null), page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('Alquiler prueba balance'))
        row?.querySelector('button.fixed-state.na')?.click()
      })])
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('Alquiler prueba balance'))
        row?.querySelector('button.outline-button')?.click()
      })
      await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => null)
    }
    await page.goto(`${base}&seccion=proveedores`, { waitUntil: 'networkidle0' })
    if (await page.evaluate(() => document.body.innerText.includes('eCheq prueba'))) {
      await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('eCheq prueba'))
        row?.querySelector('button')?.click()
      })
      await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => null)
    }
    const supplierDelete = await page.evaluate(() => {
      const item = [...document.querySelectorAll('.supplier-list li')].find((node) => node.innerText.includes('Proveedor prueba balance'))
      item?.querySelector('button')?.click()
      return Boolean(item)
    })
    if (supplierDelete) await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => null)
    await page.goto(base, { waitUntil: 'networkidle0' })
    if (await page.$('.stretch-link')) {
      await Promise.all([
        page.waitForFunction(() => document.body.innerText.includes('Precio por hora')),
        page.click('.stretch-link'),
      ])
      const hourDelete = await page.evaluate(() => {
        const row = [...document.querySelectorAll('tr')].find((item) => item.innerText.includes('Cocina prueba'))
        row?.querySelector('button')?.click()
        return Boolean(row)
      })
      if (hourDelete) await page.waitForNetworkIdle({ idleTime: 500 }).catch(() => null)
      const priceDelete = await page.$('.price-pair .account-price:nth-child(2) button[title="Quitar precio"]')
      if (priceDelete) await Promise.all([page.waitForNetworkIdle({ idleTime: 500 }).catch(() => null), priceDelete.click()])
    }
  } catch (cleanupError) {
    console.error('cleanup', cleanupError)
  }
  await browser.close()
}
