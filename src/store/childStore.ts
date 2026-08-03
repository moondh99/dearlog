import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ChildQuestion, DemoPhoto, QuestionPriority, QuestionStatus } from '../types/child'
import {
  fetchLocalPhotos,
  updateLocalPhoto,
  deleteLocalPhoto,
  fetchLocalFamilyQuestions,
  updateLocalFamilyQuestion,
  deleteLocalFamilyQuestion,
  createLocalQuestion,
  createLocalPhotoQuestion
} from '../lib/local-server'
import { toLocalDateStamp } from '../lib/date'
import { useDevModeStore } from './devModeStore'

const PRIORITY_TO_DB: Record<QuestionPriority, 'high' | 'normal' | 'low'> = {
  urgent: 'high',
  normal: 'normal',
  interest: 'low'
}

const PRIORITY_FROM_DB: Record<'high' | 'normal' | 'low', QuestionPriority> = {
  high: 'urgent',
  normal: 'normal',
  low: 'interest'
}

export const DEMO_PHOTO_TEMPLATES = [
  {
    caption: '가족 나들이 사진',
    generatedQuestions: [
      '이 사진은 어디에서 찍은 건가요?',
      '이 날 가장 기억에 남는 순간은 무엇인가요?',
      '함께 있는 사람들은 누구인가요?'
    ]
  },
  {
    caption: '어린 시절 추억 사진',
    generatedQuestions: [
      '이때 몇 살이셨나요?',
      '이 장소는 어디인가요?',
      '이때의 기분이 어땠나요?'
    ]
  },
  {
    caption: '특별한 날 기념 사진',
    generatedQuestions: [
      '이 날은 무슨 날이었나요?',
      '이 날의 특별한 기억이 있으신가요?',
      '이 사진을 보면 어떤 감정이 드나요?'
    ]
  }
]

interface ChildState {
  questions: ChildQuestion[]
  photos: DemoPhoto[]
  activeSeniorId: string | null
  setActiveSeniorId: (id: string | null) => void
  fetchPhotos: () => Promise<void>
  setPhotoConsent: (photoId: string, key: 'publish' | 'familyRead' | 'posthumous' | 'sensitive', value: boolean) => Promise<void>
  fetchQuestions: () => Promise<void>
  addQuestion: (q: { text: string; originalText?: string; anonymous: boolean; submittedBy?: string; priority: QuestionPriority; chapterId?: string | null; seniorId?: string | null }) => Promise<void>
  addPhoto: (p: { id?: string; caption: string; url?: string; metadata?: DemoPhoto['metadata']; generatedQuestions: string[]; registeredQuestions?: string[] }) => void
  markQuestionAsAddedFromPhoto: (photoId: string, questionText: string, seniorId?: string | null) => Promise<void>
  updateQuestion: (id: string, updates: Partial<ChildQuestion>) => Promise<void>
  deleteQuestion: (id: string) => Promise<void>
  deletePhoto: (id: string) => Promise<void>
}

