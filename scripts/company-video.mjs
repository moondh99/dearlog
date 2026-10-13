#!/usr/bin/env node
// 회사 페이지용 서비스 사용 영상을 만든다: node scripts/company-video.mjs
//   → public/company/service-demo.mp4, public/company/service-demo-poster.jpg
// 데모 DB 를 임시 폴더에 복사해 별도 데모 서버(8791)를 띄우고, Chrome 화면을 녹화한다.
// 8790 데모와 그 DB 는 건드리지 않는다. ffmpeg 없이 Chrome 의 MediaRecorder 로 mp4(H.264)를 만든다.
// 사전 조건: npm run demo:build 로 dist-demo 가 있고, 데모 DB(server/demo-data)에 책 미리보기 캐시가 만들어져 있을 것
//           (캐시를 복사해 쓰므로 미리보기용 AI 는 다시 부르지 않는다. 답변 저장 장면만 AI 를 한 번 부른다).
// 영상 속 이름·이야기는 모두 가상이다.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import puppeteer from 'puppeteer-core'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const out = path.join(root, 'public', 'company')
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 8791
const BASE = `http://localhost:${PORT}`
const W = 390
const H = 844
const CAPTION_H = 84
const ANSWER = '어릴 때는 동네 아이들이랑 고무줄놀이를 하다가 해가 지는 줄도 몰랐어요. 어머니가 저녁 먹으라고 부르시면 그제야 집으로 달려갔지요.'
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

// ── 임시 데모 서버 ────────────────────────────────────────────────────────────
const source = path.join(root, 'server', 'demo-data')
if (!fs.existsSync(path.join(source, 'demo.db'))) throw new Error('server/demo-data 가 없습니다. npm run demo:server 와 demo:prewarm 을 먼저 하세요.')
if (!fs.existsSync(path.join(root, 'dist-demo', 'index.html'))) throw new Error('dist-demo 가 없습니다. npm run demo:build 를 먼저 하세요.')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'dearlog-demo-video-'))
fs.cpSync(source, tmp, { recursive: true })
const server = spawn('npx', ['tsx', 'server/demo.ts'], { cwd: root, env: { ...process.env, DEMO_DIR: tmp, DEMO_PORT: String(PORT) }, stdio: 'ignore' })
const cleanup = () => { server.kill(); fs.rmSync(tmp, { recursive: true, force: true }) }
process.on('exit', cleanup)

async function waitForServer() {
  for (let i = 0; i < 60; i += 1) {
    try { if ((await fetch(`${BASE}/demo`, { headers: { Accept: 'text/html' } })).ok) return } catch { /* 아직 안 떴다 */ }
    await sleep(500)
  }
  throw new Error('임시 데모 서버가 뜨지 않았습니다.')
}

// ── 화면 조작 도구 ────────────────────────────────────────────────────────────
const find = (page, text, selector) => page.evaluateHandle((t, s) => [...document.querySelectorAll(s)].find((el) => el.textContent.includes(t) && el.offsetParent !== null) ?? null, text, selector)
async function waitText(page, text, selector = 'button,a,[role=button],[role=tab],h1,h2,h3,p', timeout = 30000) {
  const end = Date.now() + timeout
  while (Date.now() < end) {
    const el = (await find(page, text, selector)).asElement()
    if (el) return el
    await sleep(200)
  }
  throw new Error(`화면에서 "${text}" 를 찾지 못했습니다: ${page.url()}`)
}
let pointer = { x: W / 2, y: H - 120 }
async function tapElement(page, el) {
  await el.evaluate((node) => node.scrollIntoView({ block: 'center', behavior: 'instant' }))
  await sleep(150)
  const box = await el.boundingBox()
  const to = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  await page.mouse.move(to.x, to.y, { steps: 18 })
  pointer = to
  await sleep(220)
  await page.mouse.down()
  await sleep(60)
  await page.mouse.up()
}
const tap = async (page, text, selector = 'button,a,[role=button],[role=tab]') => tapElement(page, await waitText(page, text, selector))
async function scrollBy(page, dy, ms = 900) {
  const steps = 24
  for (let i = 0; i < steps; i += 1) { await page.evaluate((d) => window.scrollBy(0, d), dy / steps); await sleep(ms / steps) }
}
async function startAs(page, role) { // 녹화 밖에서 데모 계정으로 들어간다
  await page.goto(`${BASE}/demo`)
  await tap(page, role === 'parent' ? '부모님(김영자)' : '보호자(이지은)', 'button')
  await page.waitForFunction((r) => location.pathname === (r === 'parent' ? '/parent' : '/child'), {}, role)
}

