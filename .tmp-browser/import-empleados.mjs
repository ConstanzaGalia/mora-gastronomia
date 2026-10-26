import { writeFile } from 'node:fs/promises'
import puppeteer from 'puppeteer-core'

const csvPath = '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/empleados-carga.csv'
await writeFile(csvPath, 'apellido,nombre,dni\nPérez,Ana,30111000\nImportado,Testa,39999301\nZeta,Bruno,39999302\n', 'utf8')

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

async function login(email) {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', email)
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
}

async function logout() {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null),
    page.evaluate(() => document.querySelector('.logout-button')?.closest('form')?.requestSubmit()),
  ])
}

await login('ledesma.encargado@balcarce.test')
await page.goto('http://localhost:3000/empleados', { waitUntil: 'networkidle0' })
const encargadoHome = await page.evaluate(() => ({
  importButton: [...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Importar Excel')),
  addButton: [...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Sumar empleado')),
}))
await page.evaluate(() => {
  const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Importar Excel'))
  button?.click()
})
await page.waitForSelector('dialog[open] input[type="file"]')
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/import-dialog.png' })
const file = await page.$('dialog[open] input[type="file"]')
await file.uploadFile(csvPath)
await page.waitForFunction(() => document.querySelector('dialog[open] tbody tr'))
const preview = await page.evaluate(() => ({
  download: [...document.querySelectorAll('dialog[open] button')].some((button) => button.textContent?.includes('Descargar modelo Excel')),
  names: [...document.querySelectorAll('dialog[open] tbody tr')].map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent?.trim())),
  count: document.querySelector('dialog[open] .muted')?.textContent?.trim() ?? '',
}))
await page.click('dialog[open] button[type="submit"]')
await page.waitForFunction(() => document.querySelector('dialog[open] .success-banner, dialog[open] .error-banner'))
const result = await page.evaluate(() => ({
  success: document.querySelector('dialog[open] .success-banner')?.textContent?.trim() ?? null,
  error: document.querySelector('dialog[open] .error-banner')?.textContent?.trim() ?? null,
  issues: [...document.querySelectorAll('dialog[open] .import-issues li')].map((item) => item.textContent?.trim()),
}))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/import-result.png' })
await page.evaluate(() => {
  const button = [...document.querySelectorAll('dialog[open] button')].find((node) => node.textContent?.includes('Cerrar'))
  button?.click()
})
await page.waitForFunction(() => !document.querySelector('dialog[open]'))
const people = await page.evaluate(() => [...document.querySelectorAll('table tbody tr td:first-child')].map((td) => td.textContent?.trim()))
await logout()

await login('maria.gonzalez@balcarce.test')
await page.goto('http://localhost:3000/empresas/38f3ff23-e991-4534-8d10-15a40aa4f324', { waitUntil: 'networkidle0' })
const mora = await page.evaluate(() => ({
  importButton: [...document.querySelectorAll('button')].some((button) => button.textContent?.includes('Importar Excel')),
  people: [...document.querySelectorAll('table tbody tr')].map((row) => [...row.querySelectorAll('td')].slice(0, 2).map((td) => td.textContent?.trim())),
}))
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/import-mora.png' })

console.log(JSON.stringify({ encargadoHome, preview, result, people, mora }, null, 2))
await browser.close()
