import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

const origin = 'http://127.0.0.1:4330'
const artifacts = path.resolve('artifacts/company')
await fs.mkdir(artifacts, { recursive: true })
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-company-qa-edge-'))
const browser = await puppeteer.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true, userDataDir: profile, args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'] })
const report = { browser: 'Separate headless Microsoft Edge; temporary profile; no existing Chrome/CDP connection', origin, widths: [], keyboard: [], routes: [], errors: [], apiRequests: [], notes: [] }

try {
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = request.url()
    if (url.includes('/api/')) { report.apiRequests.push(url); request.abort(); return }
    if (url.startsWith(origin) || /^(data|blob):/.test(url)) request.continue()
    else request.abort()
  })
  page.on('pageerror', error => report.errors.push(error.message))
  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: width === 1440 ? 1000 : 844, deviceScaleFactor: 1 })
    await page.goto(`${origin}/company`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.company-page')
    await page.evaluate(() => document.fonts.ready)
    // Reveal lazy images without changing their layout.
    await page.evaluate(async () => {
      for (const image of document.querySelectorAll('.company-page img')) {
        image.scrollIntoView()
        await image.decode()
      }
      window.scrollTo(0, 0)
    })
    const state = await page.evaluate(() => {
      const page = document.querySelector('.company-page')
      const colors = []
      function rgb(color) { return color.match(/[\d.]+/g)?.slice(0, 3).map(Number) }
      function luminance(color) { return rgb(color).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0) }
      for (const element of page.querySelectorAll('p,h1,h2,h3,dt,dd,a,span,blockquote')) {
        if (!element.textContent.trim() || [...element.children].some(child => child.textContent.trim())) continue
        const style = getComputedStyle(element)
        let ancestor = element
        let background = style.backgroundColor
        while (background === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; background = getComputedStyle(ancestor).backgroundColor }
        const a = luminance(style.color), b = luminance(background)
        const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && parseInt(style.fontWeight) >= 700)
        colors.push({ text: element.textContent.trim().slice(0, 24), contrast: Math.round(contrast * 100) / 100, minimum: large ? 3 : 4.5 })
      }
      return {
        viewport: innerWidth,
        documentWidth: document.documentElement.scrollWidth,
        pageWidth: page.scrollWidth,
        h1: page.querySelectorAll('h1').length,
        font: getComputedStyle(page.querySelector('.company-lead')).fontFamily,
        fontsLoaded: document.fonts.check('18px "Dearlog Pretendard"') && document.fonts.check('600 40px "Dearlog Maru Buri"'),
        bodySize: getComputedStyle(page.querySelector('.company-lead')).fontSize,
        images: [...page.querySelectorAll('img')].map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0, alt: image.alt })),
        links: [...page.querySelectorAll('a')].map(link => ({ href: link.getAttribute('href'), label: link.textContent.trim(), height: Math.round(link.getBoundingClientRect().height) })),
        contrastFailures: colors.filter(item => item.contrast < item.minimum),
        minimumTextContrast: Math.min(...colors.map(item => item.contrast)),
        forms: page.querySelectorAll('form').length,
      }
    })
    assert.equal(state.documentWidth, width, `Document overflow at ${width}px`)
    assert.equal(state.pageWidth, width, `Page overflow at ${width}px`)
    assert.equal(state.h1, 1)
    assert.equal(state.fontsLoaded, true)
    assert(state.images.every(image => image.loaded && image.alt))
    assert.equal(state.forms, 0)
    assert.equal(state.contrastFailures.length, 0, JSON.stringify(state.contrastFailures))
    assert(state.links.every(link => link.height >= 44), JSON.stringify(state.links))
    assert(state.links.filter(link => link.href === '/auth').length === 2)
    assert(state.links.some(link => link.href === 'mailto:hello@dear-log.com'))
    const name = width === 1440 ? 'desktop' : `mobile-${width}`
    await page.screenshot({ path: path.join(artifacts, `company-${name}.png`), fullPage: true })
    await page.screenshot({ path: path.join(artifacts, `company-${name}-first-screen.png`), fullPage: false })
    report.widths.push(state)
  }
  await page.setViewport({ width: 390, height: 844 })
  await page.goto(`${origin}/company`, { waitUntil: 'networkidle0' })
  await page.keyboard.press('Tab')
  let focus = await page.evaluate(() => ({ text: document.activeElement.textContent.trim(), href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle, visible: document.activeElement.getBoundingClientRect().top >= 0 }))
  assert.equal(focus.href, '#company-main')
  assert.equal(focus.visible, true)
  assert.equal(focus.outline, 'solid')
  report.keyboard.push(focus)
  await page.screenshot({ path: path.join(artifacts, 'company-keyboard-focus.png') })
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'company-main')
  report.keyboard.push({ skipLink: 'Enter focuses main' })
  await page.keyboard.press('Tab')
  focus = await page.evaluate(() => ({ href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle }))
  assert.equal(focus.href, '/auth')
  assert.equal(focus.outline, 'solid')
  report.keyboard.push(focus)
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.pathname === '/auth' && document.body.textContent.includes('로그인'))
  report.keyboard.push({ serviceCTA: 'Enter opens /auth' })

  await page.goto(`${origin}/company`, { waitUntil: 'networkidle0' })
  const tabLinks = []
  for (let i = 0; i < 13; i++) {
    await page.keyboard.press('Tab')
    tabLinks.push(await page.evaluate(() => document.activeElement.getAttribute('href') || document.activeElement.tagName))
  }
  assert(tabLinks.includes('mailto:hello@dear-log.com'))
  assert(tabLinks.includes('/company/fonts/README.txt'))
  report.keyboard.push({ tabSequence: tabLinks })
  for (const target of ['company-process', 'company-product', 'company-team']) {
    await page.goto(`${origin}/company`, { waitUntil: 'networkidle0' })
    await page.click(`.company-nav a[href="#${target}"]`)
    const top = await page.evaluate(id => document.getElementById(id).getBoundingClientRect().top, target)
    assert(top >= -1 && top < 120)
    report.routes.push({ anchor: target, top })
  }
  for (const route of ['/company', '/company/', '/company?source=qa']) {
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle0' })
    await page.reload({ waitUntil: 'networkidle0' })
    assert(await page.$('.company-page'))
    report.routes.push({ route, directAndRefresh: 'pass' })
  }
  assert.equal(report.apiRequests.length, 0, 'Company page must not issue API requests')
  for (const route of ['/', '/auth', '/auth/verify', '/parent', '/child', '/calendar', '/parent/autologin']) {
    await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.querySelector('#root').textContent.length > 0 && !document.querySelector('[role="status"]'))
    if (route === '/') await page.waitForFunction(() => location.pathname === '/splash')
    if (['/parent', '/child', '/calendar'].includes(route)) await page.waitForFunction(() => location.pathname === '/auth')
    const state = await page.evaluate(() => ({ path: location.pathname, mobileLayout: !!document.querySelector('.max-w-\\[390px\\]'), text: document.querySelector('#root').textContent.slice(0, 100) }))
    assert(state.mobileLayout, `${route} must retain service mobile layout`)
    report.routes.push({ route, ...state })
  }
  // Existing authenticated state and enabled schedule must remain unchanged on /company.
  await page.goto(`${origin}/company`, { waitUntil: 'networkidle0' })
  await page.evaluate(() => {
    sessionStorage.setItem('dearlog-auth', JSON.stringify({ state: { role: 'parent', userName: 'QA fixture', userId: 'company-qa', phoneNumber: '', authToken: null }, version: 0 }))
    const now = new Date()
    localStorage.setItem('dearlog-scheduled-call', JSON.stringify({ state: { scheduledTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, scheduledDays: [now.getDay()], isEnabled: true, lastCallDate: null }, version: 0 }))
  })
  const before = await page.evaluate(() => ({ auth: sessionStorage.getItem('dearlog-auth'), schedule: localStorage.getItem('dearlog-scheduled-call') }))
  const apiBefore = report.apiRequests.length
  await page.reload({ waitUntil: 'networkidle0' })
  const after = await page.evaluate(() => ({ auth: sessionStorage.getItem('dearlog-auth'), schedule: localStorage.getItem('dearlog-scheduled-call') }))
  assert.deepEqual(after, before)
  assert.equal(new URL(page.url()).pathname, '/company')
  assert.equal(report.apiRequests.length, apiBefore)
  report.notes.push('Company route leaves authentication and enabled scheduled interview state unchanged; does not run service monitors or API calls.')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  assert.equal(await page.$eval('.company-service-link', element => getComputedStyle(element).transitionDuration), '0s')
  report.notes.push('Reduced motion disables CTA transitions.')
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.notes.push('Live recording, email delivery, and external production service availability are outside this isolated static-page QA.')
  await fs.writeFile(path.join(artifacts, 'qa-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ widths: report.widths.map(state => ({ viewport: state.viewport, documentWidth: state.documentWidth, minContrast: state.minimumTextContrast })), keyboard: 'pass', routes: report.routes.length, pageErrors: report.errors.length, companyApiRequests: 0 }, null, 2))
} catch (error) {
  await fs.writeFile(path.join(artifacts, 'qa-failure.json'), JSON.stringify({ ...report, failure: error.stack }, null, 2))
  throw error
} finally {
  await browser.close()
  await fs.rm(profile, { recursive: true, force: true })
}
