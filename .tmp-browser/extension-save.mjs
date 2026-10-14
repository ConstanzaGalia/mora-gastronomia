import puppeteer from '/tmp/mora-verify/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js'

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
  await new Promise((resolve) => setTimeout(resolve, 350))
}

async function save() {
  await Promise.all([
    page.waitForResponse((response) => response.request().method() === 'POST' && response.url().includes('/calendario/')),
    page.$eval('form:has(.extension-grid)', (form) => form.requestSubmit()),
  ])
  await new Promise((resolve) => setTimeout(resolve, 400))
}

const label = 'Grupo Horizonte, lun'

try {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle0' }),
    page.click('button[type="submit"]'),
  ])
  await page.goto('http://localhost:3002/calendario/bfa481d3-be94-4c5a-b398-906884042b7b', { waitUntil: 'networkidle0' })
  await page.waitForSelector('.extension-grid')

  const before = await page.$eval(`input[aria-label="${label}"]`, (el) => el.checked)
  if (before) {
    await clickBox(`input[aria-label="${label}"]`)
    await save()
    await page.reload({ waitUntil: 'networkidle0' })
  }

  await clickBox(`input[aria-label="${label}"]`)
  const pending = await page.evaluate((name) => ({
    checked: document.querySelector(`input[aria-label="${name}"]`).checked,
    hidden: [...document.querySelectorAll('input[name="extension"]')].map((el) => el.value).length,
  }), label)
  await save()
  await page.reload({ waitUntil: 'networkidle0' })
  const saved = await page.$eval(`input[aria-label="${label}"]`, (el) => el.checked)

  await clickBox(`input[aria-label="${label}"]`)
  await save()
  await page.reload({ waitUntil: 'networkidle0' })
  const left = await page.$$eval('.extension-grid tbody input[type="checkbox"]:checked', (els) => els.length)
  console.log({ pending, saved, left })
  if (!pending.checked || pending.hidden < 1 || !saved || left !== 0) throw new Error('save did not stick')
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
