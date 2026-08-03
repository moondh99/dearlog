import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ChatbotScreen from './ChatbotScreen'
import { useAuthStore } from '../store/authStore'
import { useChildStore } from '../store/childStore'
import { useInterviewStore } from '../store/interviewStore'
import type { DigitalTwinResult } from '../types/agents'

const chatbotMocks = vi.hoisted(() => ({
  fetchFamilyMembers: vi.fn(),
  fetchLocalInterviewRecords: vi.fn(),
  fetchLocalMemories: vi.fn(),
  fetchLocalChapters: vi.fn(),
  fetchLocalQuestions: vi.fn(),
  generatePersonaResponse: vi.fn(),
  buildMemoryChunksFromMemories: vi.fn(),
}))

vi.mock('../lib/local-server', () => ({
  fetchFamilyMembers: chatbotMocks.fetchFamilyMembers,
  fetchLocalInterviewRecords: chatbotMocks.fetchLocalInterviewRecords,
  fetchLocalMemories: chatbotMocks.fetchLocalMemories,
  fetchLocalChapters: chatbotMocks.fetchLocalChapters,
  fetchLocalQuestions: chatbotMocks.fetchLocalQuestions,
  saveLocalInterviewRecord: vi.fn(),
  updateLocalInterviewRecordReview: vi.fn(),
  updateLocalFamilyQuestion: vi.fn(),
}))

vi.mock('../lib/agents/digitalTwin', () => ({
  buildMemoryChunksFromMemories: chatbotMocks.buildMemoryChunksFromMemories,
  generatePersonaResponse: chatbotMocks.generatePersonaResponse,
}))

function renderChatbot() {
  return render(
    <MemoryRouter>
      <ChatbotScreen />
    </MemoryRouter>
  )
}

function resetStores() {
  window.localStorage.clear()
  window.sessionStorage.clear()
  useAuthStore.setState({
    role: 'child',
    userName: '김보호',
    userId: 'guardian-1',
    phoneNumber: '01022223333',
    authToken: 'profile-token',
  })
  useChildStore.setState({
    activeSeniorId: 'senior-2',
    photos: [],
    questions: [],
  })
  useInterviewStore.setState({
    chapters: [],
    transcripts: [],
  })
}

