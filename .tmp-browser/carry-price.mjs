import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
page.on('dialog', (dialog) => dialog.accept())

function cardText(name) {
  const card = [...document.querySelectorAll('.account-card')].find((el) => el.querySelector('h3')?.textContent.includes(name))
  return card ? card.innerText.replace(/\s+/g, ' ') : 'missing'
}

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  await page.goto('http://localhost:3002/balance?mes=2026-10', { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('.account-card')].find((el) => el.querySelector('h3')?.textContent.includes('Grupo Horizonte'))
    const form = card.querySelector('.price-form')
    form.querySelector('input[name="effective_from"]').value = '2026-10-01'
    form.querySelector('input[name="unit_price"]').value = '1500'
    form.requestSubmit()
  })
  await page.waitForFunction(() => document.body.innerText.includes('1.500'))
  console.log('octubre', await page.evaluate(cardText, 'Grupo Horizonte'))
  await page.goto('http://localhost:3002/balance?mes=2026-11', { waitUntil: 'networkidle0' })
  console.log('noviembre', await page.evaluate(cardText, 'Grupo Horizonte'))
  await page.click('.account-card button[title="Quitar precio"]')
  await page.waitForFunction(() => !document.body.innerText.includes('1.500'))
  console.log('cleaned', true)
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
