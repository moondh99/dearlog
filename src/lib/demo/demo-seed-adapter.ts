import { buildCapstoneDemoState, buildDemoAutobiography } from './capstone-demo-data'
import { toLocalDateStamp } from '../date'
import type { ChildQuestion, DemoPhoto, QuestionPriority } from '../../types/child'
import type { Chapter, Question, Transcript } from '../../types/interview'
import type { CalendarEvent, EventType, GhostwriterResult, Paragraph } from '../../types/agents'
import type { UserRole } from '../../types/user'

/**
 * capstone-demo-data.ts 는 구세대 src/store.ts 형태(Memory / StoredPhoto / FamilyQuestion /
 * ChapterNarrative)를 전제로 작성되어 있다. 이 어댑터는 그 데이터를 신세대 스토어
 * (childStore / interviewStore / autobiographyStore / calendarStore / consentStore / authStore)
 * 형태로 변환한다. 구세대 src/store.ts 는 참조하지 않는다.
 */

export const DEMO_SENIOR_ID = 'demo_senior'
export const DEMO_GUARDIAN_ID = 'demo_guardian'
export const DEMO_SENIOR_NAME = '김영자'
export const DEMO_GUARDIAN_NAME = '김민수'
export const DEMO_PHONE_NUMBER = '01012345678'

/** 신세대 인터뷰 챕터 정의 (ChildQuestionsScreen 의 CHAPTER_OPTIONS 와 동일한 id 사용) */
export const DEMO_CHAPTERS: Array<Omit<Chapter, 'questions'>> = [
  { id: 'childhood', title: '어린 시절', description: '태어나서 청소년기까지의 기억', order: 1 },
  { id: 'youth', title: '청년 시절', description: '20~30대 사회에 첫 발을 내딛던 시절', order: 2 },
  { id: 'family_home', title: '결혼과 가족', description: '사랑하는 가족과 함께한 소중한 순간들', order: 3 },
  { id: 'hobbies', title: '일과 삶', description: '삶에 활력을 불어넣어 준 일과 취향', order: 4 },
  { id: 'messages', title: '자녀에게 남기는 말', description: '세월이 담긴 삶의 이야기와 조언', order: 5 },
]

const SUBMITTER_LABELS: Record<string, string> = {
  demo_family_daughter: '딸 김지영',
  demo_family_son: '아들 김민수',
  demo_family_granddaughter: '손녀 민지',
}

const PRIORITY_FROM_DEMO: Record<string, QuestionPriority> = {
  high: 'urgent',
  normal: 'normal',
  low: 'interest',
}

const MESSAGE_MEMORY_PATTERN = /letter|lesson|family_message/

function decadeOf(timePeriod: string): number {
  const matched = timePeriod.match(/\d{4}/)
  return matched ? Number(matched[0]) : 1980
}

/** 기억 카드를 신세대 챕터 id 로 배치한다. */
export function chapterIdForDemoMemory(memoryId: string, timePeriod: string): string {
  if (MESSAGE_MEMORY_PATTERN.test(memoryId)) return 'messages'
  const decade = decadeOf(timePeriod)
  if (decade <= 1960) return 'childhood'
  if (decade <= 1970) return 'youth'
  if (decade <= 1990) return 'family_home'
  return 'hobbies'
}

/** 아직 답변이 없어 연결된 기억 카드가 없는 가족 질문을 챕터에 배치한다. */
export function chapterIdForDemoQuestion(questionText: string): string {
  if (/남기|당부|손주|전하|말씀/.test(questionText)) return 'messages'
  if (/코로나|요즘|최근|스마트폰|손녀/.test(questionText)) return 'hobbies'
  if (/서울|월급|직장|공장|장사|일하/.test(questionText)) return 'youth'
  if (/결혼|아이|자녀|남편|가족|김장/.test(questionText)) return 'family_home'
  return 'childhood'
}

function chapterTitleOf(chapterId: string): string {
  return DEMO_CHAPTERS.find((chapter) => chapter.id === chapterId)?.title ?? '기타'
}

function questionIdForMemory(memoryId: string): string {
  return `demo_question_of_${memoryId}`
}

function transcriptIdForMemory(memoryId: string): string {
  return `demo_transcript_of_${memoryId}`
}

