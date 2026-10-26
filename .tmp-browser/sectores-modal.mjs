import puppeteer from 'puppeteer-core'

const LEDESMA = '38f3ff23-e991-4534-8d10-15a40aa4f324'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
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
await page.waitForFunction(() => document.body.innerText.includes('Editar sectores'), { timeout: 30000 })
const onPage = await page.evaluate(() => ({
  hasTrigger: [...document.querySelectorAll('button')].some((el) => el.textContent.trim() === 'Editar sectores'),
  hasChips: [...document.querySelectorAll('.category-chips li')].map((el) => el.textContent.trim()),
  hasFlatForm: Boolean(document.querySelector('input[placeholder="Administración, Planta…"]')),
}))
console.log(JSON.stringify(onPage))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/sectores-chips.png', fullPage: true })
const trigger = await page.evaluateHandle(() => [...document.querySelectorAll('button')].find((el) => el.textContent.trim() === 'Editar sectores'))
await trigger.asElement().click()
await page.waitForSelector('dialog[open] input[name="name"]')
const inDialog = await page.evaluate(() => document.querySelector('dialog[open]')?.innerText)
console.log('DIALOG', inDialog?.slice(0, 400))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/sectores-modal.png' })
if (!onPage.hasTrigger || onPage.hasFlatForm || onPage.hasChips.length === 0) {
  console.error('FAIL', onPage)
  await browser.close()
  process.exit(1)
}
await browser.close()
console.log('OK modal sectores')
