import puppeteer from 'puppeteer-core'

const pdf = '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/habilitacion.pdf'
const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/documentos', { waitUntil: 'networkidle0' })
const nav = await page.evaluate(() => ({
  item: [...document.querySelectorAll('.nav-item')].some((el) => el.textContent?.includes('Documentos')),
  title: document.querySelector('.welcome-row h1')?.textContent?.trim() ?? '',
}))

await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Categorías'))
  button?.click()
})
await page.waitForSelector('dialog[open] input[name="name"]')
await page.type('dialog[open] input[name="name"]', 'Habilitaciones')
await page.click('dialog[open] button[type="submit"]')
await page.waitForFunction(() => document.querySelector('dialog[open] .success-banner, dialog[open] .error-banner'))
const first = await page.evaluate(() => ({
  success: document.querySelector('dialog[open] .success-banner')?.textContent?.trim() ?? null,
  error: document.querySelector('dialog[open] .error-banner')?.textContent?.trim() ?? null,
}))
await page.type('dialog[open] input[name="name"]', 'Habilitaciones')
await page.click('dialog[open] button[type="submit"]')
await page.waitForFunction(() => document.querySelector('dialog[open] .error-banner')?.textContent?.includes('ya existe'))
const duplicate = await page.evaluate(() => document.querySelector('dialog[open] .error-banner')?.textContent?.trim() ?? null)
await page.evaluate(() => {
  const button = [...document.querySelectorAll('dialog[open] button')].find((node) => node.textContent?.includes('Listo'))
  button?.click()
})
await page.waitForFunction(() => !document.querySelector('dialog[open]'))

await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Subir documento'))
  button?.click()
})
await page.waitForSelector('dialog[open] select[name="category_id"]')
await page.select('dialog[open] select[name="category_id"]', await page.$eval('dialog[open] select[name="category_id"] option:not([disabled])', (el) => el.value))
await page.type('dialog[open] input[name="title"]', 'Habilitación municipal 2026')
const file = await page.$('dialog[open] input[name="file"]')
await file.uploadFile(pdf)
await page.type('dialog[open] input[name="issued_on"]', '01012026')
await page.type('dialog[open] input[name="expires_on"]', '31122026')
await page.click('dialog[open] button[type="submit"]')
await page.waitForFunction(() => !document.querySelector('dialog[open]') || document.querySelector('dialog[open] .error-banner'))
await page.goto('http://localhost:3000/documentos', { waitUntil: 'networkidle0' })
const table = await page.evaluate(() => ({
  error: document.querySelector('.error-banner')?.textContent?.trim() ?? null,
  rows: [...document.querySelectorAll('table tbody tr')].map((row) => [...row.querySelectorAll('td')].slice(0, 5).map((td) => td.innerText.replace(/\s+/g, ' ').trim())),
}))
await page.type('.document-filters input[name="q"]', 'municipal')
await page.click('.document-filters button[type="submit"]')
await page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null)
const search = await page.evaluate(() => ({
  q: new URL(location.href).searchParams.get('q'),
  rows: [...document.querySelectorAll('table tbody tr')].length,
}))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/documentos.png', fullPage: true })
console.log(JSON.stringify({ nav, first, duplicate, table, search }, null, 2))
await browser.close()