/** '1964_부전시장_엄마와장보기.jpg' -> '부전시장 엄마와장보기' */
export function captionFromFileName(fileName: string | undefined, fallback: string): string {
  if (!fileName) return fallback
  const withoutExtension = fileName.replace(/\.[a-zA-Z0-9]+$/, '')
  const tokens = withoutExtension.split('_').filter((token) => token.length > 0)
  const meaningful = tokens.length > 1 && /^\d{4}$/.test(tokens[0]) ? tokens.slice(1) : tokens
  const caption = meaningful.join(' ').trim()
  return caption.length > 0 ? caption : fallback
}

export interface NewGenDemoSeed {
  seniorId: string
  guardianId: string
  seniorName: string
  guardianName: string
  phoneNumber: string
  photos: DemoPhoto[]
  familyQuestions: ChildQuestion[]
  chapters: Chapter[]
  transcripts: Transcript[]
  autobiographyChapters: GhostwriterResult[]
  calendarEvents: CalendarEvent[]
  consents: Record<string, { publish: boolean; chatbot: boolean }>
}

function toDemoPhotos(
  photos: ReturnType<typeof buildCapstoneDemoState>['photos'],
  familyQuestions: ReturnType<typeof buildCapstoneDemoState>['familyQuestions'],
): DemoPhoto[] {
  return photos.map((photo) => {
    const places = photo.analysis?.places ?? []
    const objects = photo.analysis?.objects ?? []
    const place = places[0] ?? photo.metadata?.inferredPlace ?? '기억 속 장소'
    const registeredQuestions = familyQuestions
      .filter((question) =>
        question.answerMemoryId ? photo.linkedMemoryIds.includes(question.answerMemoryId) : false)
      .map((question) => question.questionText)

    return {
      id: photo.id,
      caption: captionFromFileName(photo.metadata?.fileName, place),
      url: photo.url,
      metadata: {
        capturedDate: toLocalDateStamp(photo.metadata?.capturedAt ?? photo.uploadedAt),
        location: place,
        memo: photo.analysis?.description ?? '',
      },
      generatedQuestions: [
        `이 사진은 ${place}에서 찍은 사진인가요?`,
        objects.length > 0
          ? `사진 속 ${objects[0]}에는 어떤 사연이 있나요?`
          : '이 사진을 보면 어떤 마음이 드시나요?',
        '이 날 가장 기억에 남는 순간은 무엇인가요?',
      ],
      registeredQuestions,
      addedAt: toLocalDateStamp(photo.uploadedAt),
    }
  })
}

function toChildQuestions(
  familyQuestions: ReturnType<typeof buildCapstoneDemoState>['familyQuestions'],
  chapterIdByMemoryId: Map<string, string>,
  photoIdByMemoryId: Map<string, string>,
): ChildQuestion[] {
  return familyQuestions.map((question) => {
    const memoryId = question.answerMemoryId
    return {
      id: question.id,
      text: question.questionText,
      chapterId: (memoryId ? chapterIdByMemoryId.get(memoryId) : null)
        ?? chapterIdForDemoQuestion(question.questionText),
      category: null,
      photoId: memoryId ? photoIdByMemoryId.get(memoryId) ?? null : null,
      anonymous: question.anonymous,
      submittedBy: SUBMITTER_LABELS[question.submittedBy] ?? '자녀',
      priority: PRIORITY_FROM_DEMO[question.priority] ?? 'normal',
      status: question.status === 'answered' ? 'answered' : 'pending',
      submittedAt: toLocalDateStamp(question.createdAt),
    }
  })
}

function toAutobiographyChapters(sentenceEndings: string[]): GhostwriterResult[] {
  const { chapters } = buildDemoAutobiography()

  return chapters.map((narrative) => {
    const sourceChunkIds = narrative.citations.map((citation) => citation.memoryId)
    const paragraphs: Paragraph[] = narrative.body
      .split('\n\n')
      .map((text) => text.trim())
      .filter((text) => text.length > 0)
      .map((text, index) => ({
        paragraphId: `${narrative.chapterId}_paragraph_${index + 1}`,
        text,
        sourceChunkIds,
        reliability: 'CONFIRMED' as const,
      }))

    return {
      chapterId: narrative.chapterId,
      chapterTitle: narrative.title,
      paragraphs,
      missingSections: [],
      toneProfile: { name: '이야기책 형태', patterns: sentenceEndings },
    }
  })
}

