// Local fixture captures only. This script never connects to an existing browser.
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import puppeteer from 'puppeteer-core'

const origin = 'http://127.0.0.1:4329'
const directory = path.resolve('public/company')
const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'dearlog-company-edge-'))
const browser = await puppeteer.launch({
  executablePath: '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  headless: true,
  userDataDir: profile,
  args: ['--no-first-run', '--disable-extensions', '--disable-background-networking'],
})

try {
  const page = await browser.newPage()
  await page.setViewport({ width: 390, height: 720, deviceScaleFactor: 2 })
  await page.setRequestInterception(true)
  page.on('request', request => {
    const url = request.url()
    if ((url.startsWith(origin) && !new URL(url).pathname.startsWith('/api')) || /^(data|blob):/.test(url)) request.continue()
    else request.abort()
  })
  await page.goto(`${origin}/company`, { waitUntil: 'networkidle0' })
  await page.evaluate(async () => {
    const { useAuthStore } = await import('/src/store/authStore.ts')
    const { useInterviewStore } = await import('/src/store/interviewStore.ts')
    const { useChildStore } = await import('/src/store/childStore.ts')
    const { useAutobiographyStore } = await import('/src/store/autobiographyStore.ts')
    const { useConsentStore } = await import('/src/store/consentStore.ts')
    const { useDevModeStore } = await import('/src/store/devModeStore.ts')
    const { CHAPTERS } = await import('/src/lib/chapters.ts')
    const questions = [
      { id: 'company-q1', text: '처음 일을 시작한 날은 어땠나요?', chapterId: 'youth', completed: false, category: 'guardian_questions', createdAt: '2026-10-01' },
      { id: 'company-q2', text: '어린 시절 가장 좋아했던 놀이는 무엇인가요?', chapterId: 'childhood', completed: false, category: 'guardian_questions', createdAt: '2026-10-01' },
      { id: 'company-q3', text: '가족과 함께한 날 중 가장 기억나는 날은 언제인가요?', chapterId: 'family_home', completed: false, category: 'guardian_questions', createdAt: '2026-10-01' },
    ]
    const text = '첫 월급을 받던 날, 집에 가는 길에 빵을 샀어요. 가족하고 나눠 먹고 싶었거든요. 그날 저녁, 함께 앉아 웃던 시간이 아직도 생각납니다.'
    const transcript = { id: 'company-record', questionId: 'company-q1', questionText: questions[0].text, chapterId: 'youth', chapterTitle: '청년 시절', originalText: text, aiSummary: '첫 월급으로 빵을 사서 가족과 나누었다. 함께 앉아 웃던 저녁은 오래도록 기억에 남았다.', mode: 'voice', reviewStatus: 'applied', recordedAt: '2026-10-01', publish: true, familyRead: true, chatbot: false }
    useAuthStore.setState({ role: 'parent', userName: '예시 부모님', userId: 'demo_senior', phoneNumber: '', authToken: null })
    useDevModeStore.setState({ isOfflineDemo: true, isDemoMode: true, demoSeededAt: '2026-10-01' })
    useInterviewStore.setState({ chapters: CHAPTERS.map(chapter => ({ ...chapter, questions: questions.filter(question => question.chapterId === chapter.id) })), transcripts: [transcript] })
    useChildStore.setState({ activeSeniorId: 'demo_senior', photos: [], questions: [] })
    useConsentStore.setState({ consents: { 'company-record': { publish: true, chatbot: false, familyRead: true, posthumous: false, sensitive: false } } })
    useAutobiographyStore.setState({ chapters: [{ chapterId: 'youth', chapterTitle: '첫 월급을 나누던 저녁', paragraphs: [{ paragraphId: 'company-p1', text, sourceChunkIds: ['company-record'], reliability: 'CONFIRMED' }], missingSections: [], toneProfile: { name: '이야기책 형태', patterns: [] } }] })
  })
  for (const [route, filename, prepare] of [
    ['/parent/interview', 'interview.png', 'interview'],
    ['/parent/transcript', 'review.png', 'review'],
    ['/parent/autobiography', 'autobiography.png', null],
  ]) {
    await page.goto(`${origin}${route}`, { waitUntil: 'networkidle0' })
    // Existing product typography is served from its existing local font for offline QA.
    await page.addStyleTag({ content: "@font-face { font-family: 'Noto Sans KR'; src: url('/fonts/NotoSansKR-Regular.ttf'); font-weight: 100 900; font-display: swap; }" })
    await page.evaluate(() => document.fonts.ready)
    if (prepare === 'interview') {
      await page.evaluate(() => {
        const question = [...document.querySelectorAll('article')].find(element => element.textContent.includes('처음 일을 시작한 날') && element.textContent.includes('답하기'))
        if (!question) throw new Error('Fixture question not rendered')
        question.querySelector('button')?.click()
      })
      await page.waitForFunction(() => document.querySelector('[aria-label="녹음 시작"]'))
    }
    if (prepare === 'review') {
      await page.evaluate(() => {
        const button = [...document.querySelectorAll('button')].find(element => element.textContent.includes('첫 월급') && element.textContent.includes('보기'))
        if (!button) throw new Error('Fixture transcript not rendered')
        button.click()
      })
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(element => element.textContent.trim() === '원문'))
    }
    await page.screenshot({ path: path.join(directory, filename), fullPage: false })
    console.log(`Captured actual product UI with fictional fixture: ${route} → ${filename}`)
  }
} finally {
  await browser.close()
  await fs.rm(profile, { recursive: true, force: true })
}
