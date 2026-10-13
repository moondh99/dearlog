import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import assert from 'node:assert/strict'
import puppeteer from 'puppeteer-core'

// Separate, disposable browser profile: never attach to Chrome or a running CDP session.
const origin = 'http://127.0.0.1:4330'
const artifacts = path.resolve('artifacts/company-v3')
await fs.mkdir(artifacts, { recursive: true })
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-company-v3-edge-'))
const browser = await puppeteer.launch({ executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', headless: true, userDataDir: profile, args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'] })
const report = { browser: 'Separate headless Microsoft Edge; temporary profile; no existing Chrome/CDP connection', origin, widths: [], keyboard: [], dialogs: [], faq: [], routes: [], errors: [], blockedApiRequests: [], notes: [] }

try {
  const page = await browser.newPage()
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = request.url()
    if (/\/api(?:\/|\?|$)/.test(url)) { report.blockedApiRequests.push(url); request.abort(); return }
    if (url.startsWith(`${origin}/`) || /^(data|blob):/.test(url)) request.continue()
    else request.abort()
  })
  page.on('pageerror', error => report.errors.push(error.message))
  const loadCompany = async (suffix = '') => {
    await page.goto(`${origin}/company${suffix}`, { waitUntil: 'networkidle0' })
    await page.waitForSelector('.company-page')
    await page.evaluate(() => document.fonts.ready)
  }
  const activeFocus = () => page.evaluate(() => ({ tag: document.activeElement.tagName, text: document.activeElement.textContent.trim(), name: document.activeElement.getAttribute('aria-label'), href: document.activeElement.getAttribute('href'), outline: getComputedStyle(document.activeElement).outlineStyle }))
  const clickNamedButton = async name => {
    for (const button of await page.$$('.company-page button')) {
      if (await button.evaluate((element, expected) => (element.getAttribute('aria-label') || element.textContent.trim()) === expected, name)) {
        await button.click()
        return
      }
    }
    assert.fail(`Button missing: ${name}`)
  }
  const assertCompanyOffline = apiBefore => assert.equal(report.blockedApiRequests.length, apiBefore, 'Company interactions must not request APIs')

  for (const width of [1440, 390, 320]) {
    await page.setViewport({ width, height: width === 1440 ? 1000 : 844, deviceScaleFactor: 1 })
    const apiBefore = report.blockedApiRequests.length
    await loadCompany()
    await page.evaluate(async () => {
      for (const image of document.querySelectorAll('.company-page img:not(dialog img)')) {
        image.scrollIntoView()
        await image.decode()
      }
      window.scrollTo(0, 0)
    })
    const state = await page.evaluate(() => {
      const company = document.querySelector('.company-page')
      const visible = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
      const rgb = color => color.match(/[\d.]+/g)?.slice(0, 3).map(Number)
      const luminance = color => rgb(color).map(value => { const s = value / 255; return s <= .04045 ? s / 12.92 : ((s + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
      const colors = []
      for (const element of company.querySelectorAll('p,h1,h2,h3,dt,dd,a,span,blockquote,summary,button')) {
        if (!visible(element) || !element.textContent.trim() || [...element.children].some(child => child.textContent.trim())) continue
        const style = getComputedStyle(element)
        let ancestor = element, background = style.backgroundColor
        while (background === 'rgba(0, 0, 0, 0)' && ancestor.parentElement) { ancestor = ancestor.parentElement; background = getComputedStyle(ancestor).backgroundColor }
        const a = luminance(style.color), b = luminance(background)
        const contrast = (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
        const large = parseFloat(style.fontSize) >= 24 || (parseFloat(style.fontSize) >= 18.667 && parseInt(style.fontWeight) >= 700)
        colors.push({ text: element.textContent.trim().slice(0, 40), contrast: Math.round(contrast * 100) / 100, minimum: large ? 3 : 4.5 })
      }
      return {
        viewport: innerWidth, documentWidth: document.documentElement.scrollWidth, pageWidth: company.scrollWidth,
        h1: company.querySelectorAll('h1').length,
        font: getComputedStyle(company.querySelector('.company-lead')).fontFamily,
        fontsLoaded: document.fonts.check('18px "Dearlog Pretendard"') && document.fonts.check('600 40px "Dearlog Maru Buri"'),
        bodySize: getComputedStyle(company.querySelector('.company-lead')).fontSize,
        images: [...company.querySelectorAll('img')].filter(visible).map(image => ({ src: image.getAttribute('src'), loaded: image.complete && image.naturalWidth > 0, alt: image.alt })),
        controls: [...company.querySelectorAll('a,button,summary')].filter(visible).map(element => ({ tag: element.tagName, href: element.getAttribute('href'), label: element.getAttribute('aria-label') || element.textContent.trim(), height: Math.round(element.getBoundingClientRect().height) })),
        contrastFailures: colors.filter(item => item.contrast < item.minimum), minimumTextContrast: Math.min(...colors.map(item => item.contrast)),
        forms: company.querySelectorAll('form').length,
        sample: { text: document.querySelector('#company-sample')?.textContent, fields: document.querySelector('#company-sample')?.querySelectorAll('input,textarea,form').length },
      }
    })
    assert.equal(state.documentWidth, width, `Document overflow at ${width}px`)
    assert.equal(state.pageWidth, width, `Page overflow at ${width}px`)
    assert.equal(state.h1, 1)
    assert.equal(state.fontsLoaded, true)
    assert(state.images.every(image => image.loaded && image.alt))
    assert.equal(state.forms, 0)
    assert.equal(state.contrastFailures.length, 0, JSON.stringify(state.contrastFailures))
    assert(state.controls.every(control => control.height >= 44), JSON.stringify(state.controls))
    assert(state.controls.some(control => control.href === '#company-sample'))
    assert(!state.controls.some(control => control.href === '/auth'))
    assert(state.controls.some(control => control.href === 'mailto:hello@dear-log.com'))
    assert(state.controls.some(control => control.href === '#company-sample'))
    assert(state.sample.text?.includes('가상'))
    assert.equal(state.sample.fields, 0)
    assertCompanyOffline(apiBefore)
    const name = width === 1440 ? 'desktop' : `mobile-${width}`
    await page.screenshot({ path: path.join(artifacts, `company-${name}.png`), fullPage: true })
    await page.screenshot({ path: path.join(artifacts, `company-${name}-first-screen.png`) })
    report.widths.push(state)

    // Native image modal must fit, load, contain focus, cancel, and restore the trigger.
    const triggers = await page.$$eval('.company-preview-button', buttons => buttons.map(button => button.getAttribute('aria-label') || button.textContent.trim()))
    assert(triggers.length > 0, 'Screenshot enlargement controls missing')
    for (const name of triggers) {
      await clickNamedButton(name)
      await page.waitForSelector('dialog[open]')
      await page.$eval('dialog[open] img', image => image.decode())
      const dialog = await page.$eval('dialog[open]', element => {
        const box = element.getBoundingClientRect(), image = element.querySelector('img')
        return { title: document.getElementById(element.getAttribute('aria-labelledby'))?.textContent, modal: element.matches(':modal'), fits: box.left >= 0 && box.right <= innerWidth && box.top >= 0 && box.bottom <= innerHeight, overflows: element.scrollWidth > element.clientWidth, imageLoaded: image.complete && image.naturalWidth > 0, imageAlt: image.alt, hash: location.hash }
      })
      assert(dialog.title)
      assert.equal(dialog.modal, true)
      assert.equal(dialog.fits, true, JSON.stringify(dialog))
      assert.equal(dialog.overflows, false)
      assert.equal(dialog.imageLoaded, true)
      assert(dialog.imageAlt)
      const focusableCount = await page.$$eval('dialog[open] button,dialog[open] a[href],dialog[open] [tabindex="0"]', elements => elements.length)
      for (let i = 0; i <= focusableCount; i++) {
        await page.keyboard.press('Tab')
        assert(await page.evaluate(() => document.activeElement === document.body || !!document.activeElement.closest('dialog[open]')), 'Modal focus escaped to a background control')
      }
      if (name === triggers[0]) await page.screenshot({ path: path.join(artifacts, `company-${name.includes('인터뷰') ? 'interview' : 'preview'}-dialog-${width}.png`) })
      await page.keyboard.press('Escape')
      await page.waitForFunction(() => !document.querySelector('dialog[open]'))
      await page.waitForFunction(expected => (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()) === expected, {}, name)
      assert.equal(new URL(page.url()).hash, '')
      report.dialogs.push({ viewport: width, trigger: name, ...dialog, cancel: 'Escape', focusRestore: 'pass', focusTrap: 'Background controls remain inert; native modal tab cycle passes' })
    }
  }

  await page.setViewport({ width: 390, height: 844 })
  await loadCompany()
  await page.keyboard.press('Tab')
  let focus = await activeFocus()
  assert.equal(focus.href, '#company-main')
  assert.equal(focus.outline, 'solid')
  assert(await page.evaluate(() => document.activeElement.getBoundingClientRect().top >= 0))
  report.keyboard.push(focus)
  await page.screenshot({ path: path.join(artifacts, 'company-keyboard-focus.png') })
  await page.keyboard.press('Enter')
  assert.equal(await page.evaluate(() => document.activeElement.id), 'company-main')

  // Derive the traversal bound from rendered controls rather than assuming a fixed tab count.
  await loadCompany()
  const controlCount = await page.$$eval('.company-page a[href],.company-page button,.company-page summary', elements => elements.filter(element => element.getClientRects().length && !element.closest('dialog:not([open])')).length)
  const tabSequence = []
  for (let i = 0; i <= controlCount; i++) {
    await page.keyboard.press('Tab')
    tabSequence.push(await activeFocus())
  }
  assert(tabSequence.some(item => item.href === 'mailto:hello@dear-log.com'))
  assert(tabSequence.some(item => item.href === '/company/fonts/README.txt'))
  assert(tabSequence.some(item => item.tag === 'SUMMARY'))
  assert(tabSequence.filter(item => item.href || item.tag === 'BUTTON' || item.tag === 'SUMMARY').every(item => item.outline === 'solid'), JSON.stringify(tabSequence))
  report.keyboard.push({ tabSequence })

  await loadCompany()
  await page.$eval('.company-service-link', element => element.focus())
  await page.keyboard.press('Enter')
  await page.waitForFunction(() => location.hash === '#company-sample')
  assert(await page.$('.company-page'), 'Sample stays on the public company page')
  assert.equal(await page.$eval('.company-hero-actions .company-text-link', element => element.getAttribute('href')), 'mailto:hello@dear-log.com')
  report.keyboard.push({ sampleCTA: 'Enter opens fictional sample; secondary CTA is mailto' })
  await page.goBack({ waitUntil: 'networkidle0' })
  assert(await page.$('.company-page'), 'Browser back from sample keeps company')
  report.routes.push({ route: 'company → sample → browser Back → company', result: 'pass' })

  await loadCompany()
  const anchorTargets = await page.$$eval('.company-nav a[href^="#"],.company-hero-actions a[href^="#"]', links => [...new Set(links.map(link => link.getAttribute('href')))])
  for (const target of anchorTargets) {
    await loadCompany()
    await page.click(`a[href=${JSON.stringify(target)}]:not(.company-skip)`)
    const top = await page.evaluate(id => document.getElementById(id).getBoundingClientRect().top, target.slice(1))
    assert(top >= -1 && top < 120, `${target}: ${top}`)
    report.routes.push({ anchor: target, top })
  }
  await loadCompany()
  const summaries = await page.$$('details summary')
  assert(summaries.length > 0, 'FAQ details missing')
  for (const summary of summaries) {
    await summary.focus()
    await page.keyboard.press('Enter')
    assert(await summary.evaluate(element => element.parentElement.open))
    report.faq.push({ question: await summary.evaluate(element => element.textContent.trim()), keyboardOpen: 'pass' })
    await page.keyboard.press('Enter')
    assert.equal(await summary.evaluate(element => element.parentElement.open), false)
  }

  const triggerName = '인터뷰 화면 크게 보기'
  for (const method of ['close-button', 'backdrop', 'browser-back']) {
    await loadCompany()
    await clickNamedButton(triggerName)
    await page.waitForSelector('dialog[open]')
    if (method === 'close-button') {
      const close = await page.$('dialog[open] button[aria-label="화면 확대 닫기"]') || await page.$('dialog[open] button')
      assert(close)
      await close.click()
    } else if (method === 'backdrop') {
      const box = await page.$eval('dialog[open]', element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top } })
      assert(box.left > 2 || box.top > 2, 'No exposed backdrop point')
      await page.mouse.click(box.left > 2 ? 1 : 195, box.left > 2 ? 422 : 1)
    } else await page.goBack()
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    await page.waitForFunction(expected => (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()) === expected, {}, triggerName)
    assert.equal(new URL(page.url()).hash, '')
    report.dialogs.push({ cancel: method, focusRestore: 'pass', path: new URL(page.url()).pathname })
  }
  // Directly entered image hash must cancel without navigating away from company.
  await loadCompany('#company-image-review')
  await page.waitForSelector('dialog[open]')
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  assert.equal(new URL(page.url()).pathname, '/company')
  assert.equal(new URL(page.url()).hash, '')
  report.dialogs.push({ directHash: 'pass', cancel: 'Escape', staysOnCompany: true })

  await loadCompany('#company-image-unknown')
  assert.equal(await page.$('dialog[open]'), null, 'Unknown image hash must not open a modal')
  assert.equal(new URL(page.url()).pathname, '/company')
  report.dialogs.push({ unknownHash: 'ignored safely' })
  // Repeat Back/Forward and cancellation, starting from a real sample anchor.
  for (let cycle = 0; cycle < 3; cycle++) {
    await loadCompany('#company-sample')
    await clickNamedButton(triggerName)
    await page.waitForSelector('dialog[open]')
    await page.goBack()
    await page.waitForFunction(() => !document.querySelector('dialog[open]'))
    assert.equal(new URL(page.url()).hash, '#company-sample')
    await page.goForward()
    await page.waitForSelector('dialog[open]')
    assert.equal(new URL(page.url()).hash, '#company-image-interview')
    if (cycle % 2) await page.keyboard.press('Escape')
    else await page.click('dialog[open] button[aria-label="화면 확대 닫기"]')
    await page.waitForFunction(() => !document.querySelector('dialog[open]') && location.hash === '#company-sample')
    await page.waitForFunction(expected => (document.activeElement.getAttribute('aria-label') || document.activeElement.textContent.trim()) === expected, {}, triggerName)
    assert.equal(await page.evaluate(() => document.body.style.overflow), '', 'Cancellation must unlock background scrolling')
    report.dialogs.push({ cycle: cycle + 1, backForwardCancel: 'pass', anchorRestore: '#company-sample', focusRestore: 'pass', scrollUnlock: 'pass' })
  }

  for (const route of ['/company', '/company/', '/company?source=qa']) {
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle0' })
    await page.reload({ waitUntil: 'networkidle0' })
    assert(await page.$('.company-page'))
    report.routes.push({ route, directAndRefresh: 'pass' })
  }
  assert.equal(report.blockedApiRequests.length, 0, 'Company page must not issue API requests')
  for (const route of ['/', '/auth', '/auth/verify', '/parent', '/child', '/calendar', '/parent/autologin']) {
    await page.goto(`${origin}${route}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.querySelector('#root').textContent.length > 0 && !document.querySelector('[role="status"]'))
    if (route === '/') await page.waitForFunction(() => location.pathname === '/splash')
    if (['/parent', '/child', '/calendar'].includes(route)) await page.waitForFunction(() => location.pathname === '/auth')
    const state = await page.evaluate(() => ({ path: location.pathname, mobileLayout: !!document.querySelector('.max-w-\\[390px\\]'), text: document.querySelector('#root').textContent.slice(0, 100) }))
    assert(state.mobileLayout, `${route} must retain service mobile layout`)
    report.routes.push({ route, ...state })
  }
  await loadCompany()
  await page.evaluate(() => {
    sessionStorage.setItem('dearlog-auth', JSON.stringify({ state: { role: 'parent', userName: 'QA fictional fixture', userId: 'company-qa', phoneNumber: '', authToken: null }, version: 0 }))
    const now = new Date()
    localStorage.setItem('dearlog-scheduled-call', JSON.stringify({ state: { scheduledTime: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`, scheduledDays: [now.getDay()], isEnabled: true, lastCallDate: null }, version: 0 }))
  })
  const storage = () => page.evaluate(() => ({ auth: sessionStorage.getItem('dearlog-auth'), schedule: localStorage.getItem('dearlog-scheduled-call') }))
  const before = await storage(), apiBefore = report.blockedApiRequests.length
  await page.reload({ waitUntil: 'networkidle0' })
  assert.deepEqual(await storage(), before)
  assert.equal(new URL(page.url()).pathname, '/company')
  assertCompanyOffline(apiBefore)
  report.notes.push('Fictional local browser auth/schedule state unchanged. Company route does not run service monitors or APIs.')
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  assert.equal(await page.$eval('.company-service-link', element => getComputedStyle(element).transitionDuration), '0s')
  report.notes.push('Reduced motion disables CTA transitions.')
  assert.equal(report.errors.length, 0, report.errors.join('\n'))
  report.notes.push('All API requests blocked. No production data, login/signup transaction, SMS, live recording, mail delivery or policy/legal guarantee tested.')
  await fs.writeFile(path.join(artifacts, 'qa-report.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify({ widths: report.widths.map(state => ({ viewport: state.viewport, documentWidth: state.documentWidth, minContrast: state.minimumTextContrast })), keyboard: 'pass', dialogs: report.dialogs.length, faq: report.faq.length, routes: report.routes.length, pageErrors: report.errors.length, blockedApiRequests: report.blockedApiRequests.length }, null, 2))
} catch (error) {
  await fs.writeFile(path.join(artifacts, 'qa-failure.json'), JSON.stringify({ ...report, failure: error.stack }, null, 2))
  throw error
} finally {
  await browser.close()
  await fs.rm(profile, { recursive: true, force: true })
}
