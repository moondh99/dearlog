import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LegacyReviewScreen from './LegacyReviewScreen'
import { splitSecret } from '../lib/security/shamir'
import { encryptText } from '../lib/security/encryption'
import { useAuthStore } from '../store/authStore'

// 보호자 사망 심사 화면이 서버 절차를 실제로 부르는지 확인한다.
//
// local-server 를 통째로 대신 세우지 않고 fetch 만 세워 둔다. 컴포넌트 안의
// `await import('../lib/local-server')` 는 모듈 mock 을 받지 않기 때문이기도 하고,
// 마지막 시나리오(세 조각을 다시 모아 복호화)가 실제 암호로 돌아야 의미가 있기 때문이다.

const RECORD_TEXT = '아이들과 강가에서 물장구치던 여름이 생생합니다.'

let vault: any
let requests: Array<{ method: string; path: string }> = []
let sharesResponse: { serverShare: string; institutionShare: string }
let familyShare = ''
let nextError: { path: string; status: number; error: string } | null = null

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response
}

function fakeFetch(input: any, init: any = {}) {
  const path = String(input).replace(/^https?:\/\/[^/]+/, '')
  const method = (init.method ?? 'GET').toUpperCase()
  requests.push({ method, path })

  if (nextError && path.startsWith(nextError.path)) {
    const { status, error } = nextError
    nextError = null
    return Promise.resolve(jsonResponse({ error }, status))
  }

  if (path.startsWith('/api/legacy/vault')) {
    return Promise.resolve(jsonResponse({ vault }))
  }
  if (path.startsWith('/api/legacy/trigger-death')) {
    vault = {
      ...vault,
      deathVerificationStatus: 'pending_verification',
      deathTriggeredById: 'guardian-1',
      deathTriggeredAt: new Date().toISOString(),
      deathReviewRemainingMs: 72 * 60 * 60 * 1000,
    }
    return Promise.resolve(jsonResponse({ vault, notification: null }))
  }
  if (path.startsWith('/api/legacy/approve-death')) {
    vault = { ...vault, deathVerificationStatus: 'released', deathReviewRemainingMs: 0 }
    return Promise.resolve(jsonResponse({ vault, notification: null }))
  }
  if (path.startsWith('/api/legacy/cancel-death')) {
    vault = {
      ...vault,
      deathVerificationStatus: 'alive',
      deathTriggeredById: null,
      deathTriggeredAt: null,
      deathReviewRemainingMs: 0,
    }
    return Promise.resolve(jsonResponse({ vault }))
  }
  if (path.startsWith('/api/legacy/shares')) {
    return Promise.resolve(jsonResponse(sharesResponse))
  }
  return Promise.resolve(jsonResponse({}))
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/child/legacy']}>
      <LegacyReviewScreen />
    </MemoryRouter>,
  )
}

// 어르신 쪽 금고 화면이 만들어 냈을 상태를 그대로 만든다: 3-of-3 분할, 가족 조각은
// 서버에 없고, 서버가 나머지 둘을 들고 있다.
async function buildReleasedVault() {
  const key = 'a'.repeat(64)
  const [family, server, institution] = splitSecret(key, 3, 3)
  familyShare = JSON.stringify(family)
  sharesResponse = {
    serverShare: JSON.stringify(server),
    institutionShare: JSON.stringify(institution),
  }
  vault = {
    isVaultSetup: true,
    deathVerificationStatus: 'released',
    deathReviewRemainingMs: 0,
    encryptedMemories: await encryptText(JSON.stringify([{ transcriptText: RECORD_TEXT }]), key),
  }
}

