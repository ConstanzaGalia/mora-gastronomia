import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.evaluateOnNewDocument(() => {
  window.print = () => { window.__printed = true }
})

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'ledesma.encargado@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/comensales?fecha=2026-10-27', { waitUntil: 'networkidle0' })

const list = await page.evaluate(() => {
  const exportLink = document.querySelector('.welcome-row a.primary-button')
  const names = [...document.querySelectorAll('.panel table tbody tr td:first-child')].map((el) => el.textContent?.trim() ?? '')
  return {
    title: document.querySelector('.welcome-row h1')?.textContent?.trim() ?? '',
    exportLabel: exportLink?.textContent?.trim() ?? null,
    exportHref: exportLink?.getAttribute('href') ?? null,
    names,
  }
})

await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/encargado-comensales.png' })
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0' }),
  page.click('.welcome-row a.primary-button'),
])

const print = await page.evaluate(() => {
  const names = [...document.querySelectorAll('.diner-sheet table tbody tr td:first-child')].map((el) => el.textContent?.trim() ?? '')
  const sorted = [...names].sort((a, b) => a.localeCompare(b, 'es'))
  return {
    path: location.pathname,
    brand: document.querySelector('.diner-brand strong')?.textContent?.trim() ?? '',
    subtitle: document.querySelector('.diner-brand span')?.textContent?.trim() ?? '',
    date: document.querySelector('.diner-letterhead h1')?.textContent?.trim() ?? '',
    company: document.querySelector('.diner-letterhead p')?.textContent?.trim() ?? '',
    savePdf: document.querySelector('.diner-toolbar .primary-button')?.textContent?.trim() ?? '',
    names,
    sorted: names.join('|') === sorted.join('|'),
  }
})
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/encargado-pdf.png' })
console.log(JSON.stringify({ list, print }, null, 2))
await browser.close()
