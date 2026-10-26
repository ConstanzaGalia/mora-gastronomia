import puppeteer from './node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const failures = []
function check(name, ok, detail = '') {
  const line = `${ok ? 'OK' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`
  console.log(line)
  if (!ok) failures.push(line)
}

try {
  const page = await (await browser.createBrowserContext()).newPage()
  await page.setViewport({ width: 1280, height: 900 })
  await page.goto('http://localhost:3000/mercadito', { waitUntil: 'domcontentloaded', timeout: 60000 })
  await page.waitForSelector('.market-checkout', { timeout: 30000 })
  await page.click('.market-product .extras-stepper button[aria-label^="Sumar"]')
  await page.click('.market-checkout-main .primary-button')
  await page.waitForSelector('input[name="customer_name"]', { visible: true, timeout: 10000 })
  await page.type('input[name="customer_name"]', 'QA Copiar')
  await page.type('input[name="phone"]', '3815556666')
  await page.type('input[name="address"]', 'San Martín 400, San Miguel de Tucumán')
  await page.click('.market-checkout-main .primary-button')
  await page.waitForFunction(() => document.body.innerText.includes('Cómo pagás'), { timeout: 10000 })
  await page.click('input[value="TRANSFERENCIA"]')
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 60000 }),
    page.click('.market-summary button[type="submit"]'),
  ])
  check('gracias', page.url().includes('/mercadito/pedido/'), page.url())
  await page.waitForSelector('.market-transfer-list', { timeout: 20000 })

  const rows = await page.$$eval('.market-transfer-list li', (els) => els.map((el) => ({
    text: el.querySelector('span')?.textContent.trim() ?? el.textContent.trim(),
    copy: [...el.querySelectorAll('button')].some((button) => /Copiar|Copiado/.test(button.textContent)),
  })))
  const titular = rows.find((row) => row.text.startsWith('Titular:'))
  const banco = rows.find((row) => row.text.startsWith('Banco:'))
  const alias = rows.find((row) => row.text.startsWith('Alias:'))
  const cbu = rows.find((row) => row.text.startsWith('CBU/CVU:'))
  check('titular sin copiar', Boolean(titular) && !titular.copy, JSON.stringify(titular))
  check('banco sin copiar', Boolean(banco) && !banco.copy, JSON.stringify(banco))
  check('alias con copiar', Boolean(alias) && alias.copy, JSON.stringify(alias))
  check('cbu con copiar', Boolean(cbu) && cbu.copy, JSON.stringify(cbu))
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/mercadito-copy.png', fullPage: true })

  const orderId = page.url().split('/').pop()
  const { createClient } = await import('@supabase/supabase-js')
  const { readFileSync } = await import('node:fs')
  const env = Object.fromEntries(readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const index = line.indexOf('=')
    return [line.slice(0, index), line.slice(index + 1)]
  }))
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })
  const { error } = await supabase.from('market_orders').delete().eq('id', orderId)
  if (error) throw error
} catch (error) {
  console.error(error)
  failures.push(String(error))
} finally {
  await browser.close()
}

if (failures.length) {
  console.error(`\n${failures.length} fallos`)
  process.exit(1)
}
console.log('\nOK copiar transferencia')
