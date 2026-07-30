import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronLeft, ChevronRight, Mic, MicOff, Pause, Phone, Volume2 } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import { generateFollowUpQuestion } from '../lib/agents/interviewer'
import { archiveTranscript } from '../lib/agents/archivist'
import { verifyChunk } from '../lib/agents/verification'
import { toLocalDateStamp } from '../lib/date'
import { synthesizeLocalQuestionSpeech, transcribeLocalAudio, uploadLocalAudio } from '../lib/local-server'
import { useAuthStore } from '../store/authStore'
import { useInterviewStore } from '../store/interviewStore'
import type { Chapter, Question } from '../types/interview'
import type { Conflict } from '../types/agents'
import type { Transcript } from '../types/interview'
import parentRecordPhoto from '../assets/figma/parent-record-photo.jpg'

// ─── Types ───────────────────────────────────────────────────────────────────

type InterviewType = 'manual' | 'scheduled' | 'family_question'
type ScreenState = 'select' | 'incoming' | 'voice' | 'active' | 'done'
type RecordState = 'idle' | 'requesting' | 'recording' | 'processing' | 'done'
type RecordFilter = 'all' | 'photo' | 'text' | 'completed'
type AnswerMode = 'voice' | 'text' | 'phone'
type SpeechStatus = 'idle' | 'speaking' | 'unsupported'

interface QuestionItem { question: Question; chapter: Chapter }
type AnsweredItem = {
  questionId: string
  chapterId: string
  chapterTitle: string
  questionText: string
  rawText: string
  answerMode?: AnswerMode
  durationSeconds?: number
  audioFileKey?: string | null
}

function isFamilyCreatedQuestion(question: Question) {
  return question.category === 'guardian_questions' || question.category === 'photo_questions'
}

function getQuestionTime(question: Question) {
  const parsed = Date.parse(question.createdAt ?? '')
  return Number.isFinite(parsed) ? parsed : 0
}

function compareParentQuestionItems(a: QuestionItem, b: QuestionItem) {
  const aIsOpenFamilyQuestion = !a.question.completed && isFamilyCreatedQuestion(a.question)
  const bIsOpenFamilyQuestion = !b.question.completed && isFamilyCreatedQuestion(b.question)

  if (aIsOpenFamilyQuestion !== bIsOpenFamilyQuestion) {
    return aIsOpenFamilyQuestion ? -1 : 1
  }

  if (aIsOpenFamilyQuestion && bIsOpenFamilyQuestion) {
    const createdAtDiff = getQuestionTime(b.question) - getQuestionTime(a.question)
    if (createdAtDiff !== 0) return createdAtDiff
  }

  const chapterDiff = a.chapter.order - b.chapter.order
  if (chapterDiff !== 0) return chapterDiff

  return getQuestionTime(a.question) - getQuestionTime(b.question)
}

const SEEN_FAMILY_QUESTIONS_STORAGE_PREFIX = 'dearlog-parent-seen-family-questions'

function getSeenFamilyQuestionsStorageKey(userId: string | null) {
  return `${SEEN_FAMILY_QUESTIONS_STORAGE_PREFIX}:${userId || 'anonymous'}`
}

function readSeenFamilyQuestionIds(userId: string | null) {
  if (typeof window === 'undefined') return new Set<string>()

  try {
    const rawValue = window.localStorage.getItem(getSeenFamilyQuestionsStorageKey(userId))
    const parsedValue = rawValue ? JSON.parse(rawValue) : []
    const questionIds = Array.isArray(parsedValue)
      ? parsedValue.filter((id): id is string => typeof id === 'string')
      : []
    return new Set(questionIds)
  } catch {
    return new Set<string>()
  }
}

function writeSeenFamilyQuestionIds(userId: string | null, questionIds: Set<string>) {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.setItem(getSeenFamilyQuestionsStorageKey(userId), JSON.stringify([...questionIds]))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

const INCOMING_SUBTITLES: Record<InterviewType, string> = {
  manual: '오늘의 이야기를 들려주세요',
  scheduled: '약속한 시간이 됐어요 👋',
  family_question: '가족이 궁금한 게 있대요 💬',
}

function requestAudioStreamWithTimeout(timeoutMs = 10000) {
  return Promise.race([
    navigator.mediaDevices.getUserMedia({ audio: true }),
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error('마이크 권한 확인 시간이 초과되었습니다.')), timeoutMs)
    }),
  ])
}

// ─── Shared Dark Icons ────────────────────────────────────────────────────────

function DkMuteIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="11" rx="3" stroke="white" strokeWidth="1.8" />
      <path d="M5 11V12C5 15.87 8.13 19 12 19" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
      <line x1="3" y1="3" x2="21" y2="21" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function DkKeypadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      {[4, 12, 20].map((cx) =>
        [5, 12, 19].map((cy) => (
          <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="1.5" fill="white" />
        ))
      )}
    </svg>
  )
}
function DkSpeakerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M11 5L6 9H2V15H6L11 19V5Z" fill="white" />
      <path d="M19.07 4.93C20.98 6.84 22 9.36 22 12C22 14.64 20.98 17.16 19.07 19.07" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}
function DkNextIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M5 4L15 12L5 20V4Z" fill="white" />
      <rect x="17" y="4" width="2" height="16" rx="1" fill="white" />
    </svg>
  )
}
function PhoneEndIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M23.54 16.26C22.49 15.21 21.1 14.63 19.62 14.63C18.14 14.63 16.74 15.21 15.69 16.26L13.85 18.1C11.01 16.67 8.63 14.29 7.2 11.45L9.04 9.61C10.09 8.56 10.67 7.17 10.67 5.69C10.67 4.21 10.09 2.81 9.04 1.76L7.34 0.060C6.29 -0.99 4.9 -0.07 4.34 0.49L0.69 4.14C0.24 4.59 -0.01 5.21 0 5.86C0.07 9.18 1.42 12.41 3.83 14.82C6.24 17.23 9.47 18.58 12.79 18.65C13.44 18.66 14.06 18.41 14.51 17.96L18.16 14.31C18.72 13.75 19.28 12.97 19.07 12.11C18.52 10.44 16.57 9.16 14.53 9.73L13.48 10.08" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}
function PhoneAcceptSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M6.6 10.8C8 13.6 10.4 16 13.2 17.4L15.4 15.2C15.69 14.91 16.08 14.82 16.43 14.93C17.55 15.3 18.75 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.8 8.6L6.6 10.8Z" fill="white" />
    </svg>
  )
}
function PhoneDeclineSvg() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path
        d="M6.6 10.8C8 13.6 10.4 16 13.2 17.4L15.4 15.2C15.69 14.91 16.08 14.82 16.43 14.93C17.55 15.3 18.75 15.5 20 15.5C20.55 15.5 21 15.95 21 16.5V20C21 20.55 20.55 21 20 21C10.61 21 3 13.39 3 4C3 3.45 3.45 3 4 3H7.5C8.05 3 8.5 3.45 8.5 4C8.5 5.25 8.7 6.45 9.07 7.57C9.18 7.92 9.1 8.31 8.8 8.6L6.6 10.8Z"
        fill="white"
        transform="rotate(135 12 12)"
      />
    </svg>
  )
}

// ─── Screen 1: Record Select ──────────────────────────────────────────────────

function ParentRecordHeader({ onBack }: { onBack?: () => void }) {
  return (
    <>
      <header className="flex h-[60px] shrink-0 items-center gap-3 px-6 py-5">
        {onBack ? (
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7A767F] transition active:bg-[#EDE8F0]"
            aria-label="부모 홈으로 돌아가기"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        ) : null}
        <div>
          <p className="text-[4px] font-medium uppercase leading-[6px] tracking-[1.25px] text-[#2A2830]">
            FAMILY ARCHIVE
          </p>
          <p className="font-serif text-[18px] font-semibold leading-[22px] text-[#183025]">Dearlog</p>
        </div>
      </header>
      <div className="h-px shrink-0 bg-[#E0DBE8]" />
    </>
  )
}

function RecordBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: 'neutral' | 'accent' | 'photo' | 'new'
}) {
  const toneClass = tone === 'new'
    ? 'border-[#F2DC8C] bg-[#FFF7D6] text-[#7A5B12]'
    : tone === 'photo'
      ? 'border-[#9485BE]/25 bg-[#9485BE]/10 text-[#6A5AA0]'
      : tone === 'accent'
        ? 'border-[#AFA3D0]/30 bg-[#AFA3D0]/15 text-[#5E527E]'
        : 'border-[#E0DBE8] bg-[#EDE8F0] text-[#7A767F]'

  return (
    <span className={`inline-flex h-[28px] items-center rounded-full border px-[11px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] ${toneClass}`}>
      {children}
    </span>
  )
}

function RecordPrimaryButton({
  children,
  onClick,
  variant = 'primary',
}: {
  children: ReactNode
  onClick: () => void
  variant?: 'primary' | 'secondary'
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-[51px] w-full items-center justify-center rounded-[14px] text-[14px] font-medium leading-[21px] tracking-[0.42px] transition active:scale-[0.99] ${
        variant === 'primary'
          ? 'bg-[#2A2830] text-[#F7F5FB]'
          : 'border border-[#E0DBE8] bg-white text-[#2A2830]'
      }`}
    >
      {children}
    </button>
  )
}

function RecordPhotoCard({
  item,
  highlightNew = false,
  onSelect,
}: {
  item: QuestionItem
  highlightNew?: boolean
  onSelect: (item: QuestionItem) => void
}) {
  const title = item.question.text || '이 사진을 찍은 날의 이야기를 들려주세요.'
  const photoUrl = item.question.photoUrl || parentRecordPhoto

  return (
    <article className="overflow-hidden rounded-2xl border border-[#E0DBE8] bg-white shadow-[0_2px_14px_rgba(42,40,48,0.07)]">
      <div className="relative h-[140px] overflow-hidden">
        <img src={photoUrl} alt="질문과 연결된 가족 사진" className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
        <div className="absolute left-4 top-3">
          <RecordBadge tone="photo">사진 질문</RecordBadge>
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap gap-2">
          {highlightNew ? <RecordBadge tone="new">새 질문</RecordBadge> : null}
          <RecordBadge>{item.chapter.title}</RecordBadge>
        </div>
        <h3 className="mt-3 font-serif text-[17px] font-semibold leading-[25.5px] text-[#2A2830]">
          {title}
        </h3>
        <p className="mt-2 text-[12px] font-normal leading-[18px] text-[#7A767F]">
          사진을 보고 기억나는 이야기를 편하게 들려주세요.
        </p>
        <div className="mt-4">
          <RecordPrimaryButton onClick={() => onSelect(item)}>이야기하기</RecordPrimaryButton>
        </div>
      </div>
    </article>
  )
}

function RecordTextCard({
  item,
  highlightNew = false,
  onSelect,
}: {
  item: QuestionItem
  highlightNew?: boolean
  onSelect: (item: QuestionItem) => void
}) {
  return (
    <article className="rounded-2xl border border-[#E0DBE8] bg-white p-5 shadow-[0_2px_14px_rgba(42,40,48,0.07)]">
      <div className="flex flex-wrap gap-2">
        {highlightNew ? <RecordBadge tone="new">새 질문</RecordBadge> : null}
        <RecordBadge tone="accent">텍스트 질문</RecordBadge>
        <RecordBadge>{item.chapter.title}</RecordBadge>
      </div>
      <h3 className="mt-4 font-serif text-[17px] font-semibold leading-[25.5px] text-[#2A2830]">
        {item.question.text}
      </h3>
      <p className="mt-2 text-[12px] font-normal leading-[18px] text-[#7A767F]">
        편한 방법으로 이야기해주세요. 녹음이나 직접 입력 모두 가능해요.
      </p>
      <div className="mt-4">
        <RecordPrimaryButton onClick={() => onSelect(item)}>답하기</RecordPrimaryButton>
      </div>
    </article>
  )
}

function RecordCompletedCard({
  item,
  transcript,
  onViewTranscript,
}: {
  item: QuestionItem
  transcript?: Transcript
  onViewTranscript: () => void
}) {
  const recordedAt = transcript?.recordedAt ? transcript.recordedAt.replaceAll('-', '.') : item.question.answeredAt?.replaceAll('-', '.') ?? '기록 완료'
  const modeLabel = transcript?.mode === 'photo'
    ? '사진 답변'
    : transcript?.mode === 'text'
      ? '텍스트 답변'
      : '음성 답변'

  return (
    <article className="rounded-2xl border border-[#E0DBE8] bg-white p-5 shadow-[0_2px_14px_rgba(42,40,48,0.07)]">
      <div className="flex flex-wrap gap-2">
        <RecordBadge tone="accent">답변 완료</RecordBadge>
        <RecordBadge>{item.chapter.title}</RecordBadge>
      </div>
      <h3 className="mt-4 font-serif text-[16px] font-normal leading-6 text-[#2A2830]">
        {item.question.text}
      </h3>
      <p className="mt-1 text-[12px] font-normal leading-[18px] text-[#7A767F]">
        {recordedAt} · {modeLabel}
      </p>
      <div className="mt-4">
        <RecordPrimaryButton variant="secondary" onClick={onViewTranscript}>다시 보기</RecordPrimaryButton>
      </div>
    </article>
  )
}

function RecordSelectView({
  items,
  transcripts,
  seenQuestionIds,
  initialFilter = 'all',
  onBack,
  onSelectItem,
  onViewTranscript,
}: {
  items: QuestionItem[]
  transcripts: Transcript[]
  seenQuestionIds: Set<string>
  initialFilter?: RecordFilter
  onBack: () => void
  onSelectItem: (item: QuestionItem) => void
  onViewTranscript: () => void
}) {
  const [filter, setFilter] = useState<RecordFilter>(initialFilter)
  useEffect(() => {
    setFilter(initialFilter)
  }, [initialFilter])

  const introCopy = {
    all: {
      title: '기록할 이야기를 골라주세요',
      description: '자녀가 준비한 사진과 질문을 보고 편한 것부터 답해보세요.',
    },
    photo: {
      title: '사진을 보며 이야기해주세요',
      description: '가족이 올린 사진을 보고 떠오르는 기억부터 남겨보세요.',
    },
    text: {
      title: '질문을 골라 답해주세요',
      description: '가족이 준비한 질문 중 편하게 답할 수 있는 것부터 시작해보세요.',
    },
    completed: {
      title: '남긴 이야기를 확인해주세요',
      description: '이미 답변한 이야기와 정리된 기록을 다시 살펴볼 수 있어요.',
    },
  } satisfies Record<RecordFilter, { title: string; description: string }>
  const isPhotoQuestion = (item: QuestionItem) =>
    item.question.category === 'photo_questions' || Boolean(item.question.photoId)
  const pendingItems = items.filter((item) => !item.question.completed)
  const photoItems = pendingItems.filter((item) => isPhotoQuestion(item))
  const textItems = items
    .filter((item) => !item.question.completed && !isPhotoQuestion(item))
  const completedItems = items.filter((item) => item.question.completed)
  const completedTranscriptByQuestion = new Map(transcripts.map((transcript) => [transcript.questionId, transcript]))
  const filters: { value: RecordFilter; label: string }[] = [
    { value: 'all', label: '전체' },
    { value: 'photo', label: '사진 질문' },
    { value: 'text', label: '텍스트 질문' },
    { value: 'completed', label: '답변 완료' },
  ]
  const showPhoto = filter === 'all' || filter === 'photo'
  const showText = filter === 'all' || filter === 'text'
  const showCompleted = filter === 'all' || filter === 'completed'
  const visiblePendingItems = filter === 'all'
    ? pendingItems
    : filter === 'photo'
      ? photoItems
      : filter === 'text'
        ? textItems
        : []
  const hasVisibleItems = visiblePendingItems.length > 0 || (showCompleted && completedItems.length > 0)

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F9]">
      <ParentRecordHeader onBack={onBack} />

      <main className="flex-1 overflow-y-auto pb-8">
        <section className="px-5 pt-5">
          <h1 className="font-serif text-[24px] font-normal leading-9 text-[#2A2830]">
            {introCopy[filter].title}
          </h1>
          <p className="mt-2 text-[13px] font-normal leading-[21px] text-[#7A767F]">
            {introCopy[filter].description}
          </p>
        </section>

        <div className="flex gap-2 overflow-x-auto px-5 pt-5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {filters.map((item) => {
            const active = filter === item.value
            return (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={`h-[34px] shrink-0 rounded-full border px-[18px] text-[13px] font-medium leading-[19.5px] transition ${
                  active
                    ? 'border-[#2A2830] bg-[#2A2830] text-[#F8F6F9]'
                    : 'border-[#E0DBE8] bg-white text-[#7A767F]'
                }`}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <section className="flex flex-col gap-4 px-5 pt-[14px]">
          {showPhoto || showText
            ? visiblePendingItems.map((item) => (
              isPhotoQuestion(item) ? (
                <RecordPhotoCard
                  key={item.question.id}
                  item={item}
                  highlightNew={isFamilyCreatedQuestion(item.question) && !seenQuestionIds.has(item.question.id)}
                  onSelect={onSelectItem}
                />
              ) : (
                <RecordTextCard
                  key={item.question.id}
                  item={item}
                  highlightNew={isFamilyCreatedQuestion(item.question) && !seenQuestionIds.has(item.question.id)}
                  onSelect={onSelectItem}
                />
              )
            ))
            : null}
          {showCompleted
            ? completedItems.map((item) => (
              <RecordCompletedCard
                key={item.question.id}
                item={item}
                transcript={completedTranscriptByQuestion.get(item.question.id)}
                onViewTranscript={onViewTranscript}
              />
            ))
            : null}
          {!hasVisibleItems ? (
            <div className="rounded-2xl border border-[#E0DBE8] bg-white p-6 text-center shadow-[0_2px_14px_rgba(42,40,48,0.07)]">
              <p className="text-[14px] font-medium text-[#2A2830]">표시할 이야기가 없어요</p>
              <p className="mt-1 text-[12px] text-[#7A767F]">다른 분류를 선택해보세요.</p>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}

// ─── Screen 2: Incoming Call ──────────────────────────────────────────────────

function IncomingCallView({
  type,
  onAccept,
  onDecline,
}: {
  type: InterviewType
  onAccept: () => void
  onDecline: () => void
}) {
  return (
    <div className="flex flex-col min-h-screen" style={{ backgroundColor: '#1C1C1E' }}>
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-5">
        <div className="flex flex-col items-center gap-1">
          <p className="text-[28px] font-bold text-white">기억 친구</p>
          <p className="text-[16px]" style={{ color: '#8E8E93' }}>AI 인터뷰어</p>
          <p className="text-[16px] mt-1" style={{ color: '#AEAEB2' }}>{INCOMING_SUBTITLES[type]}</p>
        </div>

        {/* Avatar with pulse rings */}
        <div className="relative flex items-center justify-center mt-2">
          <div className="absolute w-32 h-32 rounded-full animate-ping opacity-10" style={{ backgroundColor: '#9485BE' }} />
          <div className="absolute w-28 h-28 rounded-full animate-pulse opacity-15" style={{ backgroundColor: '#9485BE' }} />
          <div className="w-24 h-24 rounded-full flex items-center justify-center z-10" style={{ backgroundColor: '#3A3A3C' }}>
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <circle cx="24" cy="18" r="10" fill="#EDE8F0" />
              <path d="M8 44C8 34 40 34 40 44" fill="#EDE8F0" />
            </svg>
          </div>
        </div>
      </div>

      {/* Accept / Decline */}
      <div className="flex justify-center gap-24 pb-16 pt-8">
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onDecline}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#FF3B30' }}
          >
            <PhoneDeclineSvg />
          </button>
          <span className="text-[13px] text-white">거절</span>
        </div>
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={onAccept}
            className="w-16 h-16 rounded-full flex items-center justify-center"
            style={{ backgroundColor: '#34C759' }}
          >
            <PhoneAcceptSvg />
          </button>
          <span className="text-[13px] text-white">수락</span>
        </div>
      </div>
    </div>
  )
}

// ─── Screen 3: Active Call ────────────────────────────────────────────────────

function ActiveCallView({
  questions,
  callSeconds,
  isPaused,
  onPausedChange,
  onCallEnd,
}: {
  questions: QuestionItem[]
  callSeconds: number
  isPaused: boolean
  onPausedChange: (paused: boolean) => void
  onCallEnd: (count: number, answeredTexts: AnsweredItem[]) => void
}) {
  const [qIdx, setQIdx] = useState(0)
  const [answerText, setAnswerText] = useState('')
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioFileKey, setAudioFileKey] = useState<string | null>(null)
  const [completedCount, setCompletedCount] = useState(0)
  const [currentQuestion, setCurrentQuestion] = useState<string | null>(null)
  const [isLoadingNext, setIsLoadingNext] = useState(false)
  const [speechStatus, setSpeechStatus] = useState<SpeechStatus>('idle')
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const speechRef = useRef<SpeechSynthesisUtterance | null>(null)
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null)
  const ttsUrlCacheRef = useRef<Map<string, string>>(new Map())
  const audioChunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)
  const answeredRef = useRef<AnsweredItem[]>([])
  const previousQuestionsRef = useRef<string[]>([])

  const currentQ = questions[qIdx]
  const activeQuestion = currentQuestion ?? currentQ?.question.text ?? ''
  const nextQuestion = questions[qIdx + 1]?.question.text ?? '오늘 준비한 질문을 모두 들었어요'
  const fmt = formatCompactDuration(callSeconds) || '0:00'
  const recordFmt = `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`
  const isRecording = recordState === 'recording'
  const isRequesting = recordState === 'requesting'
  const isProcessing = recordState === 'processing'
  const canSaveCurrentAnswer = Boolean(currentQ) && answerText.trim().length > 0 && !isRecording && !isRequesting && !isProcessing
  const questionPhotoUrl = currentQ?.question.photoUrl ?? null

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const cancelSpeech = () => {
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause()
      ttsAudioRef.current.currentTime = 0
      ttsAudioRef.current = null
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    speechRef.current = null
    setSpeechStatus('idle')
  }

  const speakWithBrowserVoice = (content: string) => {
    if (!content.trim()) return
    if (
      typeof window === 'undefined'
      || !('speechSynthesis' in window)
      || typeof SpeechSynthesisUtterance === 'undefined'
    ) {
      setSpeechStatus('unsupported')
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(content)
    const voices = window.speechSynthesis.getVoices()
    const koreanVoice = voices.find((voice) => /yuna|grandma|flo|sandy|shelley|seoyeon/i.test(voice.name))
      ?? voices.find((voice) => voice.lang.toLowerCase().startsWith('ko'))
      ?? voices.find((voice) => /korean/i.test(voice.name))

    if (koreanVoice) utterance.voice = koreanVoice
    utterance.lang = 'ko-KR'
    utterance.rate = 0.9
    utterance.pitch = 1
    utterance.onstart = () => setSpeechStatus('speaking')
    utterance.onend = () => {
      if (speechRef.current === utterance) {
        speechRef.current = null
        setSpeechStatus('idle')
      }
    }
    utterance.onerror = () => {
      if (speechRef.current === utterance) {
        speechRef.current = null
        setSpeechStatus('idle')
      }
    }
    speechRef.current = utterance
    setSpeechStatus('speaking')
    window.speechSynthesis.speak(utterance)
  }

  const speakQuestion = async (text = activeQuestion) => {
    const content = text.trim()
    if (!content) return
    cancelSpeech()
    setSpeechStatus('speaking')

    try {
      const cachedUrl = ttsUrlCacheRef.current.get(content)
      const audioUrl = cachedUrl ?? URL.createObjectURL(await synthesizeLocalQuestionSpeech(content))
      if (!cachedUrl) ttsUrlCacheRef.current.set(content, audioUrl)
      const audio = new Audio(audioUrl)
      ttsAudioRef.current = audio
      audio.onended = () => {
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
          setSpeechStatus('idle')
        }
      }
      audio.onerror = () => {
        if (ttsAudioRef.current === audio) {
          ttsAudioRef.current = null
          setSpeechStatus('idle')
        }
      }
      setSpeechStatus('speaking')
      await audio.play()
    } catch {
      speakWithBrowserVoice(content)
    }
  }

  useEffect(() => {
    setCurrentQuestion(null)
  }, [qIdx])

  useEffect(() => {
    if (!activeQuestion) return
    if (isPaused) {
      cancelSpeech()
      return
    }
    const id = window.setTimeout(() => {
      void speakQuestion(activeQuestion)
    }, 350)
    return () => {
      window.clearTimeout(id)
      cancelSpeech()
    }
  }, [activeQuestion, isPaused])

  const handleRecordingStopped = async (mimeType: string) => {
    stopStream()
    if (discardRecordingRef.current) {
      discardRecordingRef.current = false
      audioChunksRef.current = []
      return
    }

    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
    audioChunksRef.current = []
    if (audioBlob.size === 0) {
      setRecordingError('녹음된 음성이 없습니다. 다시 녹음하거나 직접 입력해 주세요.')
      setRecordState('idle')
      return
    }

    try {
      const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 'webm'
      const upload = await uploadLocalAudio(audioBlob, `dearlog-call-${Date.now()}.${extension}`)
      setAudioFileKey(upload.fileKey)
      const transcription = await transcribeLocalAudio(upload.fileKey, upload.uploadToken)
      setAnswerText(transcription.text)
      setRecordState('done')
    } catch (error) {
      console.error('call recording transcribe error:', error)
      setRecordingError(error instanceof Error ? error.message : '음성 인식에 실패했습니다. 직접 입력으로 저장해 주세요.')
      setRecordState('done')
    }
  }

  const startRecording = async () => {
    setRecordingError(null)
    cancelSpeech()
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('이 브라우저에서는 녹음을 지원하지 않습니다. 직접 입력으로 남겨주세요.')
      return
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordState('requesting')
    try {
      const stream = await requestAudioStreamWithTimeout()
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
      ].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined)
      discardRecordingRef.current = false
      audioChunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        void handleRecordingStopped(preferredMimeType || recorder.mimeType || 'audio/webm')
      }
      setAudioFileKey(null)
      setAnswerText('')
      setRecordState('recording')
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
      recorder.start()
    } catch (error) {
      console.error('call recording start error:', error)
      setRecordingError('마이크 권한을 허용한 뒤 다시 시도해 주세요. 어려우시면 직접 입력으로 저장할 수 있어요.')
      setRecordState('idle')
      stopStream()
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      setRecordState('processing')
      recorderRef.current.stop()
      return
    }
    setRecordState('idle')
  }

  const handleRecordToggle = () => {
    if (isPaused || isRequesting || isProcessing) return
    if (isRecording) {
      stopRecording()
      return
    }
    void startRecording()
  }

  const resetAnswerInput = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      discardRecordingRef.current = true
      recorderRef.current.stop()
    }
    stopStream()
    audioChunksRef.current = []
    setAnswerText('')
    setAudioFileKey(null)
    setRecordingSeconds(0)
    setRecordState('idle')
    setRecordingError(null)
  }

  const appendCurrentAnswer = () => {
    if (!currentQ) return answeredRef.current.length
    const rawText = answerText.trim()
    if (!rawText) return answeredRef.current.length
    answeredRef.current.push({
      questionId: currentQ.question.id,
      chapterId: currentQ.chapter.id,
      chapterTitle: currentQ.chapter.title,
      questionText: activeQuestion,
      rawText,
      answerMode: audioFileKey ? 'phone' : 'text',
      durationSeconds: audioFileKey ? recordingSeconds : undefined,
      audioFileKey,
    })
    const newCount = answeredRef.current.length
    setCompletedCount(newCount)
    resetAnswerInput()
    return newCount
  }

  const handleFollowUp = async () => {
    if (!currentQ || isLoadingNext || !canSaveCurrentAnswer) return
    const savedText = answerText.trim()
    const savedQuestion = activeQuestion
    const questionHistory = [...previousQuestionsRef.current, savedQuestion]
    setIsLoadingNext(true)
    try {
      const result = await generateFollowUpQuestion(
        savedText,
        currentQ.chapter.title,
        questionHistory
      )
      appendCurrentAnswer()
      previousQuestionsRef.current = questionHistory
      setCurrentQuestion(result.question)
    } catch (error) {
      console.error('follow-up generation error:', error)
      setRecordingError('AI 꼬리질문을 만들지 못했습니다. 잠시 후 다시 시도하거나 현재 답변을 저장해 주세요.')
    } finally {
      setIsLoadingNext(false)
    }
  }

  const handleNext = () => {
    if (!canSaveCurrentAnswer) return
    const newCount = appendCurrentAnswer()
    previousQuestionsRef.current = []
    onPausedChange(false)
    if (qIdx + 1 < questions.length) {
      setQIdx(qIdx + 1)
    } else {
      onCallEnd(newCount, answeredRef.current)
    }
  }

  const handleEndCall = () => {
    cancelSpeech()
    onPausedChange(false)
    let finalCount = completedCount
    if (canSaveCurrentAnswer) {
      finalCount = appendCurrentAnswer()
    }
    onCallEnd(finalCount, answeredRef.current)
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      discardRecordingRef.current = true
      recorderRef.current.stop()
    }
    cancelSpeech()
    stopStream()
    ttsUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url))
    ttsUrlCacheRef.current.clear()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[#1C1920] text-white">
      <main className="flex min-h-[807px] flex-1 flex-col overflow-y-auto pb-5">
        <div className="h-[34px] shrink-0" />

        <section className="flex flex-1 flex-col px-6 pb-4">
          <div className="flex flex-col items-center pt-8">
            <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/20">
              <Phone className="h-[22px] w-[22px] text-white/70" strokeWidth={1.8} aria-hidden="true" />
            </div>
            <p className="mt-5 text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-white/40">
              {isPaused ? '일시 정지' : '통화 중'}
            </p>
            <h1 className="mt-2 font-serif text-[20px] font-normal leading-[30px] text-white">
              DEARLOG 기록 전화
            </h1>
            <p className="mt-[20px] font-serif text-[40px] font-normal leading-[60px] text-white">
              {fmt}
            </p>
            <p className="mt-1 text-[12px] font-medium leading-[18px] text-white/45">
              답변 {completedCount}개 저장 대기
            </p>
          </div>

          <div className="mt-10 border-l border-white/20 pl-5">
            <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-white/40">
              현재 질문
            </p>
            <p className="mt-3 whitespace-pre-line font-serif text-[20px] font-normal leading-[29px] text-white">
              {activeQuestion}
            </p>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  void speakQuestion(activeQuestion)
                }}
                disabled={isPaused || !activeQuestion || speechStatus === 'unsupported'}
                className="inline-flex h-[38px] shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-white/15 px-4 text-[12px] font-medium leading-[18px] text-white/70 transition active:scale-[0.99] disabled:opacity-40"
              >
                <Volume2 className="h-4 w-4" strokeWidth={1.8} aria-hidden="true" />
                {speechStatus === 'speaking' ? '질문 재생 중' : '질문 다시 듣기'}
              </button>
              <span className="min-w-0 flex-1 text-[12px] font-medium leading-[18px] text-white/40">
                {speechStatus === 'unsupported'
                  ? '음성 재생을 지원하지 않는 브라우저입니다.'
                  : speechStatus === 'speaking'
                    ? 'AI가 질문을 들려주고 있습니다.'
                    : '답변을 마치면 이어서 물어볼 수 있어요.'}
              </span>
            </div>
          </div>

          {questionPhotoUrl ? (
            <div className="mt-4 h-[120px] overflow-hidden rounded-[14px] border border-white/10">
              <img src={questionPhotoUrl} alt="질문과 연결된 사진" className="h-full w-full object-cover" />
            </div>
          ) : null}

          <div className="mt-5 rounded-[14px] border border-white/10 bg-white/[0.05] p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-white/40">
                답변 원문
              </span>
              <span className="text-[12px] font-medium leading-[18px] text-white/50">{recordFmt}</span>
            </div>
            <textarea
              value={answerText}
              onChange={(event) => {
                setAnswerText(event.target.value)
                if (audioFileKey) setAudioFileKey(null)
              }}
              disabled={isRecording || isRequesting || isProcessing}
              className="mt-3 h-[112px] w-full resize-none rounded-[12px] border border-white/10 bg-black/20 px-3 py-3 text-[15px] leading-[22px] text-white outline-none placeholder:text-white/30 focus:border-white/30 disabled:opacity-60"
              placeholder="마이크로 답하거나 직접 입력해 주세요."
            />
            {recordingError ? (
              <p className="mt-2 text-[12px] font-medium leading-[18px] text-[#FFA2A2]">{recordingError}</p>
            ) : isRequesting ? (
              <p className="mt-2 text-[12px] font-medium leading-[18px] text-[#C8B8FF]">
                마이크 권한을 확인하는 중입니다...
              </p>
            ) : isProcessing ? (
              <p className="mt-2 text-[12px] font-medium leading-[18px] text-[#C8B8FF]">
                음성을 텍스트로 변환하는 중입니다...
              </p>
            ) : null}
          </div>
        </section>

        <section className="flex shrink-0 flex-col gap-2.5 px-6">
          <div className="grid grid-cols-[64px_1fr] gap-2.5">
            <button
              type="button"
              onClick={handleRecordToggle}
              disabled={isPaused || isRequesting || isProcessing}
              className={`flex h-[49.5px] items-center justify-center rounded-[14px] text-white transition active:scale-[0.99] disabled:opacity-50 ${
                isRecording
                  ? 'bg-[#FB2C36]/80'
                  : 'bg-white/[0.12]'
              }`}
              aria-label={isRecording ? '녹음 정지' : '녹음 시작'}
            >
              {isRecording ? <MicOff className="h-[18px] w-[18px]" aria-hidden="true" /> : <Mic className="h-[18px] w-[18px]" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={handleFollowUp}
              disabled={!canSaveCurrentAnswer || isLoadingNext}
              className="flex h-[49.5px] w-full items-center justify-center rounded-[14px] border border-white/15 text-[13px] font-medium leading-[19.5px] text-white/70 transition active:scale-[0.99] disabled:opacity-40"
            >
              {isLoadingNext ? 'AI 질문 준비 중' : 'AI 꼬리질문 받기'}
            </button>
          </div>
          <button
            type="button"
            onClick={() => onPausedChange(!isPaused)}
            className="flex h-[49.5px] w-full items-center justify-center gap-2 rounded-[14px] border border-white/15 text-[13px] font-medium leading-[19.5px] text-white/60 transition active:scale-[0.99]"
          >
            <Pause className="h-[13px] w-[13px]" strokeWidth={1.8} aria-hidden="true" />
            {isPaused ? '다시 이어가기' : '잠시 멈춤'}
          </button>
          <button
            type="button"
            onClick={handleNext}
            disabled={!canSaveCurrentAnswer}
            className="flex h-[49.5px] w-full items-center justify-center gap-2 rounded-[14px] bg-white text-[13px] font-medium leading-[19.5px] text-[#1C1920] transition active:scale-[0.99] disabled:opacity-40"
          >
            {qIdx + 1 < questions.length ? '저장하고 다음 질문' : '저장하고 마치기'}
            <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={handleEndCall}
            className="flex h-[49.5px] w-full items-center justify-center rounded-[14px] border border-[#FB2C36]/30 bg-[#FB2C36]/20 text-[13px] font-medium leading-[19.5px] text-[#FFA2A2] transition active:scale-[0.99]"
          >
            {canSaveCurrentAnswer ? '현재 답변 저장하고 통화 마치기' : '통화 마치기'}
          </button>
          <p className="truncate text-center text-[11px] leading-[16px] text-white/35">
            다음 질문: {nextQuestion}
          </p>
        </section>
      </main>
    </div>
  )
}
// ─── Screen 4: Voice Recording ────────────────────────────────────────────────

function VoiceView({
  item,
  onComplete,
  onBack,
  onSkip,
}: {
  item: QuestionItem
  onComplete: (
    questionId: string,
    rawText?: string,
    meta?: { answerMode: AnswerMode; durationSeconds?: number; audioFileKey?: string | null },
  ) => void
  onBack: () => void
  onSkip: () => void
}) {
  const [recordState, setRecordState] = useState<RecordState>('idle')
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [draftText, setDraftText] = useState('')
  const [recordingError, setRecordingError] = useState<string | null>(null)
  const [audioFileKey, setAudioFileKey] = useState<string | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const discardRecordingRef = useRef(false)

  const isRecording = recordState === 'recording'
  const isRequesting = recordState === 'requesting'
  const isProcessing = recordState === 'processing'
  const fmt = `${String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:${String(recordingSeconds % 60).padStart(2, '0')}`
  const DOTS = Array.from({ length: 30 }, (_, index) => index)
  const WAVE_BARS = [
    28, 26, 12, 16, 27, 27, 15, 13, 26, 28,
    18, 10, 24, 29, 21, 7, 22, 29, 23, 8,
    20, 28, 25, 11, 17, 28, 27, 14, 14, 26,
  ]
  const canSave = !isRecording && !isRequesting && !isProcessing && draftText.trim().length > 0
  const questionPhotoUrl = item.question.photoUrl || null

  const stopStream = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const startRecording = async () => {
    setRecordingError(null)
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('이 브라우저에서는 녹음을 지원하지 않습니다. 직접 입력으로 남겨주세요.')
      return
    }
    if (timerRef.current) clearInterval(timerRef.current)
    setRecordState('requesting')
    try {
      const stream = await requestAudioStreamWithTimeout()
      const preferredMimeType = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/aac',
      ].find((type) => MediaRecorder.isTypeSupported(type))
      const recorder = new MediaRecorder(stream, preferredMimeType ? { mimeType: preferredMimeType } : undefined)
      discardRecordingRef.current = false
      audioChunksRef.current = []
      streamRef.current = stream
      recorderRef.current = recorder
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        void handleRecordingStopped(preferredMimeType || recorder.mimeType || 'audio/webm')
      }
      setAudioFileKey(null)
      setDraftText('')
      setRecordState('recording')
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000)
      recorder.start()
    } catch (error) {
      console.error('recording start error:', error)
      setRecordingError('마이크 권한을 허용한 뒤 다시 시도해 주세요. 어려우시면 직접 입력으로 저장할 수 있어요.')
      setRecordState('idle')
      stopStream()
    }
  }

  const stopRecording = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      setRecordState('processing')
      recorderRef.current.stop()
      return
    }
    setRecordState('idle')
  }

  const handleRecordingStopped = async (mimeType: string) => {
    stopStream()
    if (discardRecordingRef.current) {
      discardRecordingRef.current = false
      audioChunksRef.current = []
      return
    }
    const audioBlob = new Blob(audioChunksRef.current, { type: mimeType })
    audioChunksRef.current = []
    if (audioBlob.size === 0) {
      setRecordingError('녹음된 음성이 없습니다. 다시 녹음하거나 직접 입력해 주세요.')
      setRecordState('idle')
      return
    }
    try {
      const extension = mimeType.includes('mp4') || mimeType.includes('aac') ? 'm4a' : 'webm'
      const upload = await uploadLocalAudio(audioBlob, `dearlog-${Date.now()}.${extension}`)
      setAudioFileKey(upload.fileKey)
      const transcription = await transcribeLocalAudio(upload.fileKey, upload.uploadToken)
      setDraftText(transcription.text)
      setRecordState('done')
    } catch (error) {
      console.error('recording transcribe error:', error)
      setRecordingError(error instanceof Error ? error.message : '음성 인식에 실패했습니다. 직접 입력으로 저장해 주세요.')
      setRecordState('done')
    }
  }

  const handleRecordToggle = () => {
    if (isRequesting || isProcessing) return
    if (isRecording) {
      stopRecording()
      return
    }
    if (recordState === 'done') return
    void startRecording()
  }

  const handleReset = () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      discardRecordingRef.current = true
      recorderRef.current.stop()
    }
    stopStream()
    audioChunksRef.current = []
    setRecordState('idle')
    setRecordingSeconds(0)
    setDraftText('')
    setAudioFileKey(null)
    setRecordingError(null)
  }

  const handleSave = () => {
    if (!canSave) return
    const trimmedText = draftText.trim()
    const answerMode: AnswerMode = audioFileKey ? 'voice' : 'text'
    onComplete(item.question.id, trimmedText, {
      answerMode,
      durationSeconds: audioFileKey ? recordingSeconds : undefined,
      audioFileKey,
    })
  }

  useEffect(() => () => {
    if (timerRef.current) clearInterval(timerRef.current)
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      discardRecordingRef.current = true
      recorderRef.current.stop()
    }
    stopStream()
  }, [])

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F9] text-[#2A2830]">
      <main className="relative min-h-[817px] flex-1 overflow-hidden px-6 pb-[95px]">
        <div className="absolute left-0 right-0 top-[36px] h-[210px] overflow-hidden" aria-hidden="true">
          <img
            src={questionPhotoUrl || parentRecordPhoto}
            alt=""
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent from-[40%] to-[#F8F6F9]" />
        </div>

        <button
          type="button"
          onClick={onBack}
          className="absolute left-4 top-3 z-30 flex h-11 w-11 items-center justify-center rounded-full bg-[#F8F6F9]/90 text-[#7A767F] shadow-[0_2px_10px_rgba(42,40,48,0.08)] transition active:scale-95"
          aria-label="질문 목록으로 돌아가기"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <section className="relative z-10 pt-[258px]">
          <h1 className="font-serif text-[22px] font-normal leading-[33px] text-[#2A2830]">
            {item.question.text}
          </h1>
        </section>

        <section className="relative z-10 mt-[17px] flex flex-col items-center">
          <div className="flex h-12 w-full items-center justify-center" aria-hidden="true">
            {isRecording ? (
              <div className="flex h-10 w-[280px] items-center justify-center gap-[2.5px]">
                {WAVE_BARS.map((height, index) => (
                  <span
                    key={index}
                    className="w-1 rounded-full bg-[#9485BE] transition"
                    style={{ height }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center gap-[3px]">
                {DOTS.map((dot) => (
                  <span key={dot} className="h-[5px] w-[5px] rounded-full bg-[#E0DBE8]" />
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 font-serif text-[30px] font-normal leading-[45px] tracking-[2.4px] text-[#2A2830]">
            {fmt}
          </p>

          <button
            type="button"
            onClick={handleRecordToggle}
            className={`mt-4 flex h-24 w-24 items-center justify-center rounded-full text-white transition active:scale-95 disabled:opacity-60 ${
              isRecording
                ? 'bg-[#B03A2E] shadow-[0_8px_16px_rgba(176,58,46,0.32)]'
                : 'bg-[#2A2830] shadow-[0_8px_16px_rgba(42,40,48,0.28)]'
            }`}
            disabled={recordState === 'done' || isRequesting || isProcessing}
            aria-label={isRecording ? '녹음 정지' : '녹음 시작'}
          >
            {isRecording ? <MicOff className="h-9 w-9" aria-hidden="true" /> : <Mic className="h-9 w-9" aria-hidden="true" />}
          </button>

          <p className={`mt-3 text-[14px] font-medium leading-[21px] ${isRecording ? 'text-[#B03A2E]' : 'text-[#7A767F]'}`}>
            {isRequesting ? '마이크 권한 확인 중' : isProcessing ? '음성 인식 중' : recordState === 'done' ? '녹음 완료' : isRecording ? '녹음 중 — 탭하면 멈춥니다' : '녹음 시작'}
          </p>
          {isRequesting ? (
            <p className="mt-2 text-[13px] font-medium leading-[19.5px] text-[#9485BE]">
              마이크 권한을 확인하는 중입니다...
            </p>
          ) : isProcessing ? (
            <p className="mt-2 text-[13px] font-medium leading-[19.5px] text-[#9485BE]">
              음성을 텍스트로 변환하는 중입니다...
            </p>
          ) : null}
          {recordingError ? (
            <p className="mt-2 max-w-[300px] text-center text-[12px] font-medium leading-[18px] text-[#B03A2E]">
              {recordingError}
            </p>
          ) : null}

          <div className="mt-6 grid w-full grid-cols-2 gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex h-[51px] items-center justify-center rounded-[14px] border border-[#E0DBE8] bg-white text-[14px] font-medium leading-[21px] tracking-[0.42px] text-[#2A2830] transition active:scale-[0.99]"
            >
              다시 시작
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="flex h-[51px] items-center justify-center rounded-[14px] border border-[#E0DBE8] bg-white text-[14px] font-medium leading-[21px] tracking-[0.42px] text-[#2A2830] transition active:scale-[0.99]"
            >
              질문 넘기기
            </button>
          </div>
        </section>

        <section className="relative z-10 mt-[17px]">
          <label htmlFor="parent-text-answer" className="block pb-2 text-[11px] font-normal uppercase leading-[16.5px] tracking-[1.32px] text-[#7A767F]">
            직접 입력
          </label>
          <textarea
            id="parent-text-answer"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            disabled={isRequesting || isProcessing}
            className="h-[110px] w-full resize-none rounded-[14px] border border-[#E0DBE8] bg-white px-[17px] py-[15px] text-[15px] font-normal leading-[22.5px] text-[#2A2830] outline-none placeholder:text-[#7A767F]/40 focus:border-[#9485BE]"
            placeholder="말씀하기 어려우시면 여기에 써주셔도 됩니다..."
          />
        </section>

        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="absolute bottom-[49.5px] left-5 right-5 z-20 flex h-[51px] items-center justify-center rounded-[14px] bg-[#2A2830] text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:opacity-40"
        >
          저장하기
        </button>
      </main>
    </div>
  )
}

// ─── Screen 5: Done ───────────────────────────────────────────────────────────

function formatCompactDuration(seconds?: number) {
  if (!seconds || seconds <= 0) return ''
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

function getSavedRecordTitle(questionText?: string) {
  const fallbackTitle = '이 사진을 찍은 날의 이야기'
  if (!questionText) return fallbackTitle
  const normalized = questionText.trim()
  if (normalized.includes('사진') && normalized.includes('이야기')) {
    return fallbackTitle
  }
  return normalized
}

function DoneView({
  answeredCount,
  callSeconds,
  isPhoneMode,
  answeredItems,
  onAnswerNext,
  onBackToList,
  onViewTranscript,
  onGoHome,
}: {
  answeredCount: number
  callSeconds: number
  isPhoneMode: boolean
  answeredItems: AnsweredItem[]
  onAnswerNext: () => void
  onBackToList: () => void
  onViewTranscript: () => void
  onGoHome: () => void
}) {
  const { transcripts, addTranscript } = useInterviewStore()
  const [visible, setVisible] = useState(false)
  const [showToast, setShowToast] = useState(false)
  const [conflicts, setConflicts] = useState<Conflict[]>([])
  const [showConflict, setShowConflict] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(t)
  }, [])

  // Archive chain: archiveTranscript → verifyChunk → addTranscript
  useEffect(() => {
    if (answeredItems.length === 0) return
    const existingChunks = transcripts
      .filter((t: Transcript) => t.chunk)
      .map((t: Transcript) => ({ ...t.chunk!, chunkId: t.id }))

    const run = async () => {
      const allConflicts: Conflict[] = []
      for (const item of answeredItems) {
        const archiveResult = await archiveTranscript(item.rawText, item.questionText, item.chapterId)
        const chunkWithId = { ...archiveResult.chunk, chunkId: archiveResult.chunkId }
        const verifyResult = await verifyChunk(chunkWithId, existingChunks)
        if (verifyResult.status === 'FLAG') {
          allConflicts.push(...verifyResult.conflicts)
        }
        await addTranscript({
          id: archiveResult.chunkId,
          questionId: item.questionId,
          questionText: item.questionText,
          chapterId: item.chapterId,
          chapterTitle: item.chapterTitle,
          originalText: item.rawText,
          aiSummary: archiveResult.chunk.clean,
          mode: item.answerMode === 'text'
            ? 'text'
            : item.answerMode === 'phone'
              ? 'phone'
              : 'voice',
          audioFileKey: item.audioFileKey ?? null,
          recordedAt: toLocalDateStamp(),
          chunk: archiveResult.chunk,
        })
        existingChunks.push(chunkWithId)
      }
      if (allConflicts.length > 0) {
        setConflicts(allConflicts)
        setShowConflict(true)
      } else {
        setShowToast(true)
        setTimeout(() => setShowToast(false), 1500)
      }
    }
    run()
  }, [])

  const CONFLICT_LABELS: Record<string, string> = {
    TIME_CONFLICT: '시간 충돌',
    PERSON_CONFLICT: '인물 충돌',
    FACT_CONFLICT: '사실 충돌',
    DUPLICATE: '중복 기록',
  }

  const primaryItem = answeredItems[0]
  const durationText = formatCompactDuration(primaryItem?.durationSeconds ?? callSeconds)
  const answerMethod = primaryItem?.answerMode === 'text'
    ? '텍스트 답변'
    : primaryItem?.answerMode === 'phone' || isPhoneMode
      ? '전화 답변'
      : '음성 답변'
  const answerMeta = durationText ? `${answerMethod} · ${durationText}` : answerMethod
  const savedBadgeLabel = answeredCount > 1 ? `${answeredCount}개 답변 저장` : '원문 보존됨'
  const chapterLabel = primaryItem?.chapterTitle ?? '어린 시절'
  const summaryTitle = getSavedRecordTitle(primaryItem?.questionText)

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#F8F6F9] text-[#2A2830]">
      {/* Toast */}
      {showToast && (
        <div
          className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full px-5 py-2.5 text-[14px] font-medium text-white"
          style={{ backgroundColor: '#9485BE' }}
        >
          저장됨 ✓
        </div>
      )}

      {/* Conflict card */}
      {showConflict && (
        <div className="fixed inset-x-5 top-20 z-50 rounded-2xl bg-white p-4 shadow-[0_4px_20px_rgba(0,0,0,0.15)]">
          <p className="mb-2 text-[15px] font-bold text-[#2A2830]">⚠️ 기록 검토 필요</p>
          {conflicts.map((c, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <span className="mr-2 rounded-full bg-[#F3EFF5] px-2 py-0.5 text-[11px] font-medium text-[#9485BE]">
                {CONFLICT_LABELS[c.conflictType] ?? c.conflictType}
              </span>
              <p className="text-[13px] text-[#2A2830] mt-1">{c.description}</p>
              <p className="text-[12px] text-[#7A767F]">{c.recommendedAction}</p>
            </div>
          ))}
          <button
            type="button"
            onClick={() => { setShowConflict(false); setShowToast(true); setTimeout(() => setShowToast(false), 1500) }}
            className="mt-3 w-full rounded-xl py-2.5 text-[14px] font-medium text-white"
            style={{ backgroundColor: '#9485BE' }}
          >
            확인 (기록은 저장됨)
          </button>
        </div>
      )}

      <main
        className="flex min-h-[807px] flex-1 flex-col px-6 pb-10"
        style={{ opacity: visible ? 1 : 0, transition: 'opacity 0.5s ease 0.3s' }}
      >
        <div className="w-full pb-4 pt-2">
          <button
            type="button"
            onClick={onBackToList}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[#7A767F] shadow-[0_2px_10px_rgba(42,40,48,0.08)] transition active:scale-95"
            aria-label="질문 목록으로 돌아가기"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <section className="flex flex-1 flex-col items-center justify-center">
          <div className="relative h-32 w-24 pb-8">
            <div className="absolute -left-[46px] -top-[46px] h-[189px] w-[189px] rounded-full bg-[#9485BE]/[0.06]" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-[#EDE8F0]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#2A2830]">
                <Check
                  className="h-7 w-7 text-white"
                  strokeWidth={2.2}
                  aria-hidden="true"
                  style={{
                    strokeDasharray: 36,
                    strokeDashoffset: visible ? 0 : 36,
                    transition: 'stroke-dashoffset 0.55s ease 0.25s',
                  }}
                />
              </div>
            </div>
          </div>

          <span className="inline-flex h-[27px] items-center rounded-full border border-[#AFA3D0]/30 bg-[#AFA3D0]/15 px-[11px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] text-[#5E527E]">
            {savedBadgeLabel}
          </span>

          <h1 className="mt-5 text-center font-serif text-[30px] font-normal leading-[40.5px] text-[#2A2830]">
            이야기가
            <br />
            저장되었어요
          </h1>

          <p className="mt-3 max-w-[280px] text-center text-[14px] font-normal leading-[26.6px] text-[#7A767F]">
            남겨주신 이야기는 원문 그대로 보존되고,
            <br />
            자녀가 소중히 정리해 드릴게요.
          </p>

          <div className="w-full pb-6 pt-8">
            <div className="h-px bg-[#E0DBE8]" />
          </div>

          <article className="w-full rounded-2xl border border-[#E0DBE8] bg-white p-[21px]">
            <div className="flex items-center justify-between gap-3">
              <RecordBadge>{chapterLabel}</RecordBadge>
              <span className="shrink-0 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                방금 전
              </span>
            </div>
            <h2 className="mt-2 truncate font-serif text-[16px] font-semibold leading-6 text-[#2A2830]">
              {summaryTitle}
            </h2>
            <p className="mt-1 text-[12px] font-normal leading-[18px] text-[#7A767F]">
              {answerMeta}
            </p>
          </article>
        </section>

        <section className="flex shrink-0 flex-col gap-3 pt-8">
          <RecordPrimaryButton onClick={onAnswerNext}>다음 질문 답하기</RecordPrimaryButton>
          <RecordPrimaryButton variant="secondary" onClick={onViewTranscript}>내 기록 보기</RecordPrimaryButton>
          <button
            type="button"
            onClick={onGoHome}
            className="flex h-[49px] w-full items-center justify-center text-[14px] font-medium leading-[21px] tracking-[0.42px] text-[#7A767F] transition active:scale-[0.99]"
          >
            오늘은 여기까지
          </button>
        </section>
      </main>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ParentInterviewScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { userId } = useAuthStore()
  const type = (searchParams.get('type') ?? 'manual') as InterviewType
  const filterParam = searchParams.get('filter')
  const initialFilter: RecordFilter =
    filterParam === 'photo' || filterParam === 'text' || filterParam === 'completed' ? filterParam : 'all'

  const { chapters, transcripts, fetchChaptersAndQuestions, fetchTranscripts } = useInterviewStore()
  const [screen, setScreen] = useState<ScreenState>(() =>
    type === 'manual' ? 'select' : 'incoming'
  )
  const [selectedItem, setSelectedItem] = useState<QuestionItem | null>(null)
  const [isPhoneMode, setIsPhoneMode] = useState(false)
  const [isCallPaused, setIsCallPaused] = useState(false)
  const [callSeconds, setCallSeconds] = useState(0)
  const [finalCallSeconds, setFinalCallSeconds] = useState(0)
  const [answeredCount, setAnsweredCount] = useState(0)
  const [answeredItems, setAnsweredItems] = useState<AnsweredItem[]>([])
  const [seenFamilyQuestionIds, setSeenFamilyQuestionIds] = useState<Set<string>>(() =>
    readSeenFamilyQuestionIds(userId)
  )
  const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    void fetchChaptersAndQuestions()
    void fetchTranscripts()
  }, [fetchChaptersAndQuestions, fetchTranscripts])

  const questionItems = useMemo<QuestionItem[]>(() => {
    return [...chapters]
      .sort((a, b) => a.order - b.order)
      .flatMap((chapter) => chapter.questions.map((question) => ({ question, chapter })))
      .sort(compareParentQuestionItems)
  }, [chapters])

  const incompleteItems = useMemo(
    () => questionItems.filter((item) => !item.question.completed),
    [questionItems],
  )

  const sessionQuestions = useMemo<QuestionItem[]>(() => {
    if (selectedItem && !selectedItem.question.completed) {
      return [
        selectedItem,
        ...incompleteItems.filter((item) => item.question.id !== selectedItem.question.id),
      ].slice(0, 3)
    }
    return incompleteItems.slice(0, 3)
  }, [incompleteItems, selectedItem])

  const nextItem = sessionQuestions[0] ?? null
  const activeItem = selectedItem ?? nextItem

  useEffect(() => {
    setSeenFamilyQuestionIds(readSeenFamilyQuestionIds(userId))
  }, [userId])

  const markFamilyQuestionAsSeen = useCallback((question: Question) => {
    if (!isFamilyCreatedQuestion(question)) return

    setSeenFamilyQuestionIds((currentQuestionIds) => {
      if (currentQuestionIds.has(question.id)) return currentQuestionIds

      const nextQuestionIds = new Set(currentQuestionIds)
      nextQuestionIds.add(question.id)
      writeSeenFamilyQuestionIds(userId, nextQuestionIds)
      return nextQuestionIds
    })
  }, [userId])

  useEffect(() => {
    if ((screen === 'voice' || screen === 'active') && activeItem) {
      markFamilyQuestionAsSeen(activeItem.question)
    }
  }, [activeItem, markFamilyQuestionAsSeen, screen])

  // Start/stop call timer
  useEffect(() => {
    if (screen === 'active' && !isCallPaused) {
      callTimerRef.current = setInterval(() => setCallSeconds((s) => s + 1), 1000)
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current)
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current) }
  }, [screen, isCallPaused])

  const handleSelectItem = (item: QuestionItem) => {
    setSelectedItem(item)
    setIsPhoneMode(false)
    setScreen('voice')
  }

  const handleCallEnd = (count: number, items: AnsweredItem[]) => {
    setAnsweredCount(count)
    setAnsweredItems(items)
    setFinalCallSeconds(callSeconds)
    setIsCallPaused(false)
    setScreen('done')
  }

  const handleVoiceComplete = (
    questionId: string,
    rawText?: string,
    meta?: { answerMode: AnswerMode; durationSeconds?: number; audioFileKey?: string | null },
  ) => {
    const trimmedText = rawText?.trim()
    if (!activeItem || !trimmedText) return
    setAnsweredItems([{
      questionId,
      chapterId: activeItem.chapter.id,
      chapterTitle: activeItem.chapter.title,
      questionText: activeItem.question.text,
      rawText: trimmedText,
      answerMode: meta?.answerMode ?? 'voice',
      durationSeconds: meta?.durationSeconds,
      audioFileKey: meta?.audioFileKey ?? null,
    }])
    setAnsweredCount(1)
    setFinalCallSeconds(0)
    setScreen('done')
  }

  const handleVoiceBack = () => {
    setSelectedItem(null)
    setScreen('select')
  }

  const handleSkipQuestion = () => {
    const next = incompleteItems.find((item) => item.question.id !== activeItem?.question.id)
    if (next) {
      setSelectedItem(next)
      return
    }
    setSelectedItem(null)
    setScreen('select')
  }

  const handleBackToRecordList = () => {
    setSelectedItem(null)
    setScreen('select')
  }

  const handleNextAfterDone = () => {
    const answeredIds = new Set(answeredItems.map((item) => item.questionId))
    const next = incompleteItems.find((item) =>
      item.question.id !== activeItem?.question.id && !answeredIds.has(item.question.id)
    )
    if (next) {
      setSelectedItem(next)
      setIsPhoneMode(false)
      setFinalCallSeconds(0)
      setScreen('voice')
      return
    }
    setSelectedItem(null)
    setScreen('select')
  }

  if (questionItems.length === 0 && screen !== 'done' && screen !== 'select') {
    return (
      <div className="flex flex-col min-h-screen bg-[#F8F6F9]">
        <div className="flex-1 flex flex-col items-center justify-center px-5 pb-24 gap-2">
          <button
            type="button"
            onClick={() => navigate('/parent')}
            className="mb-6 flex h-10 items-center gap-1 rounded-full bg-white px-4 text-[14px] font-medium text-[#7A767F] shadow-[0_2px_10px_rgba(42,40,48,0.08)] transition active:scale-95"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            부모 홈으로
          </button>
          <p className="text-[18px] font-bold text-[#9485BE]">모든 질문에 답변하셨어요!</p>
          <p className="text-[14px] text-[#7A767F]">진척도 화면에서 자서전 생성을 확인하세요</p>
        </div>
        <BottomNav />
      </div>
    )
  }

  return (
    <>
      {screen === 'select' && (
        <RecordSelectView
          items={questionItems}
          transcripts={transcripts}
          seenQuestionIds={seenFamilyQuestionIds}
          initialFilter={initialFilter}
          onBack={() => navigate('/parent')}
          onSelectItem={handleSelectItem}
          onViewTranscript={() => navigate('/parent/transcript')}
        />
      )}
      {screen === 'incoming' && (
        <IncomingCallView
          type={type}
          onAccept={() => {
            setIsPhoneMode(true)
            setIsCallPaused(false)
            setCallSeconds(0)
            setScreen('active')
          }}
          onDecline={() => navigate('/parent')}
        />
      )}
      {screen === 'voice' && activeItem && (
        <VoiceView
          item={activeItem}
          onComplete={handleVoiceComplete}
          onBack={handleVoiceBack}
          onSkip={handleSkipQuestion}
        />
      )}
      {screen === 'active' && sessionQuestions.length > 0 && (
        <ActiveCallView
          questions={sessionQuestions}
          callSeconds={callSeconds}
          isPaused={isCallPaused}
          onPausedChange={setIsCallPaused}
          onCallEnd={handleCallEnd}
        />
      )}
      {screen === 'done' && (
        <DoneView
          answeredCount={answeredCount}
          callSeconds={finalCallSeconds}
          isPhoneMode={isPhoneMode}
          answeredItems={answeredItems}
          onAnswerNext={handleNextAfterDone}
          onBackToList={handleBackToRecordList}
          onViewTranscript={() => navigate('/parent/transcript')}
          onGoHome={() => navigate('/parent')}
        />
      )}
    </>
  )
}
