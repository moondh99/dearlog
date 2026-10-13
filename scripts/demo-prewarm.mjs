#!/usr/bin/env node
// 발표 전에 한 번 돌려 둔다: 자서전 미리보기(캐시)와 PDF 를 데모 서버에 미리 만든다.
// 새로 만들면 미리보기가 몇 분, 최악엔 10분 걸리거나 실패할 수 있어서 발표 중에 누르지 않는다.
// 사용: npm run demo:server (다른 터미널) → npm run demo:prewarm
const base = process.env.DEMO_URL ?? 'http://localhost:8790'
const call = async (method, path, token, body) => {
  const response = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  })
  return { status: response.status, body: await response.json().catch(() => ({})) }
}

const { body: session } = await call('POST', '/api/demo/session', null, { role: 'child' })
const token = session.authToken
if (!token) throw new Error('데모 서버에 연결하지 못했습니다. npm run demo:server 가 켜져 있나요?')

const started = Date.now()
let { body } = await call('POST', '/api/publication-preview-jobs', token, { seniorId: 'demo_senior' })
let job = body.job
while (job.status !== 'ready' && job.status !== 'failed' && Date.now() - started < 15 * 60_000) {
  await new Promise((resolve) => setTimeout(resolve, 10_000))
  ;({ body } = await call('GET', `/api/publication-preview-jobs/${job.id}`, token))
  job = body.job ?? body
  console.log(`${Math.round((Date.now() - started) / 1000)}초 ${job.status}`)
}
if (job.status !== 'ready') throw new Error(`미리보기가 끝나지 않았습니다: ${job.status} ${job.errorCode ?? ''}`)

const pdf = await call('POST', '/api/publication-requests', token, { seniorId: 'demo_senior' })
console.log(`미리보기와 PDF 준비 완료 (HTTP ${pdf.status}). 기록을 바꾸면 미리보기 캐시가 사라지니 다시 실행하세요.`)
