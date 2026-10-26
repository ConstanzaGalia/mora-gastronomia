import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: true,
  args: ['--no-sandbox'],
})
const page = await browser.newPage()
await page.setViewport({ width: 1440, height: 1100 })

await page.goto('http://localhost:3000/login', { waitUntil: 'networkidle0' })
await page.type('input[name="email"]', 'maria.gonzalez@balcarce.test')
await page.type('input[name="password"]', 'Balcarce2026')
await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('button[type="submit"]')])
await page.goto('http://localhost:3000/calendario', { waitUntil: 'networkidle0' })

const weeks = await page.evaluate(() => [...document.querySelectorAll('.panel')].flatMap((panel) => {
  const title = panel.querySelector('h2')?.textContent?.trim() ?? ''
  const status = panel.querySelector('.status-badge')?.textContent?.trim() ?? ''
  const href = panel.querySelector('a.text-button')?.getAttribute('href') ?? ''
  return href ? [{ title, status, href }] : []
}))

async function inspectWeek(href, name) {
  await page.goto(`http://localhost:3000${href}`, { waitUntil: 'networkidle0' })
  await page.waitForSelector('.week-grid-panel')
  const info = await page.evaluate(() => {
    const panel = document.querySelector('.week-grid-panel')
    const optionRows = [...panel.querySelectorAll('tbody tr')].filter((row) => !row.classList.contains('week-grid-category'))
    return {
      heading: panel.querySelector('h2')?.textContent?.trim() ?? '',
      hasSearch: !!panel.querySelector('.catalog-search input'),
      saveLabel: panel.querySelector('form#week-grid button')?.textContent?.trim() ?? null,
      serviceButtons: [...panel.querySelectorAll('thead button')].map((button) => button.textContent?.trim()),
      allDays: optionRows.filter((row) => row.querySelector('.all-days')).length,
      optionNames: optionRows.map((row) => row.querySelector('.option-col')?.textContent?.replace(/\s+/g, ' ').trim()),
      checkboxes: panel.querySelectorAll('tbody input[type="checkbox"]:not(.all-days input)').length,
      marks: panel.querySelectorAll('.week-mark:not(.is-empty-mark)').length,
      warn: document.querySelector('.warn-banner')?.textContent?.trim() ?? null,
    }
  })
  await page.screenshot({ path: `/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/${name}.png`, fullPage: true })
  return info
}

const published = weeks.find((week) => week.status === 'Publicada')
const draft = weeks.find((week) => week.status === 'Borrador')
const result = { weeks, published: null, draft: null, search: null, allDays: null, repeat: null }

if (published) result.published = { ...published, ...(await inspectWeek(published.href, 'week-published')) }
if (draft) {
  result.draft = { ...draft, ...(await inspectWeek(draft.href, 'week-draft')) }
  await page.waitForSelector('.week-grid-panel .catalog-search input')
  await page.click('.week-grid-panel .catalog-search input', { clickCount: 3 })
  await page.type('.week-grid-panel .catalog-search input', 'pan')
  await new Promise((resolve) => setTimeout(resolve, 200))
  result.search = await page.evaluate(() => ({
    names: [...document.querySelectorAll('.week-grid tbody tr:not(.week-grid-category) .option-col')].map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    categories: [...document.querySelectorAll('.week-grid-category .option-col')].map((el) => el.textContent?.trim()),
  }))
  await page.click('.week-grid-panel .catalog-search input', { clickCount: 3 })
  await page.keyboard.press('Backspace')
  await new Promise((resolve) => setTimeout(resolve, 150))
  result.allDays = await page.evaluate(() => {
    const row = [...document.querySelectorAll('.week-grid tbody tr')].find((item) => {
      const name = item.querySelector('.option-col span')?.textContent?.trim().toLowerCase() ?? ''
      return name.includes('agua') || name.includes('pan') || name.includes('soda')
    })
    const toggle = row?.querySelector('.all-days input')
    toggle?.click()
    const checks = row ? [...row.querySelectorAll('td input[type="checkbox"]')].filter((input) => input.checked).length : 0
    return { name: row?.querySelector('.option-col span')?.textContent?.trim() ?? null, checks }
  })
  result.repeat = await page.evaluate(() => {
    const trayRows = (() => {
      const rows = [...document.querySelectorAll('.week-grid tbody tr')]
      let inTray = false
      const found = []
      for (const row of rows) {
        if (row.classList.contains('week-grid-category')) {
          inTray = (row.querySelector('.option-col')?.textContent ?? '').toLowerCase().includes('bandeja')
          continue
        }
        if (inTray) found.push(row)
      }
      return found
    })()
    const first = trayRows[0]
    const boxes = first ? [...first.querySelectorAll('td input[type="checkbox"]:not(:disabled)')] : []
    boxes.slice(0, 2).forEach((box) => { if (!box.checked) box.click() })
    return {
      dish: first?.querySelector('.option-col span')?.textContent?.trim() ?? null,
      warn: document.querySelector('.warn-banner')?.textContent?.trim() ?? null,
    }
  })
  await page.screenshot({ path: '/Users/constanzagaliamaldonado/Proyectos/desarrollo-mora-gastronomia/.tmp-browser/week-draft-alert.png', fullPage: true })
}

console.log(JSON.stringify(result, null, 2))
await browser.close()
