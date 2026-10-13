import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import { useAuthStore } from './store/authStore'
const mocks = vi.hoisted(() => ({ login: vi.fn(), profile: vi.fn(), role: vi.fn(), tokenLogin: vi.fn(), otpRequest: vi.fn(), otpVerify: vi.fn() }))
vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: mocks.login, updateLocalUserProfile: mocks.profile, updateLocalUserRole: mocks.role,
  loginWithInvitationToken: mocks.tokenLogin,
  requestLocalPhoneOtp: mocks.otpRequest, verifyLocalPhoneOtp: mocks.otpVerify,
  fetchFamilyMembers: vi.fn(async () => ({ members: [] })),
  fetchLocalInterviewRecords: vi.fn(async () => ({ records: [] })),
  fetchLocalMemories: vi.fn(async () => ({ memories: [] })), fetchLocalPhotos: vi.fn(async () => ({ photos: [] })),
  fetchLocalAutobiographyDraft: vi.fn(async () => ({ draft: null })),
}))
function open(path = '/auth') { render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>) }
async function submit(name = '가상 기존 사용자', phone = '010-2222-3333') {
  fireEvent.change(await screen.findByLabelText('등록한 이름'), { target: { value: name } })
  fireEvent.change(screen.getByLabelText('등록한 휴대폰 번호'), { target: { value: phone } })
  fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }))
  if (!/^01[016789]\d{7,8}$/.test(phone.replace(/[^\d]/g, ''))) return
  fireEvent.change(await screen.findByLabelText('인증번호'), { target: { value: '123456' } })
  fireEvent.click(screen.getByRole('button', { name: '기존 기록 조회 로그인' }))
}
describe('existing-account-only login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({ role: null, userName: '', userId: null, phoneNumber: '', authToken: null })
    mocks.otpRequest.mockResolvedValue({ ok: true, expiresInSeconds: 300, resendAfterSeconds: 60 })
    mocks.otpVerify.mockResolvedValue({ verificationToken: 'fixture-otp-token', expiresInSeconds: 300 })
    mocks.login.mockResolvedValue({ user: { id: 'guardian-1', name: '가상 기존 사용자', role: 'guardian' }, authToken: 'fixture-token' })
  })
  it('uses existing login with strict true and never initializes a new profile', async () => {
    open()
    await submit()
    expect(await screen.findByRole('heading', { name: '기존 기록 조회' })).toBeInTheDocument()
    expect(mocks.login).toHaveBeenCalledExactlyOnceWith('01022223333', '가상 기존 사용자', true, undefined, 'fixture-otp-token')
    expect(mocks.profile).not.toHaveBeenCalled()
    expect(mocks.role).not.toHaveBeenCalled()
    expect(useAuthStore.getState().authToken).toBe('fixture-token')
  })
  it('keeps a failed existing-account check on the login screen', async () => {
    mocks.login.mockRejectedValue(new Error('등록된 기존 계정이 없습니다.'))
    open()
    await submit()
    expect(await screen.findByRole('alert')).toHaveTextContent('등록된 기존 계정이 없습니다.')
    expect(useAuthStore.getState().authToken).toBeNull()
    expect(screen.queryByRole('heading', { name: '기존 기록 조회' })).toBeNull()
    expect(mocks.profile).not.toHaveBeenCalled()
  })
  it('does not send invalid phone input', async () => {
    open()
    await submit('가상 기존 사용자', '1234')
    expect(await screen.findByRole('alert')).toHaveTextContent('올바른 휴대폰 번호')
    expect(mocks.login).not.toHaveBeenCalled()
  })
  it('prevents another login submission while a check is pending', async () => {
    mocks.login.mockImplementation(() => new Promise(() => {}))
    open()
    await submit()
    const busyButton = await screen.findByRole('button', { name: '확인하는 중…' })
    expect(busyButton).toBeDisabled()
    fireEvent.click(busyButton)
    await waitFor(() => expect(mocks.login).toHaveBeenCalledTimes(1))
  })
  it('does not consume an invitation token or use it to authenticate', async () => {
    open('/parent/autologin?token=fictional-unused-token')
    expect(await screen.findByRole('heading', { name: '지금은 예시와 문의를 받습니다' })).toBeInTheDocument()
    expect(mocks.tokenLogin).not.toHaveBeenCalled()
    expect(mocks.login).not.toHaveBeenCalled()
    expect(useAuthStore.getState().authToken).toBeNull()
  })
})
