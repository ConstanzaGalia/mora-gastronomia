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

try {
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto('http://localhost:3000/mercadito', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.market-checkout, .empty-state, h1', { timeout: 30000 })

  const formReady = Boolean(await page.$('.market-checkout'))
  check('checkout visible', formReady)
  if (!formReady) throw new Error('El mercadito no tiene bandejas para probar el wizard')

  const stepState = await page.$$eval('.market-steps button', (els) => els.map((el) => ({
    label: el.querySelector('strong')?.textContent.trim(),
    disabled: el.disabled,
    current: el.getAttribute('aria-current') === 'step',
  })))
  check('tres pasos', stepState.length === 3, JSON.stringify(stepState))
  check('menú actual', stepState[0]?.current && !stepState[0]?.disabled)
  check('entrega y pago bloqueados', stepState[1]?.disabled && stepState[2]?.disabled)

  const step1 = await page.evaluate(() => ({
    continuar: [...document.querySelectorAll('.market-checkout-main .primary-button')].some((el) => el.textContent.includes('Continuar a entrega')),
    volver: [...document.querySelectorAll('.market-checkout-main button')].some((el) => /Volver/.test(el.textContent)),
    textLink: [...document.querySelectorAll('.text-button')].some((el) => /Volver/.test(el.textContent)),
  }))
  check('continuar en paso 1', step1.continuar)
  check('sin volver en paso 1', !step1.volver)
  check('sin link de texto volver', !step1.textLink)

  await page.click('.market-checkout-main .primary-button')
  await page.waitForFunction(() => document.body.innerText.includes('Elegí al menos una bandeja'), { timeout: 5000 })
  check('pide bandeja', true)

  await page.click('.market-product .extras-stepper button[aria-label^="Sumar"]')
  await page.waitForSelector('.market-cart-item .extras-stepper')
  const cartQty = await page.$eval('.market-cart-item input[aria-label^="Cantidad"]', (el) => el.value)
  check('carrito con stepper', cartQty === '1', cartQty)

  await page.click('.market-checkout-main .primary-button')
  await page.waitForSelector('input[name="customer_name"]', { visible: true, timeout: 10000 })

  const step2 = await page.evaluate(() => ({
    heading: document.body.innerText.includes('Dónde lo llevamos'),
    volver: [...document.querySelectorAll('.market-checkout-main .outline-button')].some((el) => el.textContent.includes('Volver al menú')),
    continuar: [...document.querySelectorAll('.market-checkout-main .primary-button')].some((el) => el.textContent.includes('Continuar a pago')),
    summaryVolver: [...document.querySelectorAll('.market-summary .outline-button')].some((el) => el.textContent.includes('Volver al menú')),
    textLink: [...document.querySelectorAll('.text-button')].some((el) => /Volver/.test(el.textContent)),
    cartStepper: Boolean(document.querySelector('.market-summary .extras-stepper')),
  }))
  check('paso entrega', step2.heading)
  check('volver y continuar juntos', step2.volver && step2.continuar)
  check('volver también en carrito', step2.summaryVolver)
  check('sin link de texto en entrega', !step2.textLink)
  check('stepper en carrito en entrega', step2.cartStepper)
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-back-entrega.png', fullPage: true })

  await page.click('.market-checkout-main .outline-button')
  await page.waitForFunction(() => document.body.innerText.includes('Elegí tu bandeja'), { timeout: 5000 })
  const backQty = await page.$eval('.market-product input[aria-label^="Cantidad"]', (el) => el.value)
  check('volver al menú conserva cantidad', backQty === '1', backQty)

  const afterBack = await page.$$eval('.market-steps button', (els) => els.map((el) => ({
    label: el.querySelector('strong')?.textContent.trim(),
    disabled: el.disabled,
  })))
  check('entrega sigue visitada', !afterBack[1]?.disabled, JSON.stringify(afterBack))

  await page.click('.market-steps li:nth-child(2) button')
  await page.waitForSelector('input[name="customer_name"]', { visible: true, timeout: 5000 })
  await page.type('input[name="customer_name"]', 'QA Volver')
  await page.type('input[name="phone"]', '3815557777')
  await page.type('input[name="address"]', 'San Martín 300, San Miguel de Tucumán')
  await page.type('textarea[name="notes"]', 'Timbre 2')

  await page.click('.market-checkout-main .primary-button')
  await page.waitForFunction(() => document.body.innerText.includes('Cómo pagás'), { timeout: 10000 })

  const step3 = await page.evaluate(() => ({
    volver: [...document.querySelectorAll('.market-checkout-main .outline-button')].some((el) => el.textContent.includes('Volver a entrega')),
    pedir: [...document.querySelectorAll('.market-checkout-main .primary-button')].some((el) => el.textContent.includes('Pedir')),
    cartStepper: Boolean(document.querySelector('.market-summary .extras-stepper')),
  }))
  check('volver a entrega en pago', step3.volver)
  check('pedir en el paso', step3.pedir)
  check('stepper en carrito en pago', step3.cartStepper)
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-back-pago.png', fullPage: true })

  await page.click('.market-summary .extras-stepper button[aria-label^="Sumar"]')
  const plusQty = await page.$eval('.market-summary input[aria-label^="Cantidad"]', (el) => el.value)
  check('sumar desde el carrito', plusQty === '2', plusQty)

  await page.click('.market-steps li:nth-child(1) button')
  await page.waitForFunction(() => document.body.innerText.includes('Elegí tu bandeja'), { timeout: 5000 })
  const menuQty = await page.$eval('.market-product input[aria-label^="Cantidad"]', (el) => el.value)
  check('chip menú conserva cantidad del carrito', menuQty === '2', menuQty)

  await page.click('.market-steps li:nth-child(3) button')
  await page.waitForFunction(() => document.body.innerText.includes('Cómo pagás'), { timeout: 5000 })
  await page.click('.market-checkout-main .outline-button')
  await page.waitForSelector('input[name="customer_name"]', { visible: true, timeout: 5000 })
  const deliveryData = await page.evaluate(() => ({
    name: document.querySelector('input[name="customer_name"]').value,
    notes: document.querySelector('textarea[name="notes"]').value,
  }))
  check('datos de entrega intactos', deliveryData.name === 'QA Volver' && deliveryData.notes === 'Timbre 2', JSON.stringify(deliveryData))

  await page.setViewport({ width: 390, height: 844 })
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-back-mobile.png', fullPage: true })
  const mobile = await page.evaluate(() => ({
    cart: Boolean(document.querySelector('.market-summary .extras-stepper')),
    volver: [...document.querySelectorAll('.outline-button')].some((el) => el.textContent.includes('Volver al menú')),
  }))
  check('carrito editable en celular', mobile.cart && mobile.volver)
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
console.log('\nOK volver atrás mercadito')
