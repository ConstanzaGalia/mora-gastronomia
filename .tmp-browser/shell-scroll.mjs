import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)

async function login() {
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
}

function measure() {
  const sidebar = document.querySelector('.sidebar')
  const wrap = document.querySelector('.content-wrap')
  const profile = document.querySelector('.profile-mini strong')
  const logout = document.querySelector('.logout-button')
  wrap.scrollTop = wrap.scrollHeight
  const box = (el) => {
    const r = el.getBoundingClientRect()
    return { top: Math.round(r.top), bottom: Math.round(r.bottom) }
  }
  return {
    topbar: Boolean(document.querySelector('.topbar')),
    crumb: document.body.innerText.includes('Balcarce /'),
    innerH: window.innerHeight,
    shellH: Math.round(document.querySelector('.app-shell').getBoundingClientRect().height),
    sidebar: box(sidebar),
    profile: profile.textContent,
    profileBox: box(profile),
    logout: logout.textContent,
    logoutBox: box(logout),
    wrapCanScroll: wrap.scrollHeight > wrap.clientHeight + 2,
    wrapScrollTop: wrap.scrollTop,
    pageScroll: document.documentElement.scrollTop,
  }
}

try {
  await page.setViewport({ width: 1440, height: 800 })
  await login()
  await page.goto('http://localhost:3002/balance', { waitUntil: 'networkidle0' })
  console.log('desktop', JSON.stringify(await page.evaluate(measure)))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/shell-desktop.png' })

  await page.setViewport({ width: 390, height: 800 })
  await page.reload({ waitUntil: 'networkidle0' })
  const mobileClosed = await page.evaluate(() => ({
    menu: getComputedStyle(document.querySelector('.menu-toggle')).display,
    sidebarHidden: document.querySelector('.sidebar').classList.contains('mobile-hidden'),
    topbar: Boolean(document.querySelector('.topbar')),
  }))
  await page.click('.menu-toggle')
  await page.waitForSelector('.sidebar:not(.mobile-hidden)')
  const mobileOpen = await page.evaluate(measure)
  console.log('mobile-closed', JSON.stringify(mobileClosed))
  console.log('mobile-open', JSON.stringify(mobileOpen))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/shell-mobile.png' })
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