describe('ChatbotScreen', () => {
  beforeEach(() => {
    resetStores()
    chatbotMocks.fetchFamilyMembers.mockReset()
    chatbotMocks.fetchLocalInterviewRecords.mockReset()
    chatbotMocks.fetchLocalMemories.mockReset()
    chatbotMocks.fetchLocalChapters.mockReset()
    chatbotMocks.fetchLocalQuestions.mockReset()
    chatbotMocks.generatePersonaResponse.mockReset()
    chatbotMocks.buildMemoryChunksFromMemories.mockReset()

    chatbotMocks.fetchFamilyMembers.mockResolvedValue({
      members: [
        {
          id: 'senior-1',
          name: '김영자',
          role: 'parent',
          relationship: '어머니',
          recordSpaceName: '영자 어머니의 기록',
          isMe: false,
        },
        {
          id: 'senior-2',
          name: '박순자',
          role: 'parent',
          relationship: '이모',
          recordSpaceName: '순자 이모의 기록',
          isMe: false,
        },
      ],
    })
    chatbotMocks.fetchLocalMemories.mockResolvedValue({ memories: [] })
    chatbotMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] })
    chatbotMocks.fetchLocalChapters.mockResolvedValue({ chapters: [] })
    chatbotMocks.fetchLocalQuestions.mockResolvedValue({ questions: [] })
    chatbotMocks.buildMemoryChunksFromMemories.mockReturnValue([])
    chatbotMocks.generatePersonaResponse.mockResolvedValue({
      responseText: '순자 이모의 저장된 기록으로 답했어요.',
      questionType: 'recall',
      evidenceBadge: {
        usedChunkIds: [],
        reliability: 'UNVERIFIED',
        note: '테스트 응답',
      },
      fallbackTriggered: true,
    } satisfies DigitalTwinResult)
  })

  it('loads chat memories and transcript fallback for the active record space only', async () => {
    renderChatbot()

    expect(await screen.findByText('순자 이모의 기록')).toBeInTheDocument()

    await waitFor(() => {
      expect(chatbotMocks.fetchLocalMemories).toHaveBeenCalledWith('senior-2')
      expect(chatbotMocks.fetchLocalInterviewRecords).toHaveBeenCalledWith('senior-2')
    })
  })

  it('stores and restores previous chat sessions for the current record space', async () => {
    renderChatbot()

    const input = await screen.findByPlaceholderText('저장된 이야기를 불러오는 중입니다...')
    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })

    fireEvent.change(input, { target: { value: '시장 이야기를 들려주세요' } })
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }))

    expect(await screen.findByText('순자 이모의 저장된 기록으로 답했어요.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이전 대화 보기' }))
    expect(screen.getByRole('button', { name: /시장 이야기를 들려주세요/ })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '새 대화' }))
    expect(screen.queryByText('시장 이야기를 들려주세요')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '이전 대화 보기' }))
    fireEvent.click(screen.getByRole('button', { name: /시장 이야기를 들려주세요/ }))

    expect(screen.getByText('시장 이야기를 들려주세요')).toBeInTheDocument()
    expect(screen.getByText('순자 이모의 저장된 기록으로 답했어요.')).toBeInTheDocument()
  })

  it('shows a duplicated evidence source only once', async () => {
    chatbotMocks.fetchLocalInterviewRecords.mockResolvedValue({
      records: [{
        id: 'record-duplicate',
        questionId: 'question-1',
        question: { text: '첫 월급을 받은 날은 어땠나요?' },
        chapterId: 'youth',
        transcriptText: '첫 월급을 받은 저녁에 부모님과 함께 있었던 기억입니다.',
        aiSummary: '첫 월급을 받은 저녁에 부모님과 함께 있었던 기억입니다.',
        mode: 'voice',
        reviewStatus: 'applied',
        recordedAt: '2026-06-08T00:00:00.000Z',
      }],
    })
    chatbotMocks.generatePersonaResponse.mockResolvedValueOnce({
      responseText: '첫 월급을 받은 날 이야기가 남아 있어요.',
      questionType: 'recall',
      evidenceBadge: {
        usedChunkIds: ['record-duplicate', 'record-duplicate'],
        reliability: 'CONFIRMED',
        note: '중복 근거 테스트',
      },
      fallbackTriggered: false,
    } satisfies DigitalTwinResult)

    renderChatbot()

    const input = await screen.findByPlaceholderText('저장된 이야기를 불러오는 중입니다...')
    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })

    fireEvent.change(input, { target: { value: '첫 월급 이야기를 들려주세요' } })
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }))

    expect(await screen.findByText('첫 월급을 받은 날 이야기가 남아 있어요.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: '원문 보기' }))

    expect(screen.getAllByText('첫 월급을 받은 저녁에 부모님과 함께 있었던 기억입니다.')).toHaveLength(1)
  })

  it('includes recent interview records even when server memories already exist', async () => {
    chatbotMocks.fetchLocalMemories.mockResolvedValue({
      memories: [{ id: 'memory-old' }],
    })
    chatbotMocks.buildMemoryChunksFromMemories.mockReturnValue([
      {
        chunkId: 'memory-old',
        raw: '대추차를 마시던 오래된 취미 기억입니다.',
        clean: '대추차를 마시던 오래된 취미 기억입니다.',
        tags: {
          ner: { persons: [], places: [], times: [], events: ['취미 - 대추차'] },
          emotions: {
            pride: 0,
            nostalgia: 0,
            regret: 0,
            gratitude: 0,
            loss: 0,
            joy: 1,
            fear: 0,
            peace: 0,
          },
        },
        reliabilityLabel: 'CONFIRMED',
        chapterHint: '취미 - 대추차',
      },
    ])
    chatbotMocks.fetchLocalInterviewRecords.mockResolvedValue({
      records: [{
        id: 'record-hobby',
        questionId: 'common_21',
        question: { text: '살면서 오래 좋아해 온 취미나 즐거움은 무엇인가요?' },
        chapterId: 'hobbies',
        transcriptText: '살면서 오래 좋아해온 취미는 실뜨기나 실타래로 행주 만드는 것을 좋아했고, 그걸 하면서 되게 즐거웠어.',
        aiSummary: '실뜨기나 실타래로 행주 만드는 것을 좋아했고 즐거웠다는 기록입니다.',
        mode: 'voice',
        reviewStatus: 'applied',
        recordedAt: '2026-06-08T16:41:19.509Z',
      }],
    })
    chatbotMocks.generatePersonaResponse.mockResolvedValueOnce({
      responseText: '실뜨기와 실타래로 행주 만드는 걸 좋아하셨다고 남아 있어요.',
      questionType: 'recall',
      evidenceBadge: {
        usedChunkIds: ['record-hobby'],
        reliability: 'CONFIRMED',
        note: '최신 인터뷰 기록 사용',
      },
      fallbackTriggered: false,
    } satisfies DigitalTwinResult)

    renderChatbot()

    const input = await screen.findByPlaceholderText('저장된 이야기를 불러오는 중입니다...')
    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })

    fireEvent.change(input, { target: { value: '엄마 취미활동있어?' } })
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }))

    expect(await screen.findByText('실뜨기와 실타래로 행주 만드는 걸 좋아하셨다고 남아 있어요.')).toBeInTheDocument()
    const chunks = chatbotMocks.generatePersonaResponse.mock.calls.at(-1)?.[1]
    expect(chunks).toEqual(expect.arrayContaining([
      expect.objectContaining({
        chunkId: 'record-hobby',
        raw: expect.stringContaining('실뜨기나 실타래'),
        chapterHint: expect.stringContaining('살면서 오래 좋아해 온 취미'),
      }),
      expect.objectContaining({
        chunkId: 'memory-old',
      }),
    ]))
  })

  // 챗봇 동의를 철회해도 인용문이 담긴 지난 대화가 localStorage 에 그대로 남아 있었다.
  // 서버가 지울 수 없는 저장소라 화면이 열릴 때 클라이언트가 지워야 한다.
  const CHAT_HISTORY_KEY = 'dearlog-memory-chat-history:child:senior-2'

  function seedStoredChatSession(updatedAt: string) {
    window.localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify([{
      id: 'chat_stored',
      createdAt: updatedAt,
      updatedAt,
      ownerLabel: '순자 이모의 기록',
      messages: [
        { id: 'u_1', role: 'user', text: '시장 이야기를 들려주세요' },
        { id: 'a_1', role: 'ai', text: '시장에서 콩나물을 팔던 이야기가 남아 있어요.' },
      ],
    }]))
  }

  async function openStoredHistory() {
    const input = await screen.findByPlaceholderText('저장된 이야기를 불러오는 중입니다...')
    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })
    fireEvent.click(screen.getByRole('button', { name: '이전 대화 보기' }))
  }

  it('drops stored chat sessions once chatbot consent is revoked', async () => {
    seedStoredChatSession('2026-06-01T00:00:00.000Z')
    chatbotMocks.fetchLocalMemories.mockResolvedValue({
      memories: [],
      chatbotConsentUpdatedAt: '2026-06-02T00:00:00.000Z',
    })

    renderChatbot()
    await openStoredHistory()

    expect(screen.queryByRole('button', { name: /시장 이야기를 들려주세요/ })).not.toBeInTheDocument()
    // 화면에서 가리는 것으로는 부족하다. 저장소에서 실제로 사라져야 한다.
    expect(window.localStorage.getItem(CHAT_HISTORY_KEY)).not.toContain('콩나물')
  })

  it('keeps stored chat sessions that are newer than the revocation', async () => {
    seedStoredChatSession('2026-06-03T00:00:00.000Z')
    chatbotMocks.fetchLocalMemories.mockResolvedValue({
      memories: [],
      chatbotConsentUpdatedAt: '2026-06-02T00:00:00.000Z',
    })

    renderChatbot()
    await openStoredHistory()

    // 철회 뒤에 오간 대화는 이미 걸러진 근거로 만들어졌으므로 버릴 이유가 없다.
    expect(screen.getByRole('button', { name: /시장 이야기를 들려주세요/ })).toBeInTheDocument()
  })

  it('excludes interview records whose chatbot consent was revoked', async () => {
    chatbotMocks.fetchLocalInterviewRecords.mockResolvedValue({
      records: [
        {
          id: 'record-allowed',
          questionId: 'question-allowed',
          question: { text: '허용된 기억은 무엇인가요?' },
          chapterId: 'childhood',
          transcriptText: '마당에서 팽이를 돌리던 기억입니다.',
          aiSummary: '마당에서 팽이를 돌렸다.',
          chatbot: true,
          recordedAt: '2026-06-08T00:00:00.000Z',
        },
        {
          id: 'record-revoked',
          questionId: 'question-revoked',
          question: { text: '중지된 기억은 무엇인가요?' },
          chapterId: 'childhood',
          transcriptText: '검색에 포함되면 안 되는 비공개 기록입니다.',
          aiSummary: '검색 제외 대상이다.',
          chatbot: false,
          recordedAt: '2026-06-09T00:00:00.000Z',
        },
      ],
    })

    renderChatbot()

    const input = await screen.findByPlaceholderText('저장된 이야기를 불러오는 중입니다...')
    await waitFor(() => {
      expect(input).not.toBeDisabled()
    })

    fireEvent.change(input, { target: { value: '어린 시절 이야기를 들려주세요' } })
    fireEvent.click(screen.getByRole('button', { name: '질문 보내기' }))

    await waitFor(() => {
      expect(chatbotMocks.generatePersonaResponse).toHaveBeenCalled()
    })
    const chunks = chatbotMocks.generatePersonaResponse.mock.calls.at(-1)?.[1]
    expect(chunks).toEqual([
      expect.objectContaining({ chunkId: 'record-allowed' }),
    ])
  })
})
