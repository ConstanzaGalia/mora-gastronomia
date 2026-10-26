import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Empleado'))
  button?.click()
})
await page.waitForSelector('input[name="dni"]')
await page.type('input[name="dni"]', '30111011')
await page.type('input[name="password"]', '30111011')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.waitForSelector('.menu-week-switch button')
const tabs = await page.$$('.menu-week-switch button')
if (tabs[1]) await tabs[1].click()
await page.waitForFunction(() => document.querySelector('.menu-week-switch button.active')?.textContent?.includes('26'))

const pills = await page.evaluate(() =>
  [...document.querySelectorAll('.menu-day-pill')].map((pill) => ({
    day: pill.querySelector('strong')?.textContent?.trim(),
    state: pill.querySelector('span')?.textContent?.trim(),
    classes: pill.className,
  })),
)

async function shot(name, selector) {
  const pill = await page.$(selector)
  if (pill) await pill.click()
  await new Promise((resolve) => setTimeout(resolve, 250))
  await page.screenshot({ path: `/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/${name}.png`, fullPage: true })
  return page.evaluate(() => ({
    title: document.querySelector('.chosen-menu-title')?.textContent?.trim() ?? null,
    items: [...document.querySelectorAll('.chosen-list p')].map((row) => row.innerText.replace(/\s+/g, ' ').trim()),
    hasRadios: Boolean(document.querySelector('.combo-option')),
    buttons: [...document.querySelectorAll('.menu-combo button')].map((button) => button.textContent?.trim()),
    copy: document.querySelector('.menu-combo .muted')?.textContent?.trim() ?? null,
    badge: document.querySelector('.menu-combo .status-badge')?.textContent?.trim() ?? null,
    heading: document.querySelector('.menu-combo h2')?.textContent?.trim() ?? null,
  }))
}

const current = await page.evaluate(() => document.querySelector('.menu-day-pill.is-current')?.innerText.replace(/\s+/g, ' '))
const elegida = await shot('menu-week2-elegida', '.menu-day-pill.elegida:not(.is-current), .menu-day-pill.elegida')
const change = await page.$('.menu-combo-actions .primary-button')
if (change) {
  await change.click()
  await new Promise((resolve) => setTimeout(resolve, 250))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/menu-week2-cambiar.png', fullPage: true })
}
const abierta = await shot('menu-week2-pendiente', '.menu-day-pill.abierta')
console.log(JSON.stringify({ pills, current, elegida, abierta }, null, 2))
await browser.close()
