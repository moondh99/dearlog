import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import LegacyVaultScreen from './LegacyVaultScreen'
import { combineShares, type Share } from '../lib/security/shamir'
import { decryptText } from '../lib/security/encryption'

// 금고 화면이 실제로 금고를 여는지 확인한다.
// 서버 라우트는 처음부터 있었지만 이 화면이 없어서 isVaultSetup 이 true 가 될 길이 없었고,
// 동의 설정의 "사후 공개" 토글도 아무 일도 하지 않았다.
//
// local-server 를 통째로 대신 세우지 않고 fetch 만 세워 둔다. 분할·암호화가 실제로 돌아야
// 마지막 시나리오(세 조각을 다시 모아 복호화)가 의미를 가진다.

const RECORD_TEXT = '아이들과 강가에서 물장구치던 여름이 생생합니다.'

let vault: any = { isVaultSetup: false }
let requests: Array<{ method: string; path: string; body: any }> = []

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
  let body: any
  try {
    body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
  } catch {
    body = undefined
  }
  requests.push({ method, path, body })

  if (path.startsWith('/api/legacy/vault')) {
    if (method === 'POST') {
      vault = { isVaultSetup: true, deathVerificationStatus: 'alive' }
      return Promise.resolve(jsonResponse({ vault }, 201))
    }
    return Promise.resolve(jsonResponse({ vault }))
  }
  if (path.startsWith('/api/legacy/cancel-death')) {
    vault = { isVaultSetup: true, deathVerificationStatus: 'alive' }
    return Promise.resolve(jsonResponse({ vault }))
  }
  if (path.startsWith('/api/legacy/reset')) {
    vault = { isVaultSetup: false }
    return Promise.resolve(jsonResponse({ ok: true }))
  }
  if (path.startsWith('/api/interview-records')) {
    return Promise.resolve(jsonResponse({ records: [{ id: 'record-1', transcriptText: RECORD_TEXT }] }))
  }
  if (path.startsWith('/api/autobiography/draft')) {
    return Promise.resolve(jsonResponse({ draft: null }))
  }
  return Promise.resolve(jsonResponse({}))
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/parent/vault']}>
      <LegacyVaultScreen />
    </MemoryRouter>,
  )
}

function vaultPost() {
  return requests.find((r) => r.method === 'POST' && r.path.startsWith('/api/legacy/vault'))
}

async function openVaultAndCollectShares() {
  renderScreen()
  fireEvent.click(await screen.findByRole('button', { name: '금고 열기' }))
  await screen.findByText('가족 열쇠 조각')

  const posted = vaultPost()!
  const familyShare = JSON.parse(screen.getByText(/"x":/).textContent!) as Share
  return {
    familyShare,
    serverShare: JSON.parse(posted.body.serverShare) as Share,
    institutionShare: JSON.parse(posted.body.institutionShare) as Share,
    encryptedMemories: posted.body.encryptedMemories as string,
  }
}

describe('LegacyVaultScreen', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    window.localStorage.setItem(
      'dearlog-auth',
      JSON.stringify({ state: { role: 'parent', userId: 'senior-1', authToken: 'token' } }),
    )
    vault = { isVaultSetup: false }
    requests = []
    vi.stubGlobal('fetch', vi.fn(fakeFetch))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('금고가 없으면 아직 열지 않았다고 알려준다', async () => {
    renderScreen()

    expect(await screen.findByText('아직 열지 않음')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '금고 열기' })).toBeInTheDocument()
  })

  it('금고를 열면 암호문과 서버 조각 두 개를 보낸다', async () => {
    const { encryptedMemories, serverShare, institutionShare } = await openVaultAndCollectShares()

    // 평문이 그대로 실려 가면 금고가 아니다.
    expect(encryptedMemories).not.toContain('물장구')
    expect(serverShare.x).toBeGreaterThan(0)
    expect(institutionShare.x).not.toBe(serverShare.x)
    await waitFor(() => expect(screen.getByText('보관 중')).toBeInTheDocument())
  })

  it('가족 조각은 서버로 보내지 않는다', async () => {
    const { familyShare } = await openVaultAndCollectShares()

    // 가족 조각까지 서버가 들고 있으면 서버 혼자 금고를 열 수 있다.
    expect(JSON.stringify(vaultPost()!.body)).not.toContain(familyShare.data)
  })

  it('세 조각이 다 모여야 기록이 풀린다', async () => {
    const { familyShare, serverShare, institutionShare, encryptedMemories } = await openVaultAndCollectShares()

    const key = combineShares([familyShare, serverShare, institutionShare])
    const decrypted = await decryptText(encryptedMemories, key)
    expect(decrypted).toContain('물장구')

    // 서버가 들고 있는 두 조각만으로는 열리지 않아야 한다.
    const serverOnlyKey = combineShares([serverShare, institutionShare])
    expect(serverOnlyKey).not.toBe(key)
    await expect(decryptText(encryptedMemories, serverOnlyKey)).rejects.toThrow()
  })

  it('이미 열려 있으면 해지할 수 있다', async () => {
    vault = { isVaultSetup: true, deathVerificationStatus: 'alive' }
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: '금고 해지하기' }))
    fireEvent.click(screen.getByRole('button', { name: '해지하기' }))

    expect(await screen.findByText('아직 열지 않음')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST' && r.path.startsWith('/api/legacy/reset'))).toBe(true)
  })

  it('사망 심사 중이면 어르신 본인이 취소할 수 있다', async () => {
    vault = { isVaultSetup: true, deathVerificationStatus: 'pending_verification' }
    renderScreen()

    // 신고 알림은 "잘못된 신고라면 취소해 주세요"라고 한다. 여기에 버튼이 없으면
    // 그 알림은 알려 주기만 하고 아무것도 할 수 없는 문장이다.
    fireEvent.click(await screen.findByRole('button', { name: '사망 신고 취소하기' }))

    expect(await screen.findByText('보관 중')).toBeInTheDocument()
    expect(requests.some((r) => r.method === 'POST' && r.path.startsWith('/api/legacy/cancel-death'))).toBe(true)
  })
})
