import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(15000)
await page.setViewport({ width: 1440, height: 900 })
page.on('pageerror', (error) => console.log('pageerror', error.message))
await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3002/calendario', { waitUntil: 'networkidle0' })
const href = await page.$eval('a[href^="/calendario/"]', (el) => el.getAttribute('href'))
await page.goto('http://localhost:3002' + href, { waitUntil: 'networkidle0' })
await page.waitForSelector('.extension-grid')
await page.type('.extension-tools input', 'Horizonte')
const info = await page.evaluate(() => {
  const input = document.querySelector('.extension-grid tbody tr:not([hidden]) input[name="extension"]')
  const rect = input.getBoundingClientRect()
  return { checked: input.checked, w: rect.width, h: rect.height, x: rect.x, y: rect.y, label: input.getAttribute('aria-label') }
})
console.log('before', info)
await page.mouse.click(info.x + info.w / 2, info.y + info.h / 2)
await new Promise((resolve) => setTimeout(resolve, 300))
const after = await page.evaluate(() => {
  const input = document.querySelector('.extension-grid tbody tr:not([hidden]) input[name="extension"]')
  return { checked: input.checked }
})
console.log('after', after)
await browser.close()
