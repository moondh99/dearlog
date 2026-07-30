import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PublicationPreviewScreen from './PublicationPreviewScreen'
import { fetchLocalPublicationPreviewJob, startLocalPublicationPreviewJob } from '../lib/local-server'
import { useAuthStore } from '../store/authStore'

vi.mock('../lib/local-server', () => ({
  fetchLocalPublicationPreviewJob: vi.fn(),
  startLocalPublicationPreviewJob: vi.fn(),
}))

describe('PublicationPreviewScreen', () => {
  beforeEach(() => {
    useAuthStore.setState({
      authToken: null,
      phoneNumber: '01012345678',
      role: 'child',
      userId: 'guardian_1',
      userName: '최민지',
    })
    vi.mocked(fetchLocalPublicationPreviewJob).mockReset()
    vi.mocked(startLocalPublicationPreviewJob).mockReset()
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValue({
      job: {
        id: 'preview_job_1',
        status: 'ready',
        stage: 'done',
        attemptCount: 1,
        sourceHash: 'source_hash_1',
      },
      html: '<html><body><h1>김영자의 이야기</h1></body></html>',
      editorialPlan: {
        readiness: 'needs_more_records',
        coreTheme: '가족의 식탁과 골목의 기억',
        editorialThesis: '유료 기록집으로 만들기 전에 사진 기반 답변을 더 모아야 합니다.',
        sourceSummary: {
          sourceRecordCount: 4,
          photoLedRecordCount: 1,
          weakChapterCount: 2,
        },
        chapterPlans: [
          { chapterId: 'childhood', chapterTitle: '유년기', strength: 'strong', recommendedRole: 'anchor_chapter' },
          { chapterId: 'work', chapterTitle: '일과 가족', strength: 'thin', recommendedRole: 'needs_more_questions' },
        ],
        strongChapters: ['childhood'],
        weakChapters: ['work'],
        directQuoteCandidates: [{
          text: '그날 어머니에게 고마운 마음이 컸습니다.',
          sourceRecordId: 'record_1',
          chapterId: 'childhood',
        }],
        photoStoryPlacements: [{
          photoId: 'photo_1',
          sourceRecordId: 'record_1',
          chapterId: 'childhood',
          caption: '가족이 모인 식탁',
        }],
        checklistFindings: [{
          checklistItemId: 'minimum-source-volume',
          status: 'needs_work',
          note: '현재 답변 4개, 사진 기반 답변 1개입니다.',
        }],
        followUpQuestions: ['유년기와 연결되는 사진을 보며 떠오르는 하루를 질문하세요.'],
        nextActions: ['약한 장부터 추가 질문을 수집합니다.'],
      },
    })
  })

  it('shows the editorial plan review panel from publication preview data', async () => {
    render(
      <MemoryRouter>
        <PublicationPreviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByRole('heading', { name: '기록집 검수' })).toBeInTheDocument()
    expect(screen.getByText('가족의 식탁과 골목의 기억')).toBeInTheDocument()
    expect(screen.getByText('기록 보강 필요')).toBeInTheDocument()
    expect(screen.getByText('현재 답변 4개, 사진 기반 답변 1개입니다.')).toBeInTheDocument()
    expect(screen.getByText('일과 가족')).toBeInTheDocument()
    expect(screen.getByText('유년기와 연결되는 사진을 보며 떠오르는 하루를 질문하세요.')).toBeInTheDocument()
    expect(screen.queryByTitle('기록집 미리보기')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '책' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: '검수' })).not.toBeInTheDocument()
  })

  it('passes the selected senior id from route state to the preview request', async () => {
    render(
      <MemoryRouter initialEntries={[{
        pathname: '/child/autobiography/preview',
        state: { seniorId: 'demo_bulk_20260607_001_senior_choi_jeonghun' },
      }]}>
        <PublicationPreviewScreen />
      </MemoryRouter>,
    )

    await screen.findByRole('heading', { name: '기록집 검수' })

    await waitFor(() => {
      expect(startLocalPublicationPreviewJob).toHaveBeenCalledWith(
        'A5',
        'demo_bulk_20260607_001_senior_choi_jeonghun',
        'guardian',
        undefined,
      )
    })
  })

  it('shows the agent writing progress while a preview job is running', async () => {
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValueOnce({
      job: {
        id: 'preview_job_running',
        status: 'running',
        stage: 'writing_draft',
        attemptCount: 1,
        sourceHash: 'source_hash_running',
      },
    })

    render(
      <MemoryRouter>
        <PublicationPreviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('기록집 작성 에이전트가 글을 쓰고 있어요...')).toBeInTheDocument()
  })

  it('shows retry-ready failure copy without rendering a fallback preview', async () => {
    vi.mocked(startLocalPublicationPreviewJob).mockResolvedValueOnce({
      job: {
        id: 'preview_job_failed',
        status: 'failed',
        stage: 'done',
        attemptCount: 2,
        sourceHash: 'source_hash_failed',
        errorMessage: '기록집 작성 에이전트가 글을 완성하지 못했어요.',
      },
    })

    render(
      <MemoryRouter>
        <PublicationPreviewScreen />
      </MemoryRouter>,
    )

    expect(await screen.findByText('기록집 작성 에이전트가 글을 완성하지 못했어요.')).toBeInTheDocument()
    expect(screen.queryByTitle('기록집 미리보기')).not.toBeInTheDocument()
  })
})
