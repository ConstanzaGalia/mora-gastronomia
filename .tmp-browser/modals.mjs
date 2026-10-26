import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/empresas/38f3ff23-e991-4534-8d10-15a40aa4f324', { waitUntil: 'networkidle0' })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/empresa.png', fullPage: true })
const pageState = await page.evaluate(() => ({
  inlinePeopleForm: Boolean(document.querySelector('.people-add, .people-form')),
  buttons: [...document.querySelectorAll('button, .primary-button, .outline-button')].map((el) => el.textContent?.trim()).filter(Boolean),
  openDialog: Boolean(document.querySelector('dialog[open]')),
}))
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Vincular persona')
  button?.click()
})
await page.waitForSelector('dialog[open]')
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/empresa-modal.png', fullPage: true })
const modal = await page.evaluate(() => ({
  title: document.querySelector('dialog[open] h2')?.textContent?.trim(),
  labels: [...document.querySelectorAll('dialog[open] label')].map((el) => el.childNodes[0]?.textContent?.trim()),
}))
await page.goto('http://localhost:3000/balance?seccion=gastos', { waitUntil: 'networkidle0' })
const gastosInline = await page.evaluate(() => Boolean(document.querySelector('.balance-form')))
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.trim() === 'Anotar gasto')
  button?.click()
})
await page.waitForSelector('dialog[open]')
const gastoModal = await page.evaluate(() => document.querySelector('dialog[open] h2')?.textContent?.trim())
console.log(JSON.stringify({ pageState, modal, gastosInline, gastoModal }, null, 2))
await browser.close()