// ── 녹화 ─────────────────────────────────────────────────────────────────────
async function record(page, scene) {
  const client = await page.createCDPSession()
  const frames = []
  client.on('Page.screencastFrame', ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp * 1000, data })
    client.send('Page.screencastFrameAck', { sessionId }).catch(() => {})
  })
  const shot = async () => frames.push({ t: Date.now(), data: await page.screenshot({ type: 'jpeg', quality: 85, encoding: 'base64' }) })
  await client.send('Page.startScreencast', { format: 'jpeg', quality: 85, everyNthFrame: 1 })
  await shot()
  await scene.run(page)
  await sleep(500)
  await shot()
  await client.send('Page.stopScreencast')
  await client.detach()
  frames.sort((a, b) => a.t - b.t)
  const t0 = frames[0].t
  return { caption: scene.caption, step: scene.step, frames: frames.map((f) => ({ t: f.t - t0, data: f.data })) }
}

const scenes = {
  book: {
    step: '3 / 3', caption: '모인 이야기를 한 권의 기록집으로 엮습니다',
    async run(page) {
      await sleep(2200)
      await scrollBy(page, 330)
      await sleep(1800)
      await scrollBy(page, -330, 700)
      await sleep(900)
    },
  },
  answer: {
    step: '1 / 3', caption: '부모님이 질문에 편하게 답합니다',
    async run(page) {
      await sleep(1400)
      await tap(page, '지금 시작하기')
      await sleep(900)
      await tap(page, '기록하기')
      await waitText(page, '기록할 이야기를 골라주세요')
      await sleep(900)
      await tap(page, '답하기')
      const input = await waitText(page, '', 'textarea')
      await sleep(900)
      await tapElement(page, input)
      await page.keyboard.type(ANSWER, { delay: 55 })
      await sleep(900)
      await tap(page, '저장')
      await waitText(page, '저장됨', '*', 60000)
      await sleep(1600)
    },
  },
  review: {
    step: '2 / 3', caption: '가족이 원문과 정리본을 함께 확인합니다',
    async run(page) {
      await sleep(1200)
      await tap(page, '새 기록 확인하기')
      await waitText(page, '검수하러 가기')
      await sleep(900)
      await tap(page, '검수하러 가기')
      await waitText(page, '검수가 필요한 이야기')
      await sleep(1000)
      await tap(page, '확인하기')
      await waitText(page, '정리본')
      await sleep(1400)
      await tap(page, '원문', '[role=tab],button')
      await sleep(1600)
      await tap(page, '정리본', '[role=tab],button')
      await sleep(1400)
    },
  },
}

