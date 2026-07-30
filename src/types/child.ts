export type QuestionPriority = 'urgent' | 'normal' | 'interest'
export type QuestionStatus = 'pending' | 'answered'

export interface ChildQuestion {
  id: string
  text: string
  originalText?: string
  chapterId?: string | null
  category?: string | null
  photoId?: string | null
  anonymous: boolean
  submittedBy?: string
  priority: QuestionPriority
  status: QuestionStatus
  submittedAt: string
}

export interface DemoPhoto {
  id: string
  caption: string
  url?: string
  metadata?: {
    capturedDate?: string
    location?: string
    memo?: string
    linkedQuestion?: string
    [key: string]: unknown
  }
  generatedQuestions: string[]
  registeredQuestions?: string[]
  addedAt: string
}