function toCalendarEvents(
  events: ReturnType<typeof buildCapstoneDemoState>['calendarEvents'],
): CalendarEvent[] {
  return events.map((event) => ({
    eventId: event.id,
    eventType: event.eventType as EventType,
    eventDate: toLocalDateStamp(event.date),
    relatedPersons: event.relatedPeople,
    recipientId: DEMO_SENIOR_ID,
  }))
}

/** 발표 데모 데이터를 신세대 스토어 형태로 변환한다. */
export function buildNewGenDemoSeed(): NewGenDemoSeed {
  const demo = buildCapstoneDemoState()

  const chapterIdByMemoryId = new Map<string, string>()
  for (const memory of demo.memories) {
    chapterIdByMemoryId.set(memory.id, chapterIdForDemoMemory(memory.id, memory.tags.timePeriod))
  }

  // Memory 타입에는 linkedPhotoIds 가 없으므로 사진의 linkedMemoryIds 로 역방향 색인을 만든다.
  const photoIdByMemoryId = new Map<string, string>()
  for (const photo of demo.photos) {
    for (const memoryId of photo.linkedMemoryIds) {
      if (!photoIdByMemoryId.has(memoryId)) {
        photoIdByMemoryId.set(memoryId, photo.id)
      }
    }
  }

  const transcripts: Transcript[] = demo.memories.map((memory) => {
    const chapterId = chapterIdByMemoryId.get(memory.id) ?? 'childhood'
    return {
      id: transcriptIdForMemory(memory.id),
      questionId: questionIdForMemory(memory.id),
      questionText: `${memory.topic} 이야기를 들려주세요`,
      chapterId,
      chapterTitle: chapterTitleOf(chapterId),
      originalText: memory.originalTranscript,
      aiSummary: memory.publishVersion,
      mode: 'voice',
      audioFileKey: null,
      audioUrl: null,
      reviewStatus: 'applied',
      reviewedAt: toLocalDateStamp(memory.date),
      reviewRequestText: null,
      recordedAt: toLocalDateStamp(memory.date),
    }
  })

  const answeredQuestions: Question[] = demo.memories.map((memory) => ({
    id: questionIdForMemory(memory.id),
    text: `${memory.topic} 이야기를 들려주세요`,
    chapterId: chapterIdByMemoryId.get(memory.id) ?? 'childhood',
    completed: true,
    answeredAt: toLocalDateStamp(memory.date),
    createdAt: memory.date,
    category: null,
    photoId: photoIdByMemoryId.get(memory.id) ?? null,
    photoUrl: null,
  }))

  const pendingQuestions: Question[] = demo.familyQuestions
    .filter((question) => question.status !== 'answered')
    .map((question) => ({
      id: question.id,
      text: question.questionText,
      chapterId: chapterIdForDemoQuestion(question.questionText),
      completed: false,
      createdAt: question.createdAt,
      category: '가족질문',
      photoId: null,
      photoUrl: null,
    }))

  const allQuestions = [...answeredQuestions, ...pendingQuestions]
  const chapters: Chapter[] = DEMO_CHAPTERS.map((chapter) => ({
    ...chapter,
    questions: allQuestions.filter((question) => question.chapterId === chapter.id),
  }))

  const consents = transcripts.reduce<Record<string, { publish: boolean; chatbot: boolean }>>(
    (acc, transcript) => {
      acc[transcript.id] = { publish: true, chatbot: true }
      return acc
    },
    {},
  )

  return {
    seniorId: DEMO_SENIOR_ID,
    guardianId: DEMO_GUARDIAN_ID,
    seniorName: DEMO_SENIOR_NAME,
    guardianName: DEMO_GUARDIAN_NAME,
    phoneNumber: DEMO_PHONE_NUMBER,
    photos: toDemoPhotos(demo.photos, demo.familyQuestions),
    familyQuestions: toChildQuestions(demo.familyQuestions, chapterIdByMemoryId, photoIdByMemoryId),
    chapters,
    transcripts,
    autobiographyChapters: toAutobiographyChapters(demo.speechProfile.sentenceEndings),
    calendarEvents: toCalendarEvents(demo.calendarEvents),
    consents,
  }
}

export interface DemoRoleProfile {
  role: UserRole
  userId: string
  userName: string
}

export const DEMO_ROLE_PROFILES: Record<UserRole, DemoRoleProfile> = {
  child: { role: 'child', userId: DEMO_GUARDIAN_ID, userName: DEMO_GUARDIAN_NAME },
  parent: { role: 'parent', userId: DEMO_SENIOR_ID, userName: DEMO_SENIOR_NAME },
}
