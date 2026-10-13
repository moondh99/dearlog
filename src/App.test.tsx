import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes, RouteFallback } from './App'
import { useAuthStore } from './store/authStore'

vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: vi.fn(), updateLocalUserRole: vi.fn(), updateLocalUserProfile: vi.fn(),
  fetchFamilyMembers: vi.fn(async () => ({ members: [] })),
  fetchLocalInterviewRecords: vi.fn(async () => ({ records: [] })),
  fetchLocalMemories: vi.fn(async () => ({ memories: [] })),
  fetchLocalPhotos: vi.fn(async () => ({ photos: [] })),
  fetchLocalAutobiographyDraft: vi.fn(async () => ({ draft: null })),
}))
function open(path: string) { render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>) }
function login(role: 'parent' | 'child', token: string | null = 'test-token') {
  useAuthStore.setState({ role, userName: '가상 기존 사용자', userId: role === 'parent' ? 'senior-1' : 'guardian-1', phoneNumber: '', authToken: token })
}
describe('restricted public routes', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({ role: null, userName: '', userId: null, phoneNumber: '', authToken: null })
  })
  it.each(['/', '/splash', '/intro', '/company', '/company/'])('shows the public company page at %s', async path => {
    open(path)
    const heading = await screen.findByRole('heading', { level: 1, name: /부모님의 목소리를/ })
    expect(heading.closest('.company-page')).toBeInTheDocument()
    expect(heading.closest('[class*="max-w-"]')).toBeNull()
    expect(screen.getByRole('link', { name: 'hello@dear-log.com' })).toHaveAttribute('href', 'mailto:hello@dear-log.com')
    expect(screen.getAllByRole('link', { name: /가상 자서전 읽어보기/ })).toHaveLength(2)
    expect(document.querySelector('.company-page form')).toBeNull()
    expect(document.querySelector('.company-page a[href="/auth"]')).toBeNull()
    expect(screen.getAllByRole('img')).toHaveLength(3)
  })
  it('renders the shared lazy loading state', () => {
    render(<RouteFallback />)
    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중...')
  })
  it('offers an existing-account login without signup, asking for the code only after it is sent', async () => {
    open('/auth')
    expect(await screen.findByRole('heading', { name: '기존 계정 로그인' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '인증번호 받기' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '회원가입' })).toBeNull()
    expect(screen.queryByLabelText(/인증번호/)).toBeNull()
  })
  it.each(['/auth/verify', '/parent/autologin?token=unused', '/settings', '/unknown'])('blocks public mutation or demo entry %s', async path => {
    open(path)
    expect(await screen.findByRole('heading', { name: '지금은 예시와 문의를 받습니다' })).toBeInTheDocument()
  })
  it.each(['/parent', '/parent/interview', '/child', '/child/record-space/new', '/calendar'])('requires an existing authenticated session at %s', async path => {
    open(path)
    expect(await screen.findByRole('heading', { name: '기존 계정 로그인' })).toBeInTheDocument()
  })
  it('does not treat a demo role without a token as an authenticated account', async () => {
    login('parent', null)
    open('/parent')
    expect(await screen.findByRole('heading', { name: '기존 계정 로그인' })).toBeInTheDocument()
  })
  it.each(['/parent', '/parent/transcript', '/parent/autobiography/preview', '/parent/mypage', '/mypage'])('retains parent record reading at %s', async path => {
    login('parent')
    open(path)
    expect(await screen.findByRole('heading', { name: '기존 기록 조회' })).toBeInTheDocument()
  })
  it.each(['/child', '/child/photos', '/child/autobiography', '/child/mypage'])('retains guardian record reading at %s', async path => {
    login('child')
    open(path)
    expect(await screen.findByRole('heading', { name: '기존 기록 조회' })).toBeInTheDocument()
  })
  it.each(['/parent/interview', '/parent/welcome', '/parent/vault', '/parent/consent-settings'])('blocks parent input controls at %s', async path => {
    login('parent')
    open(path)
    expect(await screen.findByRole('heading', { name: '지금은 예시와 문의를 받습니다' })).toBeInTheDocument()
  })
  it.each(['/child/questions', '/child/record-space/new', '/child/chatbot', '/child/legacy', '/child/consent-settings'])('blocks guardian input controls at %s', async path => {
    login('child')
    open(path)
    expect(await screen.findByRole('heading', { name: '지금은 예시와 문의를 받습니다' })).toBeInTheDocument()
  })
  it.each([['parent', '/child/questions'], ['child', '/parent/interview']] as const)('keeps the role guard for %s at %s', async (role, path) => {
    login(role)
    open(path)
    expect(await screen.findByRole('heading', { name: '기존 기록 조회' })).toBeInTheDocument()
  })
})