describe('LegacyReviewScreen', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({ role: 'child', userId: 'guardian-1', authToken: 'token' } as any)
    window.localStorage.setItem(
      'dearlog-auth',
      JSON.stringify({ state: { role: 'child', userId: 'guardian-1', authToken: 'token' } }),
    )
    vault = { isVaultSetup: true, deathVerificationStatus: 'alive', deathReviewRemainingMs: 0 }
    requests = []
    nextError = null
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('금고가 없으면 신고할 것이 없다고 알려준다', async () => {
    vault = { isVaultSetup: false }
    renderScreen()

    expect(await screen.findByText('아직 금고가 없습니다')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '사망 신고하기' })).not.toBeInTheDocument()
  })

  it('사망 신고는 한 번 더 확인한 뒤에 보낸다', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: '사망 신고하기' }))
    // 확인 단계 없이 바로 나가면 오탭 한 번으로 살아 계신 분의 심사가 시작된다.
    expect(requests.some((r) => r.path.startsWith('/api/legacy/trigger-death'))).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: '신고하기' }))

    expect(await screen.findByText('사망 심사가 진행 중입니다')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST' && r.path.startsWith('/api/legacy/trigger-death'))).toBe(true)
  })

  it('유예 기간이 남아 있으면 승인 버튼을 누를 수 없다', async () => {
    vault = {
      isVaultSetup: true,
      deathVerificationStatus: 'pending_verification',
      deathTriggeredById: 'guardian-2',
      deathTriggeredAt: new Date().toISOString(),
      deathReviewRemainingMs: 10 * 60 * 60 * 1000,
    }
    renderScreen()

    expect(await screen.findByText('10시간 뒤에 승인할 수 있습니다.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '승인하기' })).toBeDisabled()
  })

  it('내가 신고했으면 다른 가족이 승인해야 한다고 알려준다', async () => {
    vault = {
      isVaultSetup: true,
      deathVerificationStatus: 'pending_verification',
      deathTriggeredById: 'guardian-1',
      deathTriggeredAt: new Date().toISOString(),
      deathReviewRemainingMs: 0,
    }
    renderScreen()

    expect(await screen.findByText('내가 신고했습니다.', { exact: false })).toBeInTheDocument()
    expect(screen.getByText('신고한 분은 승인할 수 없습니다.', { exact: false })).toBeInTheDocument()
  })

  it('서버가 승인을 거절하면 그 이유를 그대로 보여준다', async () => {
    vault = {
      isVaultSetup: true,
      deathVerificationStatus: 'pending_verification',
      deathTriggeredById: 'guardian-1',
      deathTriggeredAt: new Date().toISOString(),
      deathReviewRemainingMs: 0,
    }
    // 보호자 수 규칙은 서버에만 있다. 화면이 자기 판단으로 문구를 지어내면
    // 서버 규칙이 바뀌었을 때 조용히 거짓말을 한다.
    nextError = { path: '/api/legacy/approve-death', status: 403, error: '신고한 분과 다른 가족이 승인해야 합니다.' }
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: '승인하기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('신고한 분과 다른 가족이 승인해야 합니다.')
  })

  it('심사를 취소하면 다시 보관 중으로 돌아간다', async () => {
    vault = {
      isVaultSetup: true,
      deathVerificationStatus: 'pending_verification',
      deathTriggeredById: 'guardian-2',
      deathTriggeredAt: new Date().toISOString(),
      deathReviewRemainingMs: 0,
    }
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: '심사 취소하기' }))

    expect(await screen.findByText('보관 중')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST' && r.path.startsWith('/api/legacy/cancel-death'))).toBe(true)
  })

  it('전수된 뒤 가족 조각을 넣으면 기록이 열린다', async () => {
    await buildReleasedVault()
    renderScreen()

    fireEvent.change(await screen.findByLabelText('가족 열쇠 조각'), { target: { value: familyShare } })
    fireEvent.click(screen.getByRole('button', { name: '기록 열기' }))

    expect(await screen.findByText(RECORD_TEXT)).toBeInTheDocument()
  })

  it('유예가 딱 떨어지면 "3일 0시간"이라고 하지 않는다', async () => {
    vault = {
      isVaultSetup: true,
      deathVerificationStatus: 'pending_verification',
      deathTriggeredById: 'guardian-2',
      deathTriggeredAt: new Date().toISOString(),
      deathReviewRemainingMs: 72 * 60 * 60 * 1000,
    }
    renderScreen()

    // 기본 유예가 72시간이라 이게 가장 흔한 문구다.
    expect(await screen.findByText('3일 뒤에 승인할 수 있습니다.')).toBeInTheDocument()
  })

  it('한 번 연 뒤 조각을 잘못 넣으면 앞서 연 기록을 남겨 두지 않는다', async () => {
    await buildReleasedVault()
    const [wrongFamily] = splitSecret('c'.repeat(64), 3, 3)
    renderScreen()

    const input = await screen.findByLabelText('가족 열쇠 조각')
    fireEvent.change(input, { target: { value: familyShare } })
    fireEvent.click(screen.getByRole('button', { name: '기록 열기' }))
    await screen.findByText(RECORD_TEXT)

    // 실패 문구 아래에 직전에 연 본문이 그대로 붙어 있으면 열린 것으로 읽힌다.
    fireEvent.change(input, { target: { value: JSON.stringify(wrongFamily) } })
    fireEvent.click(screen.getByRole('button', { name: '기록 열기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('조각이 맞지 않아')
    await waitFor(() => expect(screen.queryByText(RECORD_TEXT)).not.toBeInTheDocument())
  })

  it('가족 조각이 틀리면 서버가 가진 두 조각만으로 열리지 않는다', async () => {
    await buildReleasedVault()
    // 남의 조각. 서버가 들고 있는 두 조각과 합쳐도 열려서는 안 된다.
    const [wrongFamily] = splitSecret('b'.repeat(64), 3, 3)
    renderScreen()

    fireEvent.change(await screen.findByLabelText('가족 열쇠 조각'), {
      target: { value: JSON.stringify(wrongFamily) },
    })
    fireEvent.click(screen.getByRole('button', { name: '기록 열기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('조각이 맞지 않아')
    await waitFor(() => expect(screen.queryByText(RECORD_TEXT)).not.toBeInTheDocument())
  })
})
