export type ReliabilityLabel = 'CONFIRMED' | 'ESTIMATED' | 'UNVERIFIED'

export interface NERTags {
  persons: string[]
  places: string[]
  times: string[]
  events: string[]
}

export interface EmotionTags {
  pride: number
  nostalgia: number
  regret: number
  gratitude: number
  loss: number
  joy: number
  fear: number
  peace: number
}

export interface MemoryChunk {
  raw: string
  clean: string
  tags: {
    ner: NERTags
    emotions: EmotionTags
  }
  reliabilityLabel: ReliabilityLabel
  chapterHint: string
  timelinePosition?: string
}

export interface ArchivistResult {
  chunk: MemoryChunk
  chunkId: string
  createdAt: string
}

export interface InterviewerResult {
  question: string
  detectedKeywords: {
    persons: string[]
    places: string[]
    emotions: string[]
    events: string[]
  }
  confidence: 'high' | 'medium' | 'low'
}

export type ConflictType = 'TIME_CONFLICT' | 'PERSON_CONFLICT' | 'FACT_CONFLICT' | 'DUPLICATE'

export interface Conflict {
  conflictType: ConflictType
  conflictingChunkId: string
  description: string
  recommendedAction: string
}

export interface VerificationResult {
  chunkId: string
  status: 'PASS' | 'FLAG'
  reliabilityScore: ReliabilityLabel
  uncertaintyFlag: boolean
  conflicts: Conflict[]
  verifiedAt: string
}

export interface ToneProfile {
  patterns: string[]
  name: string
}

export interface EvidenceBadge {
  usedChunkIds: string[]
  reliability: ReliabilityLabel
  note: string
}

export interface DigitalTwinResult {
  responseText: string
  questionType: 'fact' | 'recall' | 'value' | 'person'
  evidenceBadge: EvidenceBadge
  fallbackTriggered: boolean
  suggestedInterviewTopic?: string
}

export interface Paragraph {
  paragraphId: string
  text: string
  sourceChunkIds: string[]
  reliability: ReliabilityLabel
  uncertaintyNote?: string
}

export interface GhostwriterResult {
  chapterId: string
  chapterTitle: string
  paragraphs: Paragraph[]
  missingSections: string[]
  toneProfile: ToneProfile
}

export interface QuestionQueueResult {
  originalQuestion: string
  reformulatedQuestion: string
  priority: number
  isAnonymous: boolean
  transformReason: string
  sensitivityLevel: 'low' | 'medium' | 'high'
  suggestedTopic: string
}

export type EventType = '결혼식' | '졸업식' | '생일' | '기념일' | '기일' | '입학' | '출산'

export interface CalendarEvent {
  eventId: string
  eventType: EventType
  eventDate: string
  relatedPersons: string[]
  recipientId: string
}

export interface EditedStory {
  text: string
  sourceChunkIds: string[]
  reliability: ReliabilityLabel
}

export interface CalendarTriggerResult {
  eventId: string
  triggerType: 'DELIVERY' | 'INTERVIEW'
  editedStory: EditedStory | null
  suggestedInterviewTopics: string[]
  matchedChunkIds: string[]
}
