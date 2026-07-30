import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ConsentSettingsScreen from './ConsentSettingsScreen'
import { useAuthStore } from '../store/authStore'
import { useConsentStore } from '../store/consentStore'
import { useInterviewStore } from '../store/interviewStore'
import type { ConsentSettingsV2, Memory } from '../lib/types'

const consentScreenMocks = vi.hoisted(() => ({
  fetchLocalInterviewRecords: vi.fn(),
  updateLocalInterviewRecordConsent: vi.fn(),
  bulkUpdateLocalInterviewRecordConsent: vi.fn(),
  fetchLocalMemories: vi.fn(),
  updateLocalMemory: vi.fn(),
}))

vi.mock('../lib/local-server', () => ({
  fetchLocalInterviewRecords: consentScreenMocks.fetchLocalInterviewRecords,
  updateLocalInterviewRecordConsent: consentScreenMocks.updateLocalInterviewRecordConsent,
  bulkUpdateLocalInterviewRecordConsent: consentScreenMocks.bulkUpdateLocalInterviewRecordConsent,
  fetchLocalMemories: consentScreenMocks.fetchLocalMemories,
  updateLocalMemory: consentScreenMocks.updateLocalMemory,
  fetchLocalChapters: vi.fn(async () => ({ chapters: [] })),
  fetchLocalQuestions: vi.fn(async () => ({ questions: [] })),
  saveLocalInterviewRecord: vi.fn(),
  updateLocalInterviewRecordReview: vi.fn(),
  updateLocalFamilyQuestion: vi.fn(),
}))

const GRANTED_CONSENTS: ConsentSettingsV2 = {
  출판: 'granted',
  가족열람: 'granted',
  챗봇: 'granted',
  사후공개: 'granted',
  민감정보: 'granted',
}

function makeMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'memory-spring',
    date: '2026-05-01T00:00:00.000Z',
    topic: '봄 소풍',
    originalTranscript: '가족과 함께 봄 소풍을 갔습니다.',
    cleanedTranscript: '가족과 함께한 봄 소풍 이야기입니다.',
    publishVersion: '봄날의 가족 소풍',
    tags: { people: ['가족'], places: ['공원'], emotions: ['기쁨'], timePeriod: '봄' },
    privacy: 'family',
    confidenceLabel: '확인됨',
    contradictions: [],
    consent: {
      status: 'granted',
      accessTier: '지정 가족',
      designatedFamilyIds: [],
      lastModified: '2026-05-01T00:00:00.000Z',
    },
    consentSettings: { ...GRANTED_CONSENTS },
    embedding: [0.1, 0.2],
    ...overrides,
  }
}

function renderScreen() {
  return render(
    <MemoryRouter>
      <ConsentSettingsScreen />
    </MemoryRouter>,
  )
}

describe('ConsentSettingsScreen memory controls', () => {
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
    consentScreenMocks.fetchLocalMemories.mockReset()
    consentScreenMocks.updateLocalMemory.mockReset()

    consentScreenMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] })
    consentScreenMocks.fetchLocalMemories.mockResolvedValue({ memories: [makeMemory()] })
  })

  it('shows all five purposes and persists a single status as a partial patch', async () => {
    consentScreenMocks.updateLocalMemory.mockImplementation(async (_id, updates) => ({
      memory: makeMemory({
        consentSettings: {
          ...GRANTED_CONSENTS,
          ...(updates.consentSettings ?? {}),
        },
      }),
    }))

    renderScreen()

    expect(await screen.findByText('봄 소풍')).toBeInTheDocument()
    for (const label of ['자서전 출판', '가족 열람', '챗봇 답변', '사후 공개', '민감정보 활용']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }

    fireEvent.click(screen.getByRole('button', {
      name: '봄 소풍 기억 가족 열람: 검토 필요 선택',
    }))

    await waitFor(() => {
      expect(consentScreenMocks.updateLocalMemory).toHaveBeenCalledWith('memory-spring', {
        consentSettings: { 가족열람: 'needs_review' },
      })
    })
    expect(await screen.findByText('현재: 검토 필요')).toBeInTheDocument()
  })

  it('sends stop-use as one patch and refreshes all visible statuses after confirmation', async () => {
    const stoppedConsents: ConsentSettingsV2 = {
      출판: 'revoked',
      가족열람: 'revoked',
      챗봇: 'revoked',
      사후공개: 'revoked',
      민감정보: 'revoked',
    }
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    consentScreenMocks.updateLocalMemory.mockResolvedValue({
      memory: makeMemory({
        privacy: 'private',
        consentSettings: stoppedConsents,
        embedding: null,
      }),
    })

    renderScreen()
    fireEvent.click(await screen.findByRole('button', { name: '봄 소풍 기억 활용 중지' }))

    await waitFor(() => {
      expect(consentScreenMocks.updateLocalMemory).toHaveBeenCalledWith('memory-spring', {
        privacy: 'private',
        consentSettings: stoppedConsents,
        embedding: null,
      })
    })
    expect(await screen.findByText('봄 소풍 기억의 활용을 중지했습니다.')).toBeInTheDocument()
    expect(screen.getAllByText('현재: 사용 안 함')).toHaveLength(5)
  })

  it('keeps the previous status when a patch fails', async () => {
    consentScreenMocks.updateLocalMemory.mockRejectedValue(new Error('서버 저장 실패'))

    renderScreen()
    fireEvent.click(await screen.findByRole('button', {
      name: '봄 소풍 기억 챗봇 답변: 사용 안 함 선택',
    }))

    expect(await screen.findByRole('alert')).toHaveTextContent('서버 저장 실패')
    expect(screen.getByRole('button', {
      name: '봄 소풍 기억 챗봇 답변: 허용 선택',
    })).toHaveAttribute('aria-pressed', 'true')
  })
})
