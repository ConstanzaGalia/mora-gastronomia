import puppeteer from '/private/tmp/echeq-verify/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})

const page = await browser.newPage()
const base = 'http://localhost:3002'
const failures = []
function check(name, ok, detail = '') {
  const line = `${ok ? 'OK' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

await page.setViewport({ width: 1280, height: 800 })
await page.goto(base + '/', { waitUntil: 'networkidle0' })
check('sin sesión queda en /', page.url() === base + '/' || page.url() === base + '/?', page.url())
const h1 = await page.$eval('h1', (el) => el.textContent.trim())
check('título del hero', h1.includes('Soluciones gastronómicas reales'), h1)
const heroStyle = await page.$eval('h1', (el) => {
  const s = getComputedStyle(el)
  return { family: s.fontFamily, size: s.fontSize, color: s.color, weight: s.fontWeight }
})
console.log('hero style', JSON.stringify(heroStyle))
check('hero usa Playfair', /Playfair/i.test(heroStyle.family), heroStyle.family)
check('hero es negro', heroStyle.color === 'rgb(0, 0, 0)', heroStyle.color)

await page.evaluate(async () => {
  for (const img of document.querySelectorAll('img')) {
    img.scrollIntoView()
    if (!img.complete || img.naturalWidth === 0) {
      await new Promise((resolve) => {
        img.addEventListener('load', resolve, { once: true })
        img.addEventListener('error', resolve, { once: true })
      })
    }
  }
  window.scrollTo(0, 0)
})
const images = await page.$$eval('img', (nodes) =>
  nodes.map((img) => ({ src: img.getAttribute('src'), w: img.naturalWidth, alt: img.alt.slice(0, 40) })),
)
console.log('images', JSON.stringify(images, null, 2))
check('fotos locales cargan', images.length >= 4 && images.every((img) => img.w > 0 && img.src.includes('/landing/')))

await page.click('a[href="#menus"]')
await new Promise((r) => setTimeout(r, 400))
const menus = await page.$eval('#menus', (el) => {
  const rect = el.getBoundingClientRect()
  return { top: Math.round(rect.top), id: el.id }
})
console.log('menus position', menus)
check('ancla #menus baja a la sección', menus.top < 120 && menus.top > -40, JSON.stringify(menus))

await page.click('a[href="/login"]')
await page.waitForFunction(() => location.pathname === '/login', { timeout: 8000 })
check('iniciar sesión abre /login', page.url().includes('/login'), page.url())
const buttonColor = await page.$eval('.primary-button', (el) => getComputedStyle(el).backgroundColor)
console.log('login button', buttonColor)
check('el botón del sistema no quedó negro', buttonColor !== 'rgb(0, 0, 0)', buttonColor)

await page.setViewport({ width: 390, height: 800 })
await page.goto(base + '/', { waitUntil: 'networkidle0' })
const menuBox = await page.$eval('button[aria-label="Abrir menú"]', (el) => {
  const rect = el.getBoundingClientRect()
  return { x: Math.round(rect.x), w: Math.round(rect.width) }
})
console.log('menu button', menuBox)
check('el botón del menú entra en la pantalla', menuBox.x + menuBox.w <= 390 && menuBox.x >= 0, JSON.stringify(menuBox))
await page.click('button[aria-label="Abrir menú"]')
const menuOpen = await page.$eval('header nav.xl\\:hidden', (el) => getComputedStyle(el).display !== 'none')
check('el menú se abre en pantallas chicas', menuOpen)
await page.click('header nav.xl\\:hidden a[href="#contacto"]')
await new Promise((r) => setTimeout(r, 400))
const contacto = await page.$eval('#contacto', (el) => Math.round(el.getBoundingClientRect().top))
check('el menú móvil baja a contacto', contacto < 120 && contacto > -40, String(contacto))
const loginVisible = await page.$eval('a[href="/login"]', (el) => {
  const s = getComputedStyle(el)
  const rect = el.getBoundingClientRect()
  return s.visibility !== 'hidden' && rect.width > 0 && rect.bottom > 0 && rect.top < 90
})
check('iniciar sesión sigue a la vista', loginVisible)

await page.setViewport({ width: 1280, height: 800 })
await page.goto(base + '/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([
  page.waitForNavigation({ waitUntil: 'networkidle0', timeout: 15000 }),
  page.click('button[type="submit"]'),
])
console.log('after login', page.url())
check('el ingreso llega al panel', page.url().includes('/inicio'), page.url())

await page.goto(base + '/', { waitUntil: 'networkidle0' })
console.log('authed /', page.url())
check('con sesión / entra al panel', page.url().includes('/inicio'), page.url())
check('con sesión / no muestra la landing', !(await page.$('h1')) || !(await page.$eval('h1', (el) => el.textContent.includes('Soluciones gastronómicas'))))

await page.goto(base + '/login', { waitUntil: 'networkidle0' })
console.log('authed /login', page.url())
check('con sesión /login termina en el panel', !page.url().includes('/login'), page.url())

await browser.close()
if (failures.length) {
  console.log('FAILURES', failures.length)
  process.exit(1)
}
console.log('ALL PASSED')
