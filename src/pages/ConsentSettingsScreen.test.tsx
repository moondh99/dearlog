import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConsentSettingsScreen from './ConsentSettingsScreen'
import { useAuthStore } from '../store/authStore'
import { useConsentStore } from '../store/consentStore'
import { useInterviewStore } from '../store/interviewStore'

// 목적별 동의는 실제 답변(InterviewRecord)에 붙는다.
// 예전에는 운영에서 생성되지 않는 Memory 테이블을 대상으로 해서 이 화면이 늘 비어 있었다.

const consentScreenMocks = vi.hoisted(() => ({
  fetchLocalInterviewRecords: vi.fn(),
  updateLocalInterviewRecordConsent: vi.fn(),
  bulkUpdateLocalInterviewRecordConsent: vi.fn(),
}))

vi.mock('../lib/local-server', () => ({
  fetchLocalInterviewRecords: consentScreenMocks.fetchLocalInterviewRecords,
  updateLocalInterviewRecordConsent: consentScreenMocks.updateLocalInterviewRecordConsent,
  bulkUpdateLocalInterviewRecordConsent: consentScreenMocks.bulkUpdateLocalInterviewRecordConsent,
  fetchLocalChapters: vi.fn(async () => ({ chapters: [] })),
  fetchLocalQuestions: vi.fn(async () => ({ questions: [] })),
  saveLocalInterviewRecord: vi.fn(),
  updateLocalInterviewRecordReview: vi.fn(),
  updateLocalFamilyQuestion: vi.fn(),
}))

const RECORD = {
  id: 'record-spring',
  chapterId: 'childhood',
  // 스토어는 questionText를 r.question?.text 에서 읽는다.
  question: { text: '봄 소풍' },
  transcriptText: '가족과 함께 봄 소풍을 갔습니다.',
  aiSummary: '봄날의 가족 소풍',
  recordedAt: '2026-05-01T00:00:00.000Z',
  publish: true,
  chatbot: true,
  familyRead: true,
  posthumous: true,
  sensitive: true,
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <ConsentSettingsScreen />
    </MemoryRouter>,
  )
}

describe('ConsentSettingsScreen 답변별 동의', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({
      role: 'parent',
      userName: '김영자',
      userId: 'senior-1',
      phoneNumber: '01011112222',
      authToken: 'token',
    })
    useInterviewStore.setState({ chapters: [], transcripts: [] })
    useConsentStore.setState({ consents: {} })

    consentScreenMocks.fetchLocalInterviewRecords.mockReset()
    consentScreenMocks.updateLocalInterviewRecordConsent.mockReset()
    consentScreenMocks.bulkUpdateLocalInterviewRecordConsent.mockReset()

    consentScreenMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [RECORD] })
    consentScreenMocks.updateLocalInterviewRecordConsent.mockResolvedValue({ record: RECORD })
  })

  it('다섯 가지 목적을 모두 보여준다', async () => {
    renderScreen()

    expect(await screen.findByText('봄 소풍')).toBeInTheDocument()
    // 화면 위쪽 일괄 설정 섹션에도 같은 문구가 있어 토글의 접근 가능한 이름으로 확인한다.
    for (const label of ['자서전 출판', '가족 열람', '챗봇 답변', '사후 공개', '민감정보 활용']) {
      expect(screen.getByRole('button', { name: `봄 소풍 ${label} 끄기` })).toBeInTheDocument()
    }
  })

  it('목적 하나만 끄면 그 필드만 PATCH로 보낸다', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: '봄 소풍 가족 열람 끄기' }))

    await waitFor(() => {
      expect(consentScreenMocks.updateLocalInterviewRecordConsent).toHaveBeenCalledWith(
        'record-spring',
        { familyRead: false },
      )
    })
    expect(await screen.findByRole('button', { name: '봄 소풍 가족 열람 켜기' })).toBeInTheDocument()
  })

  it('민감정보를 끄면 그 필드만 보낸다', async () => {
    renderScreen()

    fireEvent.click(await screen.findByRole('button', { name: '봄 소풍 민감정보 활용 끄기' }))

    await waitFor(() => {
      expect(consentScreenMocks.updateLocalInterviewRecordConsent).toHaveBeenCalledWith(
        'record-spring',
        { sensitive: false },
      )
    })
  })

  it('활용 중지는 다섯 목적을 한 번에 철회한다', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: '봄 소풍 활용 중지' }))

    await waitFor(() => {
      expect(consentScreenMocks.updateLocalInterviewRecordConsent).toHaveBeenCalledWith(
        'record-spring',
        { publish: false, chatbot: false, familyRead: false, posthumous: false, sensitive: false },
      )
    })
    expect(await screen.findByText('이 답변의 활용을 중지했습니다.')).toBeInTheDocument()

    // 다섯 개 토글이 모두 꺼진 상태여야 한다.
    for (const label of ['자서전 출판', '가족 열람', '챗봇 답변', '사후 공개', '민감정보 활용']) {
      expect(screen.getByRole('button', { name: `봄 소풍 ${label} 켜기` })).toBeInTheDocument()
    }
  })

  it('서버가 거절하면 이전 상태로 되돌린다', async () => {
    consentScreenMocks.updateLocalInterviewRecordConsent.mockRejectedValue(new Error('서버 저장 실패'))

    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: '봄 소풍 챗봇 답변 끄기' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('서버 저장 실패')
    // 화면만 꺼진 채로 남아 동의한 줄 알면 안 된다.
    expect(screen.getByRole('button', { name: '봄 소풍 챗봇 답변 끄기' })).toBeInTheDocument()
  })
})
