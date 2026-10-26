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
await tabs[1].click()
await page.waitForFunction(() => document.querySelector('.menu-week-switch button.active')?.textContent?.includes('26'))

await page.evaluate(() => {
  const pill = [...document.querySelectorAll('.menu-day-pill')].find((node) => node.querySelector('strong')?.textContent?.trim() === '27')
  pill?.click()
})
await new Promise((resolve) => setTimeout(resolve, 250))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/menu-27.png', fullPage: true })
const before = await page.evaluate(() => ({
  heading: document.querySelector('.menu-combo h2')?.textContent?.trim(),
  badge: document.querySelector('.menu-combo .status-badge')?.textContent?.trim(),
  copy: document.querySelector('.menu-combo .muted')?.textContent?.trim(),
  title: document.querySelector('.chosen-menu-title')?.textContent?.trim() ?? null,
  items: [...document.querySelectorAll('.chosen-list p')].map((row) => row.innerText.replace(/\s+/g, ' ').trim()),
  hasRadios: Boolean(document.querySelector('.combo-option')),
  buttons: [...document.querySelectorAll('.menu-combo button')].map((button) => button.textContent?.trim()),
}))
const change = await page.$('.menu-combo-actions .primary-button')
if (change) {
  await change.click()
  await new Promise((resolve) => setTimeout(resolve, 250))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/menu-27-cambiar.png', fullPage: true })
}
const after = await page.evaluate(() => ({
  hasRadios: Boolean(document.querySelector('.combo-option')),
  buttons: [...document.querySelectorAll('.menu-combo button')].map((button) => button.textContent?.trim()),
}))
console.log(JSON.stringify({ before, after }, null, 2))
await browser.close()
