import type { MemoryChunk } from './agents'

export interface Question {
  id: string
  text: string
  chapterId: string
  completed: boolean
  answeredAt?: string
  createdAt?: string | null
  category?: string | null
  photoId?: string | null
  photoUrl?: string | null
}

export interface Chapter {
  id: string
  title: string
  description: string
  order: number
  questions: Question[]
}

export type TranscriptReviewStatus = 'pending' | 'applied' | 'revision_requested' | string

export interface Transcript {
  id: string
  questionId: string
  questionText: string
  chapterId: string
  chapterTitle: string
  originalText: string
  aiSummary: string
  mode?: 'photo' | 'phone' | 'app_call' | 'text' | 'voice' | string
  audioFileKey?: string | null
  audioUrl?: string | null
  publish?: boolean
  chatbot?: boolean
  reviewStatus?: TranscriptReviewStatus
  reviewedAt?: string | null
  reviewRequestText?: string | null
  recordedAt: string
  chunk?: MemoryChunk
}
