import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3002/calendario', { waitUntil: 'networkidle0' })
const box = await page.evaluate(() => {
  const day = document.querySelector('.day-column')
  const r = day.getBoundingClientRect()
  const days = document.querySelector('.week-days')
  const gap = getComputedStyle(days).gap
  const pad = getComputedStyle(day).padding
  return { w: Math.round(r.width), h: Math.round(r.height), gap, pad }
})
console.log(box)
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/cal-space.png' })
await browser.close()