// ── 인코딩(Chrome 의 MediaRecorder) ─────────────────────────────────────────────
async function encode(browser, parts) {
  const page = await browser.newPage()
  await page.goto('about:blank')
  const timeline = []
  let at = 0
  let lastPartStart = 0
  for (const part of parts) {
    lastPartStart = at
    for (const f of part.frames) timeline.push({ t: at + f.t, data: f.data, caption: part.caption, step: part.step })
    at += part.frames.at(-1).t + 250
  }
  await page.evaluate(() => { window.__frames = [] })
  for (let i = 0; i < timeline.length; i += 40) await page.evaluate((chunk) => window.__frames.push(...chunk), timeline.slice(i, i + 40))
  const result = await page.evaluate(async (w, h, capH, posterAt) => {
    const frames = window.__frames
    const canvas = Object.assign(document.createElement('canvas'), { width: w, height: h + capH })
    const ctx = canvas.getContext('2d')
    const bitmap = async (b64) => createImageBitmap(await (await fetch(`data:image/jpeg;base64,${b64}`)).blob())
    const draw = (img, frame) => {
      // 자막 띠는 위에 둔다: 아래에 두면 브라우저 재생 컨트롤이 가린다.
      ctx.fillStyle = '#F8F6F9'; ctx.fillRect(0, capH, w, h)
      ctx.drawImage(img, 0, capH, w, h)
      ctx.fillStyle = '#2A2830'; ctx.fillRect(0, 0, w, capH)
      ctx.fillStyle = '#B9ABE0'; ctx.font = '600 12px "Apple SD Gothic Neo", sans-serif'; ctx.textBaseline = 'alphabetic'
      ctx.fillText(`${frame.step}  ·  가상 가족 데모`, 20, 32)
      ctx.fillStyle = '#FFFFFF'; ctx.font = '600 16px "Apple SD Gothic Neo", sans-serif'
      ctx.fillText(frame.caption, 20, 58)
    }
    const mime = 'video/mp4;codecs=avc1.42E01E'
    const recorder = new MediaRecorder(canvas.captureStream(30), { mimeType: mime, videoBitsPerSecond: 900000 })
    const chunks = []
    recorder.ondataavailable = (e) => chunks.push(e.data)
    const done = new Promise((resolve) => { recorder.onstop = resolve })
    let current = await bitmap(frames[0].data)
    let index = 0
    let poster = null
    draw(current, frames[0])
    recorder.start(1000)
    const start = performance.now()
    const last = frames.at(-1).t
    while (performance.now() - start <= last + 400) {
      const now = performance.now() - start
      let next = index
      while (next + 1 < frames.length && frames[next + 1].t <= now) next += 1
      if (next !== index) { index = next; current = await bitmap(frames[index].data) }
      draw(current, frames[index])
      if (!poster && now >= posterAt) poster = canvas.toDataURL('image/jpeg', 0.88)
      await new Promise((resolve) => setTimeout(resolve, 33))
    }
    recorder.stop()
    await done
    const buffer = await new Blob(chunks, { type: mime }).arrayBuffer()
    let binary = ''
    const bytes = new Uint8Array(buffer)
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
    return { video: btoa(binary), poster, seconds: Math.round(last / 100) / 10 }
  }, W, H, CAPTION_H, lastPartStart + 1800) // 포스터: 마지막(책) 장면의 첫 화면
  await page.close()
  return result
}

// ── 실행 ─────────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({
  executablePath: CHROME, headless: true, defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
  args: ['--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--lang=ko-KR'],
})
try {
  await waitForServer()
  const page = await browser.newPage()
  await page.evaluateOnNewDocument(() => { // 손가락으로 누른 곳을 보여 주는 물결, 스크롤바 숨김
    addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style')
      style.textContent = '::-webkit-scrollbar{display:none}@keyframes tap-ripple{from{transform:translate(-50%,-50%) scale(.3);opacity:.55}to{transform:translate(-50%,-50%) scale(1.5);opacity:0}}'
      document.head.append(style)
    })
    addEventListener('pointerdown', (e) => {
      const dot = document.createElement('div')
      dot.style.cssText = `position:fixed;left:${e.clientX}px;top:${e.clientY}px;width:44px;height:44px;border-radius:50%;background:#9485BE;pointer-events:none;z-index:99999;animation:tap-ripple .6s ease-out forwards`
      document.body.append(dot)
      setTimeout(() => dot.remove(), 700)
    }, true)
  })
  // 책 장면을 먼저 찍는다: 새 답변을 저장하면 미리보기 캐시가 달라지기 때문이다.
  await startAs(page, 'child')
  await page.goto(`${BASE}/child/autobiography/preview`)
  await waitText(page, '기록집 검수')
  const book = await record(page, scenes.book)
  await startAs(page, 'parent')
  const answer = await record(page, scenes.answer)
  await startAs(page, 'child')
  const review = await record(page, scenes.review)
  console.log('장면 녹화 완료. 인코딩 중(영상 길이만큼 걸립니다)…')
  const { video, poster, seconds } = await encode(browser, [answer, review, book])
  fs.mkdirSync(out, { recursive: true })
  fs.writeFileSync(path.join(out, 'service-demo.mp4'), Buffer.from(video, 'base64'))
  fs.writeFileSync(path.join(out, 'service-demo-poster.jpg'), Buffer.from(poster.split(',')[1], 'base64'))
  console.log(`완료: public/company/service-demo.mp4 (${seconds}초, ${(Buffer.byteLength(video, 'base64') / 1e6).toFixed(1)}MB)`)
} finally {
  await browser.close()
  cleanup()
}
