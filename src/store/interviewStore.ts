import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Chapter, Transcript } from '../types/interview'
import {
  fetchLocalChapters,
  fetchLocalQuestions,
  fetchLocalInterviewRecords,
  saveLocalInterviewRecord,
  updateLocalInterviewRecordReview,
  updateLocalFamilyQuestion
} from '../lib/local-server'
import { chapterDescriptionOf, chapterTitleOf } from '../lib/chapters'
import { toLocalDateStamp } from '../lib/date'
import { useDevModeStore } from './devModeStore'

interface InterviewState {
  chapters: Chapter[]
  transcripts: Transcript[]
  fetchChaptersAndQuestions: (seniorId?: string | null) => Promise<void>
  fetchTranscripts: (seniorId?: string | null) => Promise<void>
  markQuestionCompleted: (questionId: string, rawText?: string) => Promise<void>
  addTranscript: (transcript: Transcript) => Promise<void>
  updateTranscriptReview: (transcriptId: string, input: {
    reviewStatus: 'pending' | 'applied' | 'revision_requested'
    reviewRequestText?: string | null
  }) => Promise<void>
  getChapterCompletionRate: (chapterId: string) => number
  isChapterReady: (chapterId: string) => boolean
}

export const useInterviewStore = create<InterviewState>()(
  persist(
    (set, get) => ({
      chapters: [],
      transcripts: [],

      fetchChaptersAndQuestions: async (seniorId) => {
        if (useDevModeStore.getState().isOfflineDemo) return
        try {
          const { chapters } = await fetchLocalChapters()
          const { questions } = await fetchLocalQuestions()
          const { records } = await fetchLocalInterviewRecords(seniorId).catch(() => ({ records: [] }))
          const answeredQuestionIds = new Set(
            records
              .map((record: any) => record.questionId)
              .filter((questionId: unknown): questionId is string => typeof questionId === 'string' && questionId.length > 0)
          )

          const mappedChapters = chapters.map((ch: any) => {
            const chQuestions = questions
              .filter((q: any) => q.chapterId === ch.id)
              .map((q: any) => ({
                id: q.id,
                text: q.text,
                chapterId: q.chapterId,
                completed: q.status === 'answered' || answeredQuestionIds.has(q.id),
                answeredAt: q.answeredAt ? toLocalDateStamp(q.answeredAt) : answeredQuestionIds.has(q.id) ? toLocalDateStamp() : undefined,
                createdAt: q.createdAt ?? null,
                category: q.category ?? null,
                photoId: q.photoId ?? null,
                photoUrl: q.photoUrl ?? q.photo?.url ?? null,
              }))
            return {
              id: ch.id,
              // 제목은 서버가 내려준 값을 그대로 쓴다. 여기서 다시 이름 붙이면 정의가 갈라진다.
              title: ch.title,
              description: chapterDescriptionOf(ch.id, `${ch.title} 이야기`),
              order: ch.order,
              questions: chQuestions,
            }
          })
          set({ chapters: mappedChapters })
        } catch (e) {
          console.error('fetchChaptersAndQuestions error:', e)
        }
      },

      fetchTranscripts: async (seniorId) => {
        if (useDevModeStore.getState().isOfflineDemo) return
        try {
          const res = await fetchLocalInterviewRecords(seniorId)
          const mappedTranscripts = res.records.map((r: any) => {
            return {
              id: r.id,
              questionId: r.questionId || '',
              questionText: r.question?.text || '',
              chapterId: r.chapterId,
              chapterTitle: r.chapter?.title || chapterTitleOf(r.chapterId),
              originalText: r.transcriptText,
              aiSummary: r.aiSummary || r.transcriptText,
              mode: r.mode,
              audioFileKey: r.audioFileKey || null,
              audioUrl: r.audioUrl || null,
              publish: r.publish ?? true,
              chatbot: r.chatbot ?? true,
              familyRead: r.familyRead ?? true,
              posthumous: r.posthumous ?? true,
              sensitive: r.sensitive ?? true,
              reviewStatus: r.reviewStatus || 'pending',
              reviewedAt: r.reviewedAt ? toLocalDateStamp(r.reviewedAt) : null,
              reviewRequestText: r.reviewRequestText || null,
              recordedAt: r.recordedAt ? toLocalDateStamp(r.recordedAt) : toLocalDateStamp(),
            }
          })
          set({ transcripts: mappedTranscripts })
        } catch (e) {
          console.error('fetchTranscripts error:', e)
        }
      },

      addTranscript: async (transcript: Transcript) => {
        // Optimistic update
        set((state) => ({ transcripts: [...state.transcripts.filter(t => t.id !== transcript.id), transcript] }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await saveLocalInterviewRecord({
            chapterId: transcript.chapterId,
            questionId: transcript.questionId || undefined,
            transcriptText: transcript.originalText,
            aiSummary: transcript.aiSummary,
            mode: transcript.mode ?? 'voice',
            audioFileKey: transcript.audioFileKey || undefined,
            publish: true,
            chatbot: true,
            familyRead: true,
            posthumous: true,
            sensitive: true
          })
          await get().fetchTranscripts() // Re-fetch to get database details
          await get().fetchChaptersAndQuestions()
        } catch (e) {
          console.error('addTranscript API error:', e)
        }
      },

      updateTranscriptReview: async (transcriptId, input) => {
        const reviewedAt = input.reviewStatus === 'applied' ? toLocalDateStamp() : null

        set((state) => ({
          transcripts: state.transcripts.map((transcript) =>
            transcript.id === transcriptId
              ? {
                ...transcript,
                reviewStatus: input.reviewStatus,
                reviewedAt,
                reviewRequestText: input.reviewRequestText !== undefined
                  ? input.reviewRequestText
                  : transcript.reviewRequestText,
              }
              : transcript
          ),
        }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          const res = await updateLocalInterviewRecordReview(transcriptId, input)
          const record = res.record
          if (record) {
            set((state) => ({
              transcripts: state.transcripts.map((transcript) =>
                transcript.id === transcriptId
                  ? {
                    ...transcript,
                    reviewStatus: record.reviewStatus || transcript.reviewStatus,
                    reviewedAt: record.reviewedAt ? toLocalDateStamp(record.reviewedAt) : transcript.reviewedAt,
                    reviewRequestText: record.reviewRequestText ?? transcript.reviewRequestText,
                  }
                  : transcript
              ),
            }))
          }
          await get().fetchChaptersAndQuestions()
        } catch (e) {
          console.error('updateTranscriptReview API error:', e)
        }
      },

      getChapterCompletionRate: (chapterId: string): number => {
        const ch = get().chapters.find((c) => c.id === chapterId)
        if (!ch || ch.questions.length === 0) return 0
        const done = ch.questions.filter((q) => q.completed).length
        return done / ch.questions.length
      },

      isChapterReady: (chapterId: string): boolean => {
        const ch = get().chapters.find((c) => c.id === chapterId)
        if (!ch || ch.questions.length === 0) return false
        const done = ch.questions.filter((q) => q.completed).length
        return done / ch.questions.length >= 0.7
      },

      markQuestionCompleted: async (questionId, rawText) => {
        let questionText = ''
        let chapterId = ''
        let chapterTitle = ''

        for (const ch of get().chapters) {
          const q = ch.questions.find((q) => q.id === questionId)
          if (q) {
            questionText = q.text
            chapterId = ch.id
            chapterTitle = ch.title
            break
          }
        }

        // Optimistic update
        set((state) => {
          const chapters = state.chapters.map((ch) => ({
            ...ch,
            questions: ch.questions.map((q) =>
              q.id === questionId
                ? { ...q, completed: true, answeredAt: toLocalDateStamp() }
                : q
            ),
          }))

          const originalText = rawText?.trim()
          if (!originalText) return { chapters }

          const newTranscript: Transcript = {
            id: `t_${Date.now()}`,
            questionId,
            questionText,
            chapterId,
            chapterTitle,
            originalText,
            aiSummary: originalText,
            recordedAt: toLocalDateStamp(),
          }

          return { chapters, transcripts: [...state.transcripts.filter(t => t.id !== newTranscript.id), newTranscript] }
        })

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          // Update question status to answered in database
          await updateLocalFamilyQuestion(questionId, { status: 'answered' })
          await get().fetchChaptersAndQuestions() // Re-fetch to sync
        } catch (e) {
          console.error('markQuestionCompleted API error:', e)
        }
      },
    }),
    { name: 'dearlog-interview' }
  )
)
