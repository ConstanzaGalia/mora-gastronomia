import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 900 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })

const header = await page.evaluate(() => {
  const brand = document.querySelector('header a')
  const img = brand?.querySelector('img')
  const text = brand?.innerText?.replace(/\s+/g, ' ').trim() ?? ''
  return {
    url: location.pathname,
    text,
    src: img?.getAttribute('src') ?? null,
    alt: img?.getAttribute('alt') ?? null,
    w: img?.naturalWidth ?? 0,
    h: img?.naturalHeight ?? 0,
    displayed: img ? { w: img.clientWidth, h: img.clientHeight } : null,
    beside: brand ? getComputedStyle(brand).display.includes('flex') : false,
  }
})
console.log('header', JSON.stringify(header))

await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/landing-logo-header.png', clip: { x: 0, y: 0, width: 1440, height: 120 } })

await page.evaluate(() => document.querySelector('footer')?.scrollIntoView())
await new Promise((r) => setTimeout(r, 300))
const footer = await page.evaluate(() => {
  const block = document.querySelector('footer .flex.items-center.gap-3')
  const img = block?.querySelector('img')
  return {
    text: block?.innerText?.replace(/\s+/g, ' ').trim() ?? '',
    src: img?.getAttribute('src') ?? null,
    w: img?.naturalWidth ?? 0,
    displayed: img ? { w: img.clientWidth, h: img.clientHeight } : null,
  }
})
console.log('footer', JSON.stringify(footer))
const footerBox = await page.$eval('footer', (el) => {
  const r = el.getBoundingClientRect()
  return { y: Math.max(0, r.top), height: Math.min(220, r.height) }
})
await page.screenshot({
  path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/landing-logo-footer.png',
  clip: { x: 0, y: footerBox.y, width: 1440, height: footerBox.height },
})

await page.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 })
await page.goto('http://localhost:3000/', { waitUntil: 'networkidle0' })
await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/landing-logo-mobile.png', clip: { x: 0, y: 0, width: 390, height: 90 } })

await browser.close()
console.log('done')