export const useChildStore = create<ChildState>()(
  persist(
    (set, get) => ({
      questions: [],
      photos: [],
      activeSeniorId: null,
      setActiveSeniorId: (id) => set({ activeSeniorId: id }),

      fetchPhotos: async () => {
        if (useDevModeStore.getState().isOfflineDemo) return
        try {
          const res = await fetchLocalPhotos()
          const mapped = res.photos.map((p: any) => ({
            id: p.id,
            caption: p.metadata?.memo || p.fileName || '가족 사진',
            url: p.url,
            metadata: p.metadata,
            generatedQuestions: p.generatedQuestions || [],
            registeredQuestions: p.registeredQuestions || [],
            addedAt: p.uploadedAt ? toLocalDateStamp(p.uploadedAt) : toLocalDateStamp(),
            publish: p.publish ?? true,
            familyRead: p.familyRead ?? true,
            posthumous: p.posthumous ?? true,
            sensitive: p.sensitive ?? true,
          }))
          set({ photos: mapped })
        } catch (e) {
          console.error('fetchPhotos error:', e)
        }
      },

      setPhotoConsent: async (photoId, key, value) => {
        const previous = get().photos.find((photo) => photo.id === photoId)
        set((state) => ({
          photos: state.photos.map((photo) =>
            photo.id === photoId ? { ...photo, [key]: value } : photo
          ),
        }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await updateLocalPhoto(photoId, { [key]: value })
        } catch (e) {
          console.error('setPhotoConsent error:', e)
          // 서버가 거절하면 화면만 바뀌어 철회한 줄 아는 상태가 남는다.
          if (previous) {
            set((state) => ({
              photos: state.photos.map((photo) => (photo.id === photoId ? previous : photo)),
            }))
          }
          throw e
        }
      },

      fetchQuestions: async () => {
        if (useDevModeStore.getState().isOfflineDemo) return
        try {
          const res = await fetchLocalFamilyQuestions()
          const mapped = res.questions.map((q: any) => ({
            id: q.id,
            text: q.questionText,
            chapterId: q.chapterId ?? null,
            category: q.category ?? null,
            photoId: q.photoId ?? null,
            anonymous: q.anonymous,
            submittedBy: q.submittedBy || '자녀',
            priority: PRIORITY_FROM_DB[q.priority as 'high' | 'normal' | 'low'] || 'normal',
            status: (q.status === 'answered' ? 'answered' : 'pending') as QuestionStatus,
            submittedAt: q.createdAt ? toLocalDateStamp(q.createdAt) : toLocalDateStamp()
          }))
          set({ questions: mapped })
        } catch (e) {
          console.error('fetchQuestions error:', e)
        }
      },

      addQuestion: async ({ text, originalText, anonymous, submittedBy, priority, chapterId, seniorId }) => {
        if (useDevModeStore.getState().isOfflineDemo) {
          set((state) => ({
            questions: [
              {
                id: `demo_question_${Date.now()}`,
                text,
                originalText,
                anonymous,
                submittedBy: submittedBy || '자녀',
                priority,
                chapterId: chapterId ?? null,
                category: null,
                photoId: null,
                status: 'pending',
                submittedAt: toLocalDateStamp(),
              },
              ...state.questions,
            ],
          }))
          return
        }
        try {
          const dbPriority = PRIORITY_TO_DB[priority] || 'normal'
          const res = await createLocalQuestion(text, chapterId || undefined, seniorId || undefined)
          // Update details like anonymous and priority
          await updateLocalFamilyQuestion(res.question.id, {
            anonymous,
            priority: dbPriority
          })

          await get().fetchQuestions() // Re-fetch all questions from DB
        } catch (e) {
          console.error('addQuestion backend sync error:', e)
        }
      },

      addPhoto: (p) => {
        const newPhoto: DemoPhoto = {
          id: p.id || `cp_${Date.now()}`,
          caption: p.caption,
          url: p.url,
          metadata: p.metadata,
          generatedQuestions: p.generatedQuestions,
          registeredQuestions: p.registeredQuestions || [],
          addedAt: toLocalDateStamp()
        }
        set((state) => ({
          photos: [...state.photos.filter(x => x.id !== newPhoto.id), newPhoto]
        }))
      },

      markQuestionAsAddedFromPhoto: async (photoId, questionText, seniorId) => {
        if (useDevModeStore.getState().isOfflineDemo) {
          set((state) => ({
            photos: state.photos.map((photo) =>
              photo.id === photoId
                ? {
                  ...photo,
                  registeredQuestions: Array.from(new Set([...(photo.registeredQuestions || []), questionText])),
                }
                : photo
            ),
            questions: state.questions.some((question) => question.text === questionText)
              ? state.questions
              : [
                {
                  id: `demo_photo_question_${Date.now()}`,
                  text: questionText,
                  anonymous: false,
                  submittedBy: '자녀',
                  priority: 'normal',
                  chapterId: 'childhood',
                  category: '사진질문',
                  photoId,
                  status: 'pending',
                  submittedAt: toLocalDateStamp(),
                },
                ...state.questions,
              ],
          }))
          return
        }
        try {
          const res = await createLocalPhotoQuestion({
            text: questionText,
            photoId,
            chapterId: 'childhood',
            seniorId,
          })
          await updateLocalFamilyQuestion(res.question.id, {
            anonymous: false,
            priority: 'normal'
          })
          set((state) => ({
            photos: state.photos.map((photo) =>
              photo.id === photoId
                ? {
                  ...photo,
                  registeredQuestions: Array.from(new Set([...(photo.registeredQuestions || []), questionText])),
                }
                : photo
            ),
          }))
          await get().fetchQuestions()
        } catch (e) {
          console.error('markQuestionAsAddedFromPhoto error:', e)
        }
      },

      updateQuestion: async (id, updates) => {
        if (useDevModeStore.getState().isOfflineDemo) {
          set((state) => ({
            questions: state.questions.map((question) =>
              question.id === id ? { ...question, ...updates } : question
            ),
          }))
          return
        }
        try {
          const dbUpdates: any = {}
          if (updates.priority) dbUpdates.priority = PRIORITY_TO_DB[updates.priority]
          if (updates.anonymous !== undefined) dbUpdates.anonymous = updates.anonymous
          if (updates.status) dbUpdates.status = updates.status
          if (updates.text) dbUpdates.text = updates.text

          await updateLocalFamilyQuestion(id, dbUpdates)
          await get().fetchQuestions()
        } catch (e) {
          console.error('updateQuestion error:', e)
        }
      },

      deleteQuestion: async (id) => {
        if (useDevModeStore.getState().isOfflineDemo) {
          set((state) => ({ questions: state.questions.filter((question) => question.id !== id) }))
          return
        }
        try {
          await deleteLocalFamilyQuestion(id)
          await get().fetchQuestions()
        } catch (e) {
          console.error('deleteQuestion error:', e)
          set((state) => ({ questions: state.questions.filter((q) => q.id !== id) }))
        }
      },

      deletePhoto: async (id) => {
        if (useDevModeStore.getState().isOfflineDemo) {
          set((state) => ({ photos: state.photos.filter((photo) => photo.id !== id) }))
          return
        }
        try {
          await deleteLocalPhoto(id)
          await get().fetchPhotos()
        } catch (e) {
          console.error('deletePhoto error:', e)
          set((state) => ({ photos: state.photos.filter((p) => p.id !== id) }))
        }
      }
    }),
    { name: 'dearlog-child' }
  )
)
