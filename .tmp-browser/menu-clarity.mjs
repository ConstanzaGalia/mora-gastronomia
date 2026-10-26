import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })

async function loginEmployee() {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Empleado'))
    button?.click()
  })
  await page.waitForSelector('input[name="dni"]')
  await page.type('input[name="dni"]', '30111011')
  await page.type('input[name="password"]', '30111011')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
}

await loginEmployee()
console.log('after employee login', page.url())
if (page.url().includes('/login')) {
  const err = await page.$eval('.error-banner', (el) => el.textContent).catch(() => null)
  throw new Error(`employee login failed: ${err}`)
}
await page.goto('http://localhost:3000/mi-menu', { waitUntil: 'networkidle0' })

const pills = await page.evaluate(() =>
  [...document.querySelectorAll('.menu-day-pill')].map((pill) => ({
    day: pill.querySelector('strong')?.textContent?.trim(),
    state: pill.querySelector('span')?.textContent?.trim(),
    classes: pill.className,
  })),
)

const chosenPill = await page.$('.menu-day-pill.elegida')
if (chosenPill) await chosenPill.click()
await page.waitForSelector('.chosen-menu, .stack-form, .ledger-empty')
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/menu-elegida.png', fullPage: true })

const chosenView = await page.evaluate(() => ({
  title: document.querySelector('.chosen-menu-title')?.textContent?.trim() ?? null,
  items: [...document.querySelectorAll('.chosen-list p')].map((row) => row.innerText.replace(/\s+/g, ' ').trim()),
  hasRadios: Boolean(document.querySelector('.combo-option')),
  buttons: [...document.querySelectorAll('.menu-combo-actions button, .menu-combo button')].map((button) => button.textContent?.trim()),
  copy: document.querySelector('.menu-combo .muted')?.textContent?.trim() ?? null,
  badge: document.querySelector('.menu-combo .status-badge')?.textContent?.trim() ?? null,
}))

const openPill = await page.$('.menu-day-pill.abierta')
if (openPill) await openPill.click()
await page.waitForSelector('.stack-form, .chosen-menu')
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/menu-pendiente.png', fullPage: true })

const openView = await page.evaluate(() => ({
  title: document.querySelector('.chosen-menu-title')?.textContent?.trim() ?? null,
  hasRadios: Boolean(document.querySelector('.combo-option')),
  submit: [...document.querySelectorAll('button')].map((button) => button.textContent?.trim()).find((text) => text?.includes('Confirmar') || text?.includes('Guardar')),
  copy: document.querySelector('.menu-combo .muted')?.textContent?.trim() ?? null,
  badge: document.querySelector('.menu-combo .status-badge')?.textContent?.trim() ?? null,
}))

console.log(JSON.stringify({ pills, chosenView, openView }, null, 2))

await page.evaluate(() => document.querySelector('form button.logout-button, .logout-button')?.closest('form')?.requestSubmit())
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null)
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Administrador'))
  button?.click()
})
await page.waitForSelector('input[name="email"]')
await page.type('input[name="email"]', 'ledesma.encargado@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/inicio', { waitUntil: 'networkidle0' })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/dashboard-encargado.png', fullPage: true })
const dashboard = await page.evaluate(() => ({
  description: document.querySelector('.welcome-row .muted, .page-header .muted, p.muted')?.textContent?.trim() ?? null,
  cards: [...document.querySelectorAll('.stat-card')].map((card) => card.innerText.replace(/\s+/g, ' ').trim()),
  pending: [...document.querySelectorAll('.pending-list li')].map((item) => item.innerText.replace(/\s+/g, ' ').trim()),
}))

console.log(JSON.stringify({ pills, chosenView, openView, dashboard }, null, 2))
await browser.close()
