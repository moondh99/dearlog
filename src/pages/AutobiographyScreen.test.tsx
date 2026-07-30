import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import AutobiographyScreen from './AutobiographyScreen'
import { useAuthStore } from '../store/authStore'
import { useAutobiographyStore } from '../store/autobiographyStore'
import { useChildStore } from '../store/childStore'
import { useInterviewStore } from '../store/interviewStore'
import { useDevModeStore } from '../store/devModeStore'
import {
  confirmLocalCoverDesign,
  fetchFamilyMembers,
  fetchLocalAutobiographyDraft,
  fetchLocalChapters,
  fetchLocalInterviewRecords,
  fetchLocalPublicationPreviewJob,
  fetchLocalQuestions,
  generateLocalCoverDesign,
  startLocalPublicationPreviewJob,
} from '../lib/local-server'

const demoChapter = {
  chapterId: 'childhood',
  chapterTitle: '어린 시절',
  paragraphs: [{
    paragraphId: 'p1',
    text: '어릴 적 가족과 함께한 식탁의 기억입니다.',
    sourceChunkIds: ['record_1'],
    reliability: 'CONFIRMED' as const,
  }],
  missingSections: [],
  toneProfile: { name: '이야기책 형태', patterns: [] },
}

vi.mock('../lib/local-server', async () => {
  const actual = await vi.importActual<typeof import('../lib/local-server')>('../lib/local-server')
  return {
    ...actual,
    confirmLocalCoverDesign: vi.fn(),
    fetchFamilyMembers: vi.fn(),
    fetchLocalAutobiographyDraft: vi.fn(),
    fetchLocalChapters: vi.fn(),
    fetchLocalInterviewRecords: vi.fn(),
    fetchLocalPublicationPreviewJob: vi.fn(),
    fetchLocalQuestions: vi.fn(),
    generateLocalCoverDesign: vi.fn(),
    startLocalPublicationPreviewJob: vi.fn(),
  }
})

function PreviewRouteProbe() {
  const location = useLocation()
  const state = location.state as { seniorId?: string | null } | null
  return (
    <div>
      <p>preview-route:{location.pathname}</p>
      <p>preview-senior:{state?.seniorId ?? 'none'}</p>
    </div>
  )
}

function resetStores(role: 'child' | 'parent') {
  window.localStorage.clear()
  window.sessionStorage.clear()
  useAuthStore.setState({
    authToken: null,
    phoneNumber: '01012345678',
    role,
    userId: role === 'child' ? 'guardian_1' : 'senior_1',
    userName: role === 'child' ? '최민지' : '김영자',
  })
  useChildStore.setState({
    activeSeniorId: role === 'child' ? 'senior_1' : null,
    photos: [],
    questions: [],
  })
  useAutobiographyStore.setState({ chapters: [demoChapter] })
  useInterviewStore.setState({
    chapters: [{ id: 'childhood', title: '어린 시절', description: '', order: 1, questions: [] }],
    transcripts: [],
  })
  useDevModeStore.setState({
    demoSeededAt: null,
    isDemoMode: false,
    isOfflineDemo: false,
  })
}

