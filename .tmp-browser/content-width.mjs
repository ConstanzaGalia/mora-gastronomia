import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
page.setDefaultTimeout(20000)

function measure() {
  const main = document.querySelector('.main-content')
  const wrap = document.querySelector('.content-wrap')
  const panel = document.querySelector('.panel')
  const mr = main.getBoundingClientRect()
  const wr = wrap.getBoundingClientRect()
  const pr = panel.getBoundingClientRect()
  return {
    inner: window.innerWidth,
    mainRight: Math.round(mr.right),
    mainW: Math.round(mr.width),
    wrapW: Math.round(wr.width),
    panelW: Math.round(pr.width),
    wrapLeft: Math.round(wr.left),
    panelLeft: Math.round(pr.left),
    panelRight: Math.round(pr.right),
    scroller: getComputedStyle(main).overflowY,
  }
}

try {
  await page.setViewport({ width: 1600, height: 900 })
  await page.goto('http://localhost:3002/login', { waitUntil: 'networkidle0' })
  await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
  await page.type('input[name="password"]', 'Balcarce2026')
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
  for (const path of ['/calendario', '/empresas']) {
    await page.goto('http://localhost:3002' + path, { waitUntil: 'networkidle0' })
    console.log(path, JSON.stringify(await page.evaluate(measure)))
  }
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/content-empresas.png' })
  await page.goto('http://localhost:3002/calendario', { waitUntil: 'networkidle0' })
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/content-calendario.png' })
} catch (error) {
  console.error(error)
  process.exitCode = 1
} finally {
  await browser.close()
}
