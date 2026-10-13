import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Transcript } from '../types/interview'

const save = vi.hoisted(() => vi.fn())
vi.mock('../lib/local-server', () => ({
  fetchLocalChapters: vi.fn(async () => ({ chapters: [] })),
  fetchLocalQuestions: vi.fn(async () => ({ questions: [] })),
  fetchLocalInterviewRecords: vi.fn(async () => ({ records: [] })),
  saveLocalInterviewRecord: save,
  updateLocalInterviewRecordReview: vi.fn(),
  updateLocalFamilyQuestion: vi.fn(),
}))

const { useInterviewStore } = await import('./interviewStore')

const transcript = { id: 't1', chapterId: 'childhood', questionId: 'common_01', originalText: '강가 마을에서 자랐어요.', aiSummary: '요약', mode: 'text' } as Transcript

describe('addTranscript', () => {
  beforeEach(() => {
    save.mockReset()
    useInterviewStore.setState({ transcripts: [] })
  })

  it('tells the caller when the server refused the record, so the screen cannot say "saved"', async () => {
    save.mockRejectedValue(new Error('현재 예시 체험과 문의만 받고 있습니다.'))
    await expect(useInterviewStore.getState().addTranscript(transcript)).rejects.toThrow('예시 체험')
  })
})
