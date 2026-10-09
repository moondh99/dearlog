import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppRoutes } from './App'
import { useAuthStore } from './store/authStore'
const mocks = vi.hoisted(() => ({
  family: vi.fn(), records: vi.fn(), memories: vi.fn(), photos: vi.fn(), draft: vi.fn(),
  signup: vi.fn(), invite: vi.fn(), upload: vi.fn(), question: vi.fn(), review: vi.fn(), ai: vi.fn(),
}))
vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: mocks.signup, updateLocalUserRole: vi.fn(), updateLocalUserProfile: vi.fn(),
  fetchFamilyMembers: mocks.family, fetchLocalInterviewRecords: mocks.records,
  fetchLocalMemories: mocks.memories, fetchLocalPhotos: mocks.photos, fetchLocalAutobiographyDraft: mocks.draft,
  createParentInvitation: mocks.invite, uploadLocalPhoto: mocks.upload, createLocalQuestion: mocks.question,
  updateLocalInterviewRecordReview: mocks.review, createLocalAIChatCompletion: mocks.ai,
}))
const parent = { id: 'allowed-senior-1', name: '가상 부모', role: 'parent', relationship: '부모님', isMe: false }
function open(path = '/child') { render(<MemoryRouter initialEntries={[path]}><AppRoutes /></MemoryRouter>) }
function login(role: 'parent' | 'child') {
  useAuthStore.setState({ role, userName: '가상 사용자', userId: role === 'parent' ? 'own-senior' : 'guardian-1', phoneNumber: '', authToken: 'fixture-token' })
}
describe('authorized read-only archive flows', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({ role: null, userName: '', userId: null, phoneNumber: '', authToken: null })
    mocks.family.mockResolvedValue({ members: [parent] })
    mocks.records.mockResolvedValue({ records: [{ id: 'record-1', question: { text: '첫 월급의 기억' }, transcriptText: '가상 원문: 가족과 빵을 나눴다.', aiSummary: '가상 정리본: 첫 월급과 가족.' }] })
    mocks.memories.mockResolvedValue({ memories: [] })
    mocks.photos.mockResolvedValue({ photos: [] })
    mocks.draft.mockResolvedValue({ draft: { narratives: [{ chapterId: 'work', chapterTitle: '가상 일과 가족', paragraphs: [{ paragraphId: 'p1', text: '이미 저장된 가상 문장', sourceChunkIds: [] }] }] } })
  })
  it('reads authorized server records and stored chapters without any mutation controls or calls', async () => {
    login('child')
    open()
    expect(await screen.findByText('첫 월급의 기억')).toBeInTheDocument()
    fireEvent.click(screen.getByText('원문 읽기'))
    expect(screen.getByText('가상 원문: 가족과 빵을 나눴다.')).toBeVisible()
    expect(screen.getByText('이미 저장된 가상 문장')).toBeInTheDocument()
    expect(screen.queryByRole('textbox')).toBeNull()
    expect(screen.queryByRole('button', { name: /녹음|초대|생성|업로드|수정/ })).toBeNull()
    for (const mutation of [mocks.signup, mocks.invite, mocks.upload, mocks.question, mocks.review, mocks.ai]) expect(mutation).not.toHaveBeenCalled()
    for (const read of [mocks.records, mocks.memories, mocks.photos, mocks.draft]) expect(read).toHaveBeenCalledExactlyOnceWith(parent.id)
  })
  it('ignores stale cached or URL record-space IDs and permits only API-listed choices', async () => {
    login('child')
    window.localStorage.setItem('dearlog-child', JSON.stringify({ state: { activeSeniorId: 'unrelated-senior' } }))
    mocks.family.mockResolvedValue({ members: [parent, { id: 'unrelated-guardian', name: '다른 보호자', role: 'child', isMe: false }, { ...parent, id: 'allowed-senior-2', name: '가상 부모 2' }] })
    open('/child?seniorId=unrelated-senior')
    const select = await screen.findByRole('combobox', { name: '연결된 기존 기록 공간' })
    expect(select).toHaveValue(parent.id)
    expect(screen.getAllByRole('option')).toHaveLength(2)
    await screen.findByText('첫 월급의 기억')
    fireEvent.change(select, { target: { value: 'allowed-senior-2' } })
    await waitFor(() => expect(mocks.records).toHaveBeenLastCalledWith('allowed-senior-2'))
    expect(mocks.records.mock.calls.some(([id]) => id === 'unrelated-senior')).toBe(false)
  })
  it('reads only the parent own account and offers no user selection', async () => {
    login('parent')
    open('/parent/transcript')
    await screen.findByText('첫 월급의 기억')
    expect(mocks.records).toHaveBeenCalledExactlyOnceWith('own-senior')
    expect(mocks.family).not.toHaveBeenCalled()
    expect(screen.queryByRole('combobox')).toBeNull()
  })
  it('does not query records when the guardian has no allowed family link', async () => {
    login('child')
    mocks.family.mockResolvedValue({ members: [] })
    open()
    expect(await screen.findByText(/조회할 수 있는 기존 기록 공간이 없습니다/)).toBeInTheDocument()
    expect(mocks.records).not.toHaveBeenCalled()
    expect(mocks.draft).not.toHaveBeenCalled()
  })
  it('preserves an existing self-linked guardian record space without choosing another user', async () => {
    login('child')
    mocks.family.mockResolvedValue({ members: [{ id: 'guardian-1', name: '본인', role: 'child', isMe: true }, parent] })
    open()
    const select = await screen.findByRole('combobox', { name: '연결된 기존 기록 공간' })
    expect(select).toHaveValue(parent.id)
    fireEvent.change(select, { target: { value: 'guardian-1' } })
    await waitFor(() => expect(mocks.records).toHaveBeenLastCalledWith('guardian-1'))
    expect(screen.getByRole('option', { name: '내 계정의 기존 기록' })).toBeInTheDocument()
  })
  it('retains the no-link own-account GET fallback without inventing a family connection', async () => {
    login('child')
    mocks.family.mockResolvedValue({ members: [{ id: 'guardian-1', name: '본인', role: 'child', isMe: true }] })
    open()
    await screen.findByText('첫 월급의 기억')
    expect(mocks.records).toHaveBeenCalledExactlyOnceWith(undefined)
    expect(mocks.invite).not.toHaveBeenCalled()
  })
  it('does not use cached transcripts when server authorization fails', async () => {
    login('child')
    window.localStorage.setItem('dearlog-interview', JSON.stringify({ state: { transcripts: [{ originalText: '노출되면 안 되는 캐시' }] } }))
    mocks.records.mockRejectedValue(new Error('조회 권한이 없습니다.'))
    open()
    expect(await screen.findByRole('alert')).toHaveTextContent('조회 권한이 없습니다.')
    expect(screen.queryByText('노출되면 안 되는 캐시')).toBeNull()
    expect(screen.queryByText('가상 원문: 가족과 빵을 나눴다.')).toBeNull()
  })
  it('discards a stale response after selecting a different permitted space', async () => {
    login('child')
    mocks.family.mockResolvedValue({ members: [parent, { ...parent, id: 'allowed-senior-2', name: '가상 부모 2' }] })
    let resolveOld: (value: unknown) => void
    mocks.records.mockImplementation((id: string) => id === parent.id ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve({ records: [{ id: 'new', question: { text: '새 선택의 가상 기록' } }] }))
    open()
    const select = await screen.findByRole('combobox', { name: '연결된 기존 기록 공간' })
    await waitFor(() => expect(mocks.records).toHaveBeenCalledWith(parent.id))
    fireEvent.change(select, { target: { value: 'allowed-senior-2' } })
    expect(await screen.findByText('새 선택의 가상 기록')).toBeInTheDocument()
    await act(async () => resolveOld({ records: [{ id: 'old', question: { text: '오래된 선택의 응답' } }] }))
    expect(screen.queryByText('오래된 선택의 응답')).toBeNull()
  })
  it('logs out locally, clears persisted family data, and returns to the company page', async () => {
    login('parent')
    window.localStorage.setItem('dearlog-interview', 'private-cache')
    open('/parent')
    const button = await screen.findByRole('button', { name: '로그아웃' })
    fireEvent.click(button)
    expect(await screen.findByRole('heading', { level: 1, name: /부모님의 목소리를/ })).toBeInTheDocument()
    expect(useAuthStore.getState().authToken).toBeNull()
    expect(window.localStorage.getItem('dearlog-interview')).toBeNull()
  })
})
