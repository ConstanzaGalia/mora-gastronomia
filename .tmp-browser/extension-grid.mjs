import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })

async function clickBox(selector) {
  const box = await page.$eval(selector, (el) => {
    el.scrollIntoView({ block: 'center' })
    const rect = el.getBoundingClientRect()
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 }
  })
  await page.mouse.click(box.x, box.y)
}

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  await page.goto('http://localhost:3002/calendario', { waitUntil: 'networkidle0' })
  const href = await page.$eval('a[href^="/calendario/"]', (el) => el.getAttribute('href'))
  await page.goto('http://localhost:3002' + href, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.extension-grid')
  const layout = await page.evaluate(() => ({
    rows: document.querySelectorAll('.extension-grid tbody tr').length,
    dayCols: document.querySelectorAll('.extension-grid thead th').length - 1,
  }))
  while (await page.$('.extension-grid tbody input[name="extension"]:checked')) {
    await clickBox('.extension-grid tbody input[name="extension"]:checked')
    await page.waitForFunction(() => !document.querySelector('.extension-grid tbody input[name="extension"]:checked'))
  }
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.$eval('form:has(.extension-grid)', (form) => form.requestSubmit()),
  ])
  await page.type('.extension-tools input', 'Horizonte')
  const visible = await page.evaluate(() => [...document.querySelectorAll('.extension-grid tbody tr')].filter((row) => !row.hidden).length)
  await clickBox('.extension-grid tbody tr:not([hidden]) input[name="extension"]')
  await page.waitForFunction(() => document.querySelector('.extension-grid tbody input[name="extension"]:checked'))
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.$eval('form:has(.extension-grid)', (form) => form.requestSubmit()),
  ])
  const saved = await page.$eval('.extension-grid tbody input[name="extension"]:checked', (el) => el.getAttribute('aria-label'))
  await clickBox('.extension-grid tbody input[name="extension"]:checked')
  await page.waitForFunction(() => !document.querySelector('.extension-grid tbody input[name="extension"]:checked'))
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.$eval('form:has(.extension-grid)', (form) => form.requestSubmit()),
  ])
  const left = await page.$$eval('.extension-grid tbody input[name="extension"]:checked', (els) => els.length)
  console.log({ layout, visible, saved, left })
  if (layout.rows < 2 || layout.dayCols !== 5 || visible !== 1 || saved !== 'Grupo Horizonte, lun' || left !== 0) {
    throw new Error('grid check failed')
  }
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
