import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'ledesma.encargado@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/empleados', { waitUntil: 'networkidle0' })
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Importar Excel'))
  button?.click()
})
await page.waitForSelector('dialog[open] input[type="file"]')
const input = await page.$('dialog[open] input[type="file"]')
await input.uploadFile('/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/modelo-empleados.xlsx')
await page.waitForFunction(() => document.querySelector('dialog[open] .error-banner, dialog[open] tbody tr'))
const info = await page.evaluate(() => ({
  error: document.querySelector('dialog[open] .error-banner')?.textContent?.trim() ?? null,
  rows: [...document.querySelectorAll('dialog[open] tbody tr')].length,
}))
console.log(JSON.stringify(info, null, 2))
await browser.close()
