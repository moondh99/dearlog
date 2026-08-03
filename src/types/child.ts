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
  // 사진 목적별 동의. 사진은 챗봇 근거로 쓰이지 않아 chatbot은 없다.
  publish?: boolean
  familyRead?: boolean
  posthumous?: boolean
  sensitive?: boolean
}
