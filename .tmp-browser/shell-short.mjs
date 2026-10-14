import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)
await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3002/balance', { waitUntil: 'networkidle0' })
for (const size of [{ width: 1024, height: 561 }, { width: 1440, height: 900 }]) {
await page.setViewport(size)
const data = await page.evaluate(() => {
  const gap = window.innerHeight - document.querySelector('.logout-button').getBoundingClientRect().bottom
  const nav = document.querySelector('.primary-nav')
  const bottom = document.querySelector('.sidebar-bottom')
  const logout = document.querySelector('.logout-button')
  const side = document.querySelector('.sidebar')
  const cs = getComputedStyle(nav)
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: Math.round(r.height) }
  }
  return {
    inner: window.innerHeight,
    navStyle: { flex: cs.flex, minHeight: cs.minHeight, overflow: cs.overflowY },
    side: box(side),
    nav: box(nav),
    bottom: box(bottom),
    logout: box(logout),
    navScroll: nav.scrollHeight > nav.clientHeight,
    gap,
    logoutText: logout.textContent,
  }
})
console.log(size.height, JSON.stringify({ gap: Math.round(data.gap), logout: data.logout, side: data.side, text: data.logoutText }))
if (data.gap < 12) process.exitCode = 1
}
await page.setViewport({ width: 1440, height: 900 })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/shell-short.png' })
await browser.close()
