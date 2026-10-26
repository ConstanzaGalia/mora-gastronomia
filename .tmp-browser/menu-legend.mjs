import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })

async function login({ email, dni, password }) {
  await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
  if (dni) {
    await page.evaluate(() => {
      const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Empleado'))
      button?.click()
    })
    await page.waitForSelector('input[name="dni"]')
    await page.type('input[name="dni"]', dni)
  } else {
    await page.type('input[name="email"]', email)
  }
  await page.type('input[name="password"]', password)
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
}

async function logout() {
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }).catch(() => null),
    page.evaluate(() => document.querySelector('.logout-button')?.closest('form')?.requestSubmit()),
  ])
}

async function employeeView() {
  await login({ dni: '30111011', password: '30111011' })
  const view = await page.evaluate(() => ({
    description: document.querySelector('.welcome-row .muted')?.textContent?.trim() ?? '',
    legends: [...document.querySelectorAll('.menu-combo legend')].map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
  }))
  await logout()
  return view
}

async function setPostre(enabled) {
  await login({ email: 'maria.gonzalez@balcarce.test', password: 'Balcarce2026' })
  await page.goto('http://localhost:3000/empresas/38f3ff23-e991-4534-8d10-15a40aa4f324', { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('button')].find((node) => node.textContent?.includes('Editar categorías'))
    button?.click()
  })
  await page.waitForSelector('dialog[open] .check-line')
  await page.evaluate((want) => {
    const label = [...document.querySelectorAll('dialog[open] .check-line')].find((node) => node.textContent?.includes('Postre'))
    const input = label?.querySelector('input[type="checkbox"]')
    if (input && input.checked !== want) input.click()
  }, enabled)
  await page.evaluate(() => {
    const button = [...document.querySelectorAll('dialog[open] button[type="submit"]')].find((node) => node.textContent?.includes('Guardar'))
    button?.click()
  })
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), { timeout: 8000 }).catch(() => null)
  await new Promise((resolve) => setTimeout(resolve, 400))
  await logout()
}

const before = await employeeView()
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/legend-before.png', fullPage: true }).catch(() => null)
await setPostre(false)
const after = await employeeView()
await setPostre(true)
const restored = await employeeView()
console.log(JSON.stringify({ before, after, restored }, null, 2))
await browser.close()
