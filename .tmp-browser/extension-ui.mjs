import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  await page.goto('http://localhost:3002/calendario', { waitUntil: 'networkidle0' })
  const href = await page.$eval('a[href^="/calendario/"]', (el) => el.getAttribute('href'))
  await page.goto('http://localhost:3002' + href, { waitUntil: 'networkidle0' })
  const before = await page.evaluate(() => ({
    heading: document.body.innerText.includes('Extensión horaria'),
    checks: document.querySelectorAll('input[name="extension"]').length,
  }))
  console.log('week', href, JSON.stringify(before))
  if (!before.heading || before.checks === 0) throw new Error('missing extension form')
  await page.$eval('input[name="extension"]', (el) => { el.checked = true })
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.$eval('form:has(input[name="extension"])', (form) => form.requestSubmit()),
  ])
  const saved = await page.$eval('input[name="extension"]', (el) => el.checked)
  console.log('saved', saved, page.url())
  await page.$eval('input[name="extension"]', (el) => { el.checked = false })
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.$eval('form:has(input[name="extension"])', (form) => form.requestSubmit()),
  ])
  const cleared = await page.$eval('input[name="extension"]', (el) => el.checked)
  console.log('cleared', cleared)
  for (const path of ['/balance', '/elecciones', '/reportes', '/inicio']) {
    const response = await page.goto('http://localhost:3002' + path, { waitUntil: 'networkidle0' })
    const text = await page.evaluate(() => document.body.innerText.slice(0, 180).replace(/\s+/g, ' '))
    console.log(path, response.status(), text)
  }
  if (!saved || cleared) throw new Error('checkbox did not persist')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
