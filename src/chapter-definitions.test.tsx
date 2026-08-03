import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FIXED_CHAPTERS } from '../server/domain/constants'
import ChildQuestionsScreen from './pages/ChildQuestionsScreen'
import { buildNewGenDemoSeed } from './lib/demo/demo-seed-adapter'
import { useAuthStore } from './store/authStore'
import { useChildStore } from './store/childStore'
import { useDevModeStore } from './store/devModeStore'
import { useInterviewStore } from './store/interviewStore'

const chapterMocks = vi.hoisted(() => ({
  fetchFamilyMembers: vi.fn(),
  fetchLocalChapters: vi.fn(),
  fetchLocalQuestions: vi.fn(),
  fetchLocalInterviewRecords: vi.fn(),
  fetchLocalFamilyQuestions: vi.fn(),
}))

vi.mock('./lib/local-server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./lib/local-server')>()),
  fetchFamilyMembers: chapterMocks.fetchFamilyMembers,
  fetchLocalChapters: chapterMocks.fetchLocalChapters,
  fetchLocalQuestions: chapterMocks.fetchLocalQuestions,
  fetchLocalInterviewRecords: chapterMocks.fetchLocalInterviewRecords,
  fetchLocalFamilyQuestions: chapterMocks.fetchLocalFamilyQuestions,
}))

/** 서버 DB 는 항상 FIXED_CHAPTERS 로 시드되므로 /api/chapters 는 이 모양으로 내려온다. */
const SERVER_CHAPTER_ROWS = FIXED_CHAPTERS.map((chapter) => ({
  id: chapter.id,
  order: chapter.order,
  slug: chapter.slug,
  title: chapter.title,
}))

describe('챕터 정의는 서버 한 곳에서만 나온다', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useAuthStore.setState({ role: 'child', userId: 'guardian_1', userName: '김민수', phoneNumber: '01012345678', authToken: null })
    useChildStore.setState({ photos: [], questions: [], activeSeniorId: 'senior_1' })
    useInterviewStore.setState({ chapters: [], transcripts: [] })
    useDevModeStore.setState({ isDemoMode: false, isOfflineDemo: false, demoSeededAt: null })

    chapterMocks.fetchFamilyMembers.mockResolvedValue({
      members: [{ id: 'senior_1', name: '김영자', role: 'parent', relationship: '어머니', isMe: false, recordSpaceName: null }],
    })
    chapterMocks.fetchLocalChapters.mockResolvedValue({ chapters: SERVER_CHAPTER_ROWS })
    chapterMocks.fetchLocalQuestions.mockResolvedValue({ questions: [] })
    chapterMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] })
    chapterMocks.fetchLocalFamilyQuestions.mockResolvedValue({ questions: [] })
  })

  it('데모 시드의 챕터는 서버 정의와 id·제목·순서가 모두 같다', () => {
    const { chapters } = buildNewGenDemoSeed()

    expect(chapters.map((chapter) => ({ id: chapter.id, title: chapter.title, order: chapter.order })))
      .toEqual(FIXED_CHAPTERS.map((chapter) => ({ id: chapter.id, title: chapter.title, order: chapter.order })))
  })

  it('데모 시드에는 질문이 하나도 없는 빈 챕터가 없다', () => {
    const { chapters } = buildNewGenDemoSeed()

    expect(chapters.filter((chapter) => chapter.questions.length === 0).map((chapter) => chapter.id)).toEqual([])
  })

  it('질문 만들기 화면의 챕터 칩은 서버 제목을 그대로 쓴다', async () => {
    render(
      <MemoryRouter initialEntries={['/child/questions']}>
        <ChildQuestionsScreen />
      </MemoryRouter>,
    )

    await waitFor(() => expect(screen.getByRole('button', { name: '질문 추가' })).toBeEnabled())
    fireEvent.click(screen.getByRole('button', { name: '질문 추가' }))
    fireEvent.click(await screen.findByRole('button', { name: /텍스트로 질문 만들기/ }))

    for (const chapter of FIXED_CHAPTERS) {
      expect(await screen.findByRole('button', { name: chapter.title })).toBeInTheDocument()
    }
  })

  it('인터뷰 스토어는 서버가 내려준 챕터 제목을 다시 이름 붙이지 않는다', async () => {
    await useInterviewStore.getState().fetchChaptersAndQuestions('senior_1')

    await waitFor(() => {
      expect(useInterviewStore.getState().chapters.map((chapter) => chapter.title))
        .toEqual(FIXED_CHAPTERS.map((chapter) => chapter.title))
    })
  })
})