describe('AutobiographyScreen publication preview', () => {
  beforeEach(() => {
    vi.mocked(confirmLocalCoverDesign).mockReset()
    vi.mocked(fetchFamilyMembers).mockReset()
    vi.mocked(fetchLocalAutobiographyDraft).mockReset()
    vi.mocked(fetchLocalChapters).mockReset()
    vi.mocked(fetchLocalInterviewRecords).mockReset()
    vi.mocked(fetchLocalPublicationPreviewJob).mockReset()
    vi.mocked(startLocalPublicationPreviewJob).mockReset()
    vi.mocked(fetchLocalQuestions).mockReset()
    vi.mocked(generateLocalCoverDesign).mockReset()

    vi.mocked(confirmLocalCoverDesign).mockResolvedValue({ coverDesign: {} })
    vi.mocked(fetchFamilyMembers).mockResolvedValue({
      members: [{
        id: 'senior_1',
        isMe: false,
        name: '김영자',
        relationship: '딸',
        role: 'parent',
      }],
    })
    vi.mocked(fetchLocalAutobiographyDraft).mockResolvedValue({
      draft: {
        narratives: [demoChapter],
      },
    })
    vi.mocked(fetchLocalChapters).mockResolvedValue({
      chapters: [{ id: 'childhood', title: '어린 시절', order: 1 }],
    })
    vi.mocked(fetchLocalQuestions).mockResolvedValue({ questions: [] })
    vi.mocked(fetchLocalInterviewRecords).mockResolvedValue({ records: [] })
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValue({
      job: {
        id: 'preview_job_1',
        status: 'ready',
        stage: 'done',
        attemptCount: 1,
        sourceHash: 'source_hash_1',
      },
      html: '<html><body><section class="cover"><h1>김영자의 이야기</h1></section></body></html>',
    })
    vi.mocked(generateLocalCoverDesign).mockResolvedValue({
      analysis: {
        keywords: ['가족', '식탁'],
        reason: '가족 중심의 따뜻한 회상이 많아 온화한 표지를 추천했습니다.',
        tone: '따뜻함',
      },
      coverDesign: {
        font: '명조체',
        id: 'cover_1',
        palette: 'warm_archive',
        template: 'photo_plate',
      },
      candidates: [
        {
          analysis: {
            keywords: ['가족', '식탁'],
            reason: '가족 중심의 따뜻한 회상이 많아 온화한 표지를 추천했습니다.',
            tone: '따뜻함',
          },
          coverDesign: {
            font: '명조체',
            id: 'cover_1',
            palette: 'warm_archive',
            template: 'photo_plate',
          },
        },
        {
          analysis: {
            keywords: ['정리', '회고'],
            reason: '차분하고 정돈된 회고록 느낌을 강조한 표지입니다.',
            tone: '차분함',
          },
          coverDesign: {
            font: '고딕체',
            id: 'cover_2',
            palette: 'quiet_blue',
            template: 'chapter_band',
          },
        },
        {
          analysis: {
            keywords: ['기록집', '문장'],
            reason: '단정한 기록집과 문학적인 인상을 살린 표지입니다.',
            tone: '단정함',
          },
          coverDesign: {
            font: '궁서체',
            id: 'cover_3',
            palette: 'classic_ink',
            template: 'letterpress',
          },
        },
      ],
    })
  })

  it('uses the active senior publication preview instead of hard-coded page labels in child mode', async () => {
    resetStores('child')

    render(
      <MemoryRouter initialEntries={[{ pathname: '/child/autobiography', state: { seniorId: 'senior_1' } }]}>
        <AutobiographyScreen />
      </MemoryRouter>,
    )

    await screen.findByTitle('기록집 미리보기')
    await waitFor(() => {
      expect(fetchLocalAutobiographyDraft).toHaveBeenCalledWith('senior_1')
      expect(startLocalPublicationPreviewJob).toHaveBeenCalledWith(
        'A5',
        'senior_1',
        'guardian',
        expect.objectContaining({ name: '이야기책 형태' }),
      )
    })

    expect(screen.queryByText('Page')).not.toBeInTheDocument()
    expect(screen.queryByText('03')).not.toBeInTheDocument()
    expect(screen.queryByText('12')).not.toBeInTheDocument()
    expect(screen.queryByText('71-100')).not.toBeInTheDocument()
  })

  it('shows a previous publication preview first and forces regeneration only when update is clicked', async () => {
    resetStores('child')
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValue({
      job: {
        id: 'preview_job_stale',
        status: 'ready',
        stage: 'done',
        attemptCount: 1,
        sourceHash: 'source_hash_current',
        draftSourceHash: 'source_hash_previous',
        isStale: true,
      },
      html: '<html><body><section class="cover"><h1>이전 기록집</h1></section></body></html>',
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/child/autobiography', state: { seniorId: 'senior_1' } }]}>
        <AutobiographyScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByTitle('기록집 미리보기')).toBeInTheDocument()
    expect(await screen.findByRole('button', { name: '업데이트하기' })).toBeInTheDocument()
    expect(startLocalPublicationPreviewJob).toHaveBeenCalledWith(
      'A5',
      'senior_1',
      'guardian',
      expect.objectContaining({ name: '이야기책 형태' }),
    )

    fireEvent.click(screen.getByRole('button', { name: '업데이트하기' }))

    await waitFor(() => {
      expect(startLocalPublicationPreviewJob).toHaveBeenLastCalledWith(
        'A5',
        'senior_1',
        'guardian',
        expect.objectContaining({ name: '이야기책 형태' }),
        { forceRefresh: true },
      )
    })
  })

  it('shows a retry action instead of internal agent errors when publication preview generation fails', async () => {
    resetStores('child')
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValue({
      job: {
        id: 'preview_job_failed',
        status: 'failed',
        stage: 'done',
        attemptCount: 2,
        sourceHash: 'source_hash_failed',
        errorMessage: 'Publication editorial plan agent returned empty content.',
      },
    })

    render(
      <MemoryRouter initialEntries={[{ pathname: '/child/autobiography', state: { seniorId: 'senior_1' } }]}>
        <AutobiographyScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('기록집 작성 에이전트 응답이 비어 있어 다시 작성이 필요해요.')).toBeInTheDocument()
    expect(screen.queryByText('Publication editorial plan agent returned empty content.')).not.toBeInTheDocument()

    const previewCallCount = vi.mocked(startLocalPublicationPreviewJob).mock.calls.length
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValue({
      job: {
        id: 'preview_job_retry',
        status: 'ready',
        stage: 'done',
        attemptCount: 1,
        sourceHash: 'source_hash_retry',
      },
      html: '<html><body><section class="cover"><h1>다시 작성된 기록집</h1></section></body></html>',
    })
    fireEvent.click(screen.getByRole('button', { name: '다시 작성하기' }))

    await screen.findByTitle('기록집 미리보기')
    await waitFor(() => {
      expect(vi.mocked(startLocalPublicationPreviewJob).mock.calls.length).toBeGreaterThan(previewCallCount)
    })
  })

  it('generates and confirms a cover, then refreshes the publication preview', async () => {
    resetStores('child')

    render(
      <MemoryRouter initialEntries={[{ pathname: '/child/autobiography', state: { seniorId: 'senior_1' } }]}>
        <AutobiographyScreen />
      </MemoryRouter>,
    )

    await screen.findByTitle('기록집 미리보기')
    fireEvent.click(screen.getByRole('button', { name: '표지 고르기' }))

    await waitFor(() => {
      expect(generateLocalCoverDesign).toHaveBeenCalledWith('senior_1', 'guardian', 3)
    })
    expect(await screen.findByText('마음에 드는 표지를 골라주세요')).toBeInTheDocument()
    expect(screen.getByTestId('cover-candidate-scroller')).toHaveClass('overflow-x-auto')
    expect(screen.getByRole('button', { name: '표지 후보 1 선택' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '표지 후보 2 선택' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '표지 후보 3 선택' })).toBeInTheDocument()
    expect(screen.queryByText('가족 중심의 따뜻한 회상이 많아 온화한 표지를 추천했습니다.')).not.toBeInTheDocument()
    expect(screen.queryByText('차분하고 정돈된 회고록 느낌을 강조한 표지입니다.')).not.toBeInTheDocument()
    expect(screen.queryByText('단정한 기록집과 문학적인 인상을 살린 표지입니다.')).not.toBeInTheDocument()

    const previewCallCount = vi.mocked(startLocalPublicationPreviewJob).mock.calls.length
    fireEvent.click(screen.getByRole('button', { name: '표지 후보 2 선택' }))
    fireEvent.click(screen.getByRole('button', { name: '선택한 표지로 확정' }))

    await waitFor(() => {
      expect(confirmLocalCoverDesign).toHaveBeenCalledWith('cover_2', 'guardian')
    })
    await waitFor(() => {
      expect(vi.mocked(startLocalPublicationPreviewJob).mock.calls.length).toBeGreaterThan(previewCallCount)
    })
  })

  it('uses the current senior role for parent publication previews and cover choices', async () => {
    resetStores('parent')

    render(
      <MemoryRouter initialEntries={['/parent/autobiography']}>
        <AutobiographyScreen />
      </MemoryRouter>,
    )

    await screen.findByTitle('기록집 미리보기')
    await waitFor(() => {
      expect(startLocalPublicationPreviewJob).toHaveBeenCalledWith(
        'A5',
        null,
        'senior',
        expect.objectContaining({ name: '이야기책 형태' }),
      )
    })

    fireEvent.click(screen.getByRole('button', { name: '표지 고르기' }))
    await waitFor(() => {
      expect(generateLocalCoverDesign).toHaveBeenCalledWith(null, 'senior', 3)
    })
  })

  it('opens the child review preview with the active senior id', async () => {
    resetStores('child')

    render(
      <MemoryRouter initialEntries={[{ pathname: '/child/autobiography', state: { seniorId: 'senior_1' } }]}>
        <Routes>
          <Route path="/child/autobiography" element={<AutobiographyScreen />} />
          <Route path="/child/autobiography/preview" element={<PreviewRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTitle('기록집 미리보기')
    fireEvent.click(screen.getByRole('button', { name: '검수하기' }))

    expect(screen.getByText('preview-route:/child/autobiography/preview')).toBeInTheDocument()
    expect(screen.getByText('preview-senior:senior_1')).toBeInTheDocument()
  })

  it('opens the parent review preview without a senior state override', async () => {
    resetStores('parent')

    render(
      <MemoryRouter initialEntries={['/parent/autobiography']}>
        <Routes>
          <Route path="/parent/autobiography" element={<AutobiographyScreen />} />
          <Route path="/parent/autobiography/preview" element={<PreviewRouteProbe />} />
        </Routes>
      </MemoryRouter>,
    )

    await screen.findByTitle('기록집 미리보기')
    fireEvent.click(screen.getByRole('button', { name: '검수하기' }))

    expect(screen.getByText('preview-route:/parent/autobiography/preview')).toBeInTheDocument()
    expect(screen.getByText('preview-senior:none')).toBeInTheDocument()
  })
})
