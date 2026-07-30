import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, FileText, Layers, MessageSquareText, Mic, Play, Volume2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { ActiveSeniorContextBar, MissingSeniorState } from '../components/ActiveSeniorContextBar'
import ChildBottomNav from '../components/ChildBottomNav'
import { useActiveSeniorContext } from '../hooks/useActiveSeniorContext'
import { useInterviewStore } from '../store/interviewStore'
import type { Chapter, Transcript } from '../types/interview'
import chapterMascot from '../assets/figma/chapter-mascot.png'

const ROMAN_NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX']

type ChapterStatus = 'review' | 'done' | 'needsQuestions'
type ReviewFilter = 'all' | ChapterStatus

const STATUS_META: Record<ChapterStatus, { label: string; bg: string; border: string; text: string }> = {
  review: {
    label: '검수 필요',
    bg: 'rgba(148,133,190,0.12)',
    border: 'rgba(148,133,190,0.5)',
    text: '#6A5AA0',
  },
  done: {
    label: '검수 완료',
    bg: '#EAF7EA',
    border: '#BDE5BD',
    text: '#3D7A3D',
  },
  needsQuestions: {
    label: '추가 질문 필요',
    bg: '#FFFBEB',
    border: '#FEE685',
    text: '#E17100',
  },
}

const FILTER_OPTIONS: Array<{ id: ReviewFilter; label: string }> = [
  { id: 'all', label: '전체' },
  { id: 'review', label: '검수 필요' },
  { id: 'done', label: '검수 완료' },
  { id: 'needsQuestions', label: '추가 질문 필요' },
]

const REVISION_REASONS = ['표현이 어색해요', '내용이 달라요', '더 추가하고 싶어요']

const WAVEFORM_HEIGHTS = [
  8, 22, 28, 22, 9, 23, 28, 21, 10, 24, 28, 20,
  11, 25, 28, 19, 13, 25, 27, 18, 14, 26, 27, 17,
  15, 26, 27, 16, 16, 27, 26, 15, 17, 27, 26, 13,
]

function BrandHeader() {
  return (
    <div className="px-6 pb-3 pt-4">
      <p className="text-[3.987px] font-medium uppercase leading-[5.436px] tracking-[1.2685px] text-[#2A2830]">
        FAMILY ARCHIVE
      </p>
      <p className="mt-0.5 font-serif text-[18px] font-semibold leading-[22px] text-[#2A2830]">
        Dearlog
      </p>
    </div>
  )
}

function SuggestionForm({
  transcriptId,
  onSend,
  sent,
}: {
  transcriptId: string
  onSend: (id: string, text: string) => void
  sent: boolean
}) {
  const [value, setValue] = useState('')

  if (sent) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded-xl bg-[#EEE9F2] px-3 py-2.5">
        <Check className="h-[14px] w-[14px] text-[#9485BE]" aria-hidden="true" />
        <p className="text-[13px] font-medium text-[#6F648F]">제안이 전송되었습니다</p>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="더 자연스러운 표현이나 추가하고 싶은 내용을 입력하세요..."
        rows={2}
        className="w-full resize-none rounded-xl border border-[#E0DBE8] bg-[#F8F6F9] px-3 py-2.5 text-[14px] leading-relaxed text-[#2A2830] outline-none transition placeholder:text-[#7A767F]/50 focus:border-[#9485BE]"
      />
      <button
        type="button"
        onClick={() => value.trim() && onSend(transcriptId, value.trim())}
        disabled={!value.trim()}
        className="mt-2 min-h-10 w-full rounded-xl bg-[#9485BE] text-[14px] font-medium text-white transition-opacity active:opacity-70 disabled:opacity-40"
      >
        제안 보내기
      </button>
    </div>
  )
}

function AnswerCard({ transcript }: { transcript: Transcript }) {
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [sentSuggestions, setSentSuggestions] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'original' | 'ai'>('original')

  const handleSend = (id: string) => {
    setSentSuggestions((prev) => new Set([...prev, id]))
    setShowSuggestion(false)
  }

  return (
    <div className="mb-3 overflow-hidden rounded-[14px] border border-[#E0DBE8] bg-white">
      <div className="px-4 pb-2 pt-4">
        <p className="mb-3 text-[14px] font-medium leading-relaxed text-[#2A2830]">
          {transcript.questionText || '부모님이 남긴 답변'}
        </p>

        <div className="mb-3 flex rounded-lg bg-[#E0DBE8] p-0.5">
          {(['original', 'ai'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setViewMode(mode)}
              className={`min-h-8 flex-1 rounded-md text-[12px] font-medium transition ${
                viewMode === mode ? 'bg-white text-[#2A2830]' : 'text-[#7A767F]'
              }`}
            >
              {mode === 'original' ? '원문' : 'AI 정리'}
            </button>
          ))}
        </div>

        <p
          className="line-clamp-3 rounded-[10px] px-3 py-2.5 text-[14px] leading-relaxed text-[#2A2830]"
          style={{ backgroundColor: viewMode === 'original' ? '#EDE8F0' : '#F8F6F9' }}
        >
          {viewMode === 'original' ? transcript.originalText : transcript.aiSummary}
        </p>
        <p className="mt-1.5 text-[11px] text-[#7A767F]">{transcript.recordedAt}</p>
      </div>

      <div className="flex border-t border-[#E0DBE8]">
        <button
          type="button"
          onClick={() => setShowSuggestion((value) => !value)}
          className="min-h-11 flex-1 text-[13px] font-medium text-[#9485BE] transition-opacity active:opacity-60"
        >
          수정 제안
        </button>
        <div className="w-px bg-[#E0DBE8]" />
        <button
          type="button"
          className="min-h-11 flex-1 text-[13px] font-medium text-[#7A767F] transition-opacity active:opacity-60"
        >
          사진 첨부
        </button>
      </div>

      {showSuggestion ? (
        <div className="px-4 pb-4">
          <SuggestionForm
            transcriptId={transcript.id}
            onSend={handleSend}
            sent={sentSuggestions.has(transcript.id)}
          />
        </div>
      ) : null}
    </div>
  )
}

function getChapterCounts(chapter: Chapter) {
  const answered = chapter.questions.filter((question) => question.completed).length
  const total = chapter.questions.length
  const percent = total > 0 ? Math.min(100, Math.round((answered / total) * 100)) : 0
  return { answered, total, percent }
}

function getChapterStatus(chapter: Chapter, transcripts: Transcript[]): ChapterStatus {
  const { answered, total, percent } = getChapterCounts(chapter)
  const chapterTranscripts = transcripts.filter((transcript) => transcript.chapterId === chapter.id)
  const hasTranscript = chapterTranscripts.length > 0

  if (chapterTranscripts.some((transcript) => transcript.reviewStatus !== 'applied')) return 'review'
  if (hasTranscript) return 'done'

  if (total === 0 || (answered === 0 && !hasTranscript)) return 'needsQuestions'
  if (percent >= 70) return 'done'
  if (hasTranscript || answered > 0) return 'review'
  return 'needsQuestions'
}

function getTranscriptStatus(transcript: Transcript, _chapter?: Chapter): ChapterStatus {
  if (transcript.reviewStatus === 'applied') return 'done'
  if (transcript.reviewStatus === 'revision_requested') return 'review'
  if (!transcript.questionText.trim()) return 'needsQuestions'
  return 'review'
}

function getSourceLabel(mode?: string) {
  if (mode === 'phone' || mode === 'app_call') return '전화 기록'
  if (mode === 'text') return '텍스트 답변'
  if (mode === 'voice') return '음성 답변'
  if (mode === 'photo') return '사진 이야기'
  return '음성 답변'
}

function formatReviewDate(date: string) {
  if (!date) return ''
  return date.replaceAll('-', '.')
}

function formatEstimatedDuration(transcript: Transcript) {
  const text = `${transcript.originalText} ${transcript.aiSummary}`.trim()
  const seconds = Math.max(18, Math.min(240, Math.round(text.length / 5)))
  const minutes = Math.floor(seconds / 60)
  const rest = String(seconds % 60).padStart(2, '0')
  return `${minutes}:${rest}`
}

function getReviewTitle(transcript: Transcript, chapter?: Chapter) {
  const question = transcript.questionText.trim()
  if (question) return question.replace(/[?.!。？！]$/, '')
  return `${chapter?.title || transcript.chapterTitle || '이야기'} 답변`
}

function StatusPill({ status }: { status: ChapterStatus }) {
  const meta = STATUS_META[status]
  return (
    <span
      className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium leading-[15px] tracking-[0.6px]"
      style={{ backgroundColor: meta.bg, borderColor: meta.border, color: meta.text }}
    >
      {meta.label}
    </span>
  )
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-h-16 min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] bg-white/70 px-2 py-2">
      <p className="font-serif text-[18px] font-semibold leading-[27px] text-[#2A2830]">{value}</p>
      <p className="mt-0.5 text-center text-[10px] leading-[13px] text-[#7A767F] [word-break:keep-all]">{label}</p>
    </div>
  )
}

function ChapterRow({
  chapter,
  index,
  status,
  expanded,
  transcripts,
  onClick,
}: {
  chapter: Chapter
  index: number
  status: ChapterStatus
  expanded: boolean
  transcripts: Transcript[]
  onClick: () => void
}) {
  const { answered, total, percent } = getChapterCounts(chapter)
  const chapterTranscripts = transcripts.filter((transcript) => transcript.chapterId === chapter.id)

  return (
    <div className="border-b border-[#E0DBE8]">
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-[76px] w-full items-start gap-4 py-4 text-left transition active:opacity-70"
        aria-expanded={expanded}
      >
        <span className="w-7 shrink-0 pt-1 font-serif text-[18px] font-normal leading-[27px] text-[#2A2830]">
          {ROMAN_NUMERALS[index] || String(index + 1)}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center justify-between gap-3">
            <span className="min-w-0 truncate font-serif text-[14px] font-semibold leading-[21px] text-[#2A2830]">
              {chapter.title}
            </span>
            <StatusPill status={status} />
          </span>
          <span className="mt-2 flex items-center gap-2">
            <span className="h-[3px] min-w-0 flex-1 overflow-hidden rounded-full bg-[#EDE8F0]">
              <span
                className="block h-full rounded-full bg-[#9485BE] transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </span>
            <span className="w-8 shrink-0 text-right text-[10px] font-medium leading-[15px] text-[#7A767F]">
              {answered}/{total}
            </span>
          </span>
        </span>
        <ChevronRight
          className={`mt-1 h-[14px] w-[14px] shrink-0 text-[#7A767F] transition-transform ${expanded ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>

      {expanded ? (
        <div className="pb-4 pl-11">
          {chapterTranscripts.length === 0 ? (
            <div className="rounded-[14px] border border-dashed border-[#E0DBE8] bg-white/70 px-4 py-5 text-center">
              <MessageSquareText className="mx-auto h-5 w-5 text-[#9485BE]" aria-hidden="true" />
              <p className="mt-2 text-[13px] font-medium text-[#2A2830]">아직 확인할 답변이 없어요</p>
              <p className="mt-1 text-[12px] leading-[18px] text-[#7A767F]">
                질문을 더 준비하거나 부모님의 답변을 기다려 주세요.
              </p>
            </div>
          ) : (
            chapterTranscripts.map((transcript) => <AnswerCard key={transcript.id} transcript={transcript} />)
          )}
        </div>
      ) : null}
    </div>
  )
}

function ReviewListItem({
  transcript,
  chapter,
  status,
  onOpen,
}: {
  transcript: Transcript
  chapter?: Chapter
  status: ChapterStatus
  onOpen: () => void
}) {
  const title = getReviewTitle(transcript, chapter)
  const preview = transcript.aiSummary || transcript.originalText
  const chapterLabel = chapter?.title || transcript.chapterTitle || '챕터'

  return (
    <article className="border-b border-[#E0DBE8] py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <span className="rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] py-[5px] text-[10px] font-medium leading-[15px] tracking-[1.2px] text-[#7A767F]">
            {chapterLabel}
          </span>
          <span className="rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] py-[5px] text-[10px] font-medium leading-[15px] tracking-[1.2px] text-[#7A767F]">
            {getSourceLabel(transcript.mode)}
          </span>
        </div>
        <StatusPill status={status} />
      </div>

      <h2 className="mt-2 overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[14px] font-semibold leading-[21px] text-[#2A2830]">
        {title}
      </h2>
      <p className="mt-1.5 overflow-hidden text-[12px] font-normal leading-[19.5px] text-[#7A767F] [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {preview}
      </p>
      <div className="mt-3 flex min-h-8 items-center justify-between gap-3">
        <p className="text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
          {formatReviewDate(transcript.recordedAt)}
        </p>
        <button
          type="button"
          onClick={onOpen}
          className="flex min-h-8 items-center gap-1 rounded-[10px] border border-[#E0DBE8] bg-white px-[13px] py-[7px] text-[12px] font-medium leading-[18px] text-[#2A2830] transition active:scale-[0.98]"
        >
          확인하기
          <ChevronRight className="h-[11px] w-[11px]" aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

function DetailTabButton({
  active,
  children,
  onClick,
}: {
  active: boolean
  children: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-10 flex-1 border-b text-[12px] font-medium leading-[18px] tracking-[0.72px] transition ${
        active
          ? 'border-[#2A2830] text-[#2A2830]'
          : 'border-transparent text-[#7A767F]'
      }`}
    >
      {children}
    </button>
  )
}

function WaveformBars() {
  return (
    <div aria-hidden="true" className="flex h-11 w-full items-center gap-0.5 pt-3">
      {WAVEFORM_HEIGHTS.map((height, index) => (
        <span
          key={`${height}-${index}`}
          className={`min-w-0 flex-1 rounded-full ${index < 12 ? 'bg-[#9485BE]' : 'bg-[#E0DBE8]'}`}
          style={{ height }}
        />
      ))}
    </div>
  )
}

function OriginalAudioCard({ transcript, duration }: { transcript: Transcript; duration: string }) {
  const [audioState, setAudioState] = useState<'idle' | 'playing' | 'error'>('idle')
  const canPlayAudio = Boolean(transcript.audioUrl)
  const audioFileKey = transcript.audioFileKey?.toLowerCase() ?? ''
  const isTextRecord = transcript.mode === 'text' || audioFileKey.endsWith('.txt')
  const unavailableLabel = isTextRecord ? '텍스트 기록' : '음성 파일 없음'
  const buttonLabel = canPlayAudio ? (audioState === 'playing' ? '재생 중' : '원문 듣기') : unavailableLabel
  const ButtonIcon = canPlayAudio ? Play : isTextRecord ? FileText : Volume2

  useEffect(() => {
    setAudioState('idle')
  }, [transcript.id, transcript.audioUrl])

  const handlePlay = async () => {
    if (!transcript.audioUrl) {
      return
    }

    try {
      const audio = new Audio(transcript.audioUrl)
      setAudioState('playing')
      audio.onended = () => setAudioState('idle')
      audio.onerror = () => setAudioState('error')
      await audio.play()
    } catch {
      setAudioState('error')
    }
  }

  return (
    <div className="rounded-[14px] border border-[#E0DBE8] bg-white p-[17px]">
      <div className="flex items-center gap-2">
        <Volume2 className="h-[13px] w-[13px] shrink-0 text-[#9485BE]" aria-hidden="true" />
        <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
          원본 음성
        </p>
        <p className="ml-auto text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
          {duration}
        </p>
      </div>
      <WaveformBars />
      <button
        type="button"
        onClick={handlePlay}
        disabled={!canPlayAudio}
        className="mt-3 flex min-h-8 w-full items-center justify-center gap-2 text-[12px] font-medium leading-[18px] text-[#2A2830] transition active:opacity-70 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <ButtonIcon className={`h-[14px] w-[14px] ${canPlayAudio ? 'text-[#9485BE]' : 'text-[#A9A3B3]'}`} aria-hidden="true" />
        {buttonLabel}
      </button>
      {audioState === 'error' ? (
        <p className="mt-2 text-center text-[11px] leading-[16.5px] text-[#7A767F]">
          음성 파일을 불러오지 못했어요.
        </p>
      ) : null}
    </div>
  )
}

function ReviewTextPanel({
  eyebrow,
  text,
  tone = 'normal',
  minHeightClass = 'min-h-[220px]',
  maxHeightClass = 'max-h-[42dvh]',
}: {
  eyebrow: string
  text: string
  tone?: 'normal' | 'muted'
  minHeightClass?: string
  maxHeightClass?: string
}) {
  return (
    <div className="rounded-[14px] border border-[#E0DBE8] bg-white p-[17px]">
      <p className="text-[10px] font-normal uppercase leading-[15px] tracking-[1.2px] text-[#7A767F]">
        {eyebrow}
      </p>
      <div
        className={`mt-3 ${minHeightClass} ${maxHeightClass} overflow-y-auto overscroll-contain rounded-[10px] bg-[#F8F6F9] px-3.5 py-3`}
      >
        <p
          className={`whitespace-pre-wrap font-serif text-[14px] font-normal leading-[27px] ${
            tone === 'muted' ? 'text-[#7A767F]' : 'text-[#2A2830]'
          }`}
        >
          {text.trim() || '내용이 아직 준비되지 않았어요.'}
        </p>
      </div>
    </div>
  )
}

function ReviewDetailScreen({
  transcript,
  chapter,
  status,
  applied,
  onBack,
  onApply,
  onRequestRevision,
}: {
  transcript: Transcript
  chapter?: Chapter
  status: ChapterStatus
  applied: boolean
  onBack: () => void
  onApply: () => Promise<void> | void
  onRequestRevision: (text: string) => Promise<void> | void
}) {
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'summary' | 'original' | 'edit'>('summary')
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [editText, setEditText] = useState(transcript.reviewRequestText || '')
  const [editSent, setEditSent] = useState(false)
  const [savingAction, setSavingAction] = useState<'apply' | 'edit' | null>(null)
  const title = getReviewTitle(transcript, chapter)
  const chapterLabel = chapter?.title || transcript.chapterTitle || '챕터'
  const displayStatus: ChapterStatus = applied ? 'done' : status
  const duration = formatEstimatedDuration(transcript)
  const revisionText = [
    selectedReason ? `사유: ${selectedReason}` : '',
    editText.trim() ? `요청 내용: ${editText.trim()}` : '',
  ].filter(Boolean).join('\n')

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <main className="min-h-0 flex-1 overflow-y-auto pb-10">
        <div className="px-6 pb-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[#7A767F] transition active:scale-95"
            aria-label="검수 목록으로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <header className="px-6 pb-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] py-[5px] text-[10px] font-medium leading-[15px] tracking-[1.2px] text-[#7A767F]">
              {chapterLabel}
            </span>
            <span className="rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] py-[5px] text-[10px] font-medium leading-[15px] tracking-[1.2px] text-[#7A767F]">
              {getSourceLabel(transcript.mode)}
            </span>
          </div>
          <h1 className="mt-[10px] overflow-hidden text-ellipsis whitespace-nowrap font-serif text-[20px] font-normal leading-[30px] text-[#2A2830]">
            {title}
          </h1>
          <p className="mt-1 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
            {formatReviewDate(transcript.recordedAt)} · {duration}
          </p>
        </header>

        <div className="px-6">
          <div className="flex border-b border-[#E0DBE8]">
            <DetailTabButton active={activeTab === 'summary'} onClick={() => setActiveTab('summary')}>
              정리본
            </DetailTabButton>
            <DetailTabButton active={activeTab === 'original'} onClick={() => setActiveTab('original')}>
              원문
            </DetailTabButton>
            <DetailTabButton active={activeTab === 'edit'} onClick={() => setActiveTab('edit')}>
              수정 요청
            </DetailTabButton>
          </div>
        </div>

        <section className="px-6 pt-5">
          {activeTab === 'summary' ? (
            <>
              <div className="flex items-center gap-2">
                <Mic className="h-[11px] w-[11px] text-[#9485BE]" aria-hidden="true" />
                <p className="min-w-0 flex-1 truncate text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                  {getSourceLabel(transcript.mode)}에서 정리 · AI 요약
                </p>
                <StatusPill status={displayStatus} />
              </div>
              <div className="mt-4">
                <ReviewTextPanel
                  eyebrow="정리본 전체"
                  text={transcript.aiSummary || transcript.originalText}
                  minHeightClass="min-h-[180px]"
                  maxHeightClass="max-h-[36dvh]"
                />
              </div>
              <div className="mt-5 flex items-center gap-2.5 rounded-[14px] bg-[#F0EDF7] px-4 py-3">
                <Layers className="h-[13px] w-[13px] shrink-0 text-[#9485BE]" aria-hidden="true" />
                <div>
                  <p className="text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                    반영 예정 챕터
                  </p>
                  <p className="font-serif text-[13px] font-medium leading-[19.5px] text-[#2A2830]">
                    {ROMAN_NUMERALS[Math.max(0, (chapter?.order ?? 1) - 1)] || chapter?.order || 'I'}. {chapterLabel}
                  </p>
                </div>
              </div>
            </>
          ) : null}

          {activeTab === 'original' ? (
            <div className="space-y-4">
              <div className="rounded-[14px] border border-[#E0DBE8] bg-white p-[17px]">
                <p className="text-[10px] font-normal uppercase leading-[15px] tracking-[1.2px] text-[#7A767F]">
                  원문 질문
                </p>
                <p className="mt-2 font-serif text-[13px] font-normal leading-[21px] text-[#2A2830]">
                  {transcript.questionText || '부모님이 남긴 원문 답변'}
                </p>
              </div>
              <OriginalAudioCard transcript={transcript} duration={duration} />
              <ReviewTextPanel
                eyebrow="원문 전체"
                text={transcript.originalText}
                tone="muted"
              />
            </div>
          ) : null}

          {activeTab === 'edit' ? (
            <div>
              <p className="text-[13px] font-normal leading-[19.5px] text-[#7A767F]">
                정리본에 수정이 필요한 부분을 알려주세요.
              </p>
              <div className="mt-4">
                <ReviewTextPanel
                  eyebrow="원문 참조"
                  text={transcript.originalText}
                  tone="muted"
                  minHeightClass="min-h-[150px]"
                  maxHeightClass="max-h-[28dvh]"
                />
              </div>
              <div className="mt-4 overflow-x-auto pb-px">
                <div className="flex min-w-max gap-2">
                  {REVISION_REASONS.map((reason) => {
                    const selected = selectedReason === reason
                    return (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => {
                          setSelectedReason((current) => current === reason ? null : reason)
                          setEditSent(false)
                        }}
                        className={`min-h-[30.5px] rounded-full border bg-white px-[14px] text-[11px] font-medium leading-[16.5px] transition active:scale-[0.98] ${
                          selected
                            ? 'border-[#2A2830] text-[#2A2830]'
                            : 'border-[#E0DBE8] text-[#7A767F]'
                        }`}
                      >
                        {reason}
                      </button>
                    )
                  })}
                </div>
              </div>
              <textarea
                value={editText}
                onChange={(event) => {
                  setEditText(event.target.value)
                  setEditSent(false)
                }}
                rows={4}
                placeholder="수정하고 싶은 내용을 적어주세요."
                aria-label="수정 요청 내용"
                className="mt-4 min-h-[178px] max-h-[40dvh] w-full resize-y overflow-y-auto rounded-[14px] border border-[#E0DBE8] bg-white p-[17px] text-[13px] leading-[22.1px] text-[#2A2830] outline-none transition placeholder:text-[#7A767F]/50 focus:border-[#9485BE]"
              />
              {editSent ? (
                <p className="mt-3 rounded-[14px] bg-[#EEE9F2] px-4 py-3 text-[13px] font-medium text-[#6F648F]">
                  수정 요청이 저장되었습니다.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 space-y-2.5">
            {activeTab === 'edit' ? (
              <button
                type="button"
                onClick={async () => {
                  setSavingAction('edit')
                  try {
                    await onRequestRevision(revisionText)
                    setEditSent(true)
                  } finally {
                    setSavingAction(null)
                  }
                }}
                disabled={!revisionText || savingAction === 'edit'}
                className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:bg-[#CFC8DA]"
              >
                {savingAction === 'edit' ? '저장 중...' : '수정 요청 보내기'}
              </button>
            ) : (
              <button
                type="button"
                onClick={async () => {
                  setSavingAction('apply')
                  try {
                    await onApply()
                  } finally {
                    setSavingAction(null)
                  }
                }}
                disabled={savingAction === 'apply'}
                className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99]"
              >
                {savingAction === 'apply' ? '반영 중...' : applied ? '챕터에 반영됨' : '챕터에 반영하기'}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                if (activeTab === 'edit') {
                  navigate('/child/questions')
                  return
                }
                setActiveTab('edit')
              }}
              className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] border border-[#E0DBE8] bg-white px-5 text-[14px] font-medium leading-[21px] tracking-[0.42px] text-[#2A2830] transition active:scale-[0.99]"
            >
              {activeTab === 'edit' ? '추가 질문 만들기' : '수정 요청하기'}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}

function ReviewListScreen({
  chapters,
  transcripts,
  onBack,
  onUpdateTranscriptReview,
}: {
  chapters: Chapter[]
  transcripts: Transcript[]
  onBack: () => void
  onUpdateTranscriptReview: (transcriptId: string, input: {
    reviewStatus: 'pending' | 'applied' | 'revision_requested'
    reviewRequestText?: string | null
  }) => Promise<void>
}) {
  const [activeFilter, setActiveFilter] = useState<ReviewFilter>('all')
  const [selectedTranscriptId, setSelectedTranscriptId] = useState<string | null>(null)

  const chapterById = useMemo(
    () => new Map(chapters.map((chapter) => [chapter.id, chapter])),
    [chapters]
  )

  const reviewItems = useMemo(() => {
    return transcripts
      .map((transcript) => {
        const chapter = chapterById.get(transcript.chapterId)
        const status = getTranscriptStatus(transcript, chapter)
        return { transcript, chapter, status }
      })
      .filter((item) => activeFilter === 'all' || item.status === activeFilter)
      .sort((a, b) => b.transcript.recordedAt.localeCompare(a.transcript.recordedAt))
  }, [activeFilter, chapterById, transcripts])

  const selectedItem = selectedTranscriptId
    ? reviewItems.find((item) => item.transcript.id === selectedTranscriptId)
      || transcripts
        .map((transcript) => {
          const chapter = chapterById.get(transcript.chapterId)
          const status = getTranscriptStatus(transcript, chapter)
          return { transcript, chapter, status }
        })
        .find((item) => item.transcript.id === selectedTranscriptId)
    : null

  if (selectedItem) {
    return (
      <ReviewDetailScreen
        transcript={selectedItem.transcript}
        chapter={selectedItem.chapter}
        status={selectedItem.status}
        applied={selectedItem.transcript.reviewStatus === 'applied'}
        onBack={() => setSelectedTranscriptId(null)}
        onApply={() => onUpdateTranscriptReview(selectedItem.transcript.id, { reviewStatus: 'applied' })}
        onRequestRevision={(text) => onUpdateTranscriptReview(selectedItem.transcript.id, {
          reviewStatus: 'revision_requested',
          reviewRequestText: text,
        })}
      />
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <main className="min-h-0 flex-1 overflow-y-auto pb-8">
        <div className="px-6 pb-3 pt-2">
          <button
            type="button"
            onClick={onBack}
            className="-ml-2 flex h-11 w-11 items-center justify-center rounded-full text-[#7A767F] transition active:scale-95"
            aria-label="챕터 관리로 돌아가기"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <header className="px-6 pb-4">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            검수
          </p>
          <h1 className="mt-2 font-serif text-[24px] font-normal leading-9 text-[#2A2830]">
            검수가 필요한 이야기
          </h1>
          <p className="mt-1 text-[12px] font-normal leading-[18px] text-[#7A767F]">
            부모님이 남긴 이야기를 확인하고 챕터에 반영해보세요.
          </p>
        </header>

        <div className="overflow-x-auto px-6 pb-4">
          <div className="flex min-w-max gap-2">
            {FILTER_OPTIONS.map((option) => {
              const active = activeFilter === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setActiveFilter(option.id)
                    setSelectedTranscriptId(null)
                  }}
                  className={`min-h-[30px] rounded-full border px-4 text-[11px] font-medium leading-[16.5px] tracking-[0.275px] transition active:scale-[0.98] ${
                    active
                      ? 'border-[#2A2830] bg-[#2A2830] text-[#F8F6F9]'
                      : 'border-[#E0DBE8] bg-white text-[#7A767F]'
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className="px-6">
          <div className="h-px bg-[#E0DBE8]" />
          {reviewItems.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-[14px] font-medium text-[#2A2830]">표시할 이야기가 없어요</p>
              <p className="mt-1 text-[12px] leading-[18px] text-[#7A767F]">
                부모님 답변이 쌓이면 이곳에서 검수할 수 있어요.
              </p>
            </div>
          ) : (
            reviewItems.map(({ transcript, chapter, status }) => (
              <ReviewListItem
                key={transcript.id}
                transcript={transcript}
                chapter={chapter}
                status={status}
                onOpen={() => setSelectedTranscriptId(transcript.id)}
              />
            ))
          )}
        </div>
      </main>
    </div>
  )
}

export default function ChildChaptersScreen() {
  const navigate = useNavigate()
  const { chapters, transcripts, fetchChaptersAndQuestions, fetchTranscripts, updateTranscriptReview } = useInterviewStore()
  const {
    activeSenior,
    activeSeniorId,
    loading: seniorLoading,
    seniors,
    setActiveSeniorId,
  } = useActiveSeniorContext()
  const [expandedChapterId, setExpandedChapterId] = useState<string | null>(null)
  const [showReviewList, setShowReviewList] = useState(false)

  useEffect(() => {
    if (!activeSeniorId) return
    void fetchChaptersAndQuestions(activeSeniorId)
    void fetchTranscripts(activeSeniorId)
  }, [activeSeniorId, fetchChaptersAndQuestions, fetchTranscripts])

  const sortedChapters = useMemo(
    () => [...chapters].sort((a, b) => a.order - b.order),
    [chapters]
  )

  const chapterStatuses = useMemo(() => {
    return new Map(sortedChapters.map((chapter) => [chapter.id, getChapterStatus(chapter, transcripts)]))
  }, [sortedChapters, transcripts])

  const summary = useMemo(() => {
    const reviewedTranscripts = transcripts.filter((transcript) => transcript.reviewStatus === 'applied').length
    const reviewNeeded = Math.max(0, transcripts.length - reviewedTranscripts)
    return {
      reviewNeeded,
      reviewed: reviewedTranscripts,
      needsQuestions: sortedChapters.filter((chapter) => getChapterStatus(chapter, transcripts) === 'needsQuestions').length,
    }
  }, [sortedChapters, transcripts])

  const openReviewList = () => {
    setShowReviewList(true)
  }

  const contextBar = (
    <ActiveSeniorContextBar
      activeSenior={activeSenior}
      activeSeniorId={activeSeniorId}
      loading={seniorLoading}
      onChange={setActiveSeniorId}
      seniors={seniors}
    />
  )

  if (!seniorLoading && !activeSenior) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
        <BrandHeader />
        <MissingSeniorState onCreate={() => navigate('/child/record-space/new')} />
        <ChildBottomNav />
      </div>
    )
  }

  if (showReviewList) {
    return (
      <ReviewListScreen
        chapters={sortedChapters}
        transcripts={transcripts}
        onBack={() => setShowReviewList(false)}
        onUpdateTranscriptReview={updateTranscriptReview}
      />
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <BrandHeader />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-[112px] pt-2">
        <div className="mb-5">{contextBar}</div>

        <header className="relative">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            챕터 관리
          </p>
          <h1 className="mt-2 font-serif text-[26px] font-normal leading-[33px] text-[#2A2830]">
            챕터를 정리해보세요
          </h1>
          <p className="mt-1 text-[12px] font-normal leading-[18px] text-[#7A767F]">
            각 챕터를 확인하고 기록집 완성도를 높여보세요.
          </p>
          <img
            src={chapterMascot}
            alt=""
            className="absolute right-2 top-10 h-[68px] w-16 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          />
        </header>

        <section className="mt-[18px] rounded-[16px] border border-[#DDD7EF] bg-[#F0EDF7] p-[17px]">
          <p className="text-[11px] font-normal uppercase leading-[16.5px] tracking-[1.32px] text-[#9485BE]">
            검수 현황
          </p>
          <div className="mt-3 flex gap-3">
            <SummaryMetric value={summary.reviewNeeded} label="검수 필요" />
            <SummaryMetric value={summary.reviewed} label="검수 완료" />
            <SummaryMetric value={summary.needsQuestions} label="추가 질문 필요" />
          </div>
          <button
            type="button"
            onClick={openReviewList}
            className="mt-[17px] flex min-h-10 w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-4 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99]"
          >
            검수하러 가기
          </button>
        </section>

        <section className="mt-[15px]">
          {sortedChapters.length === 0 ? (
            <div className="rounded-[16px] border border-dashed border-[#E0DBE8] bg-white/70 px-4 py-8 text-center">
              <p className="text-[14px] font-medium text-[#2A2830]">아직 챕터가 준비되지 않았어요</p>
              <p className="mt-1 text-[12px] leading-[18px] text-[#7A767F]">
                질문과 답변이 쌓이면 이곳에서 챕터별 완성도를 볼 수 있어요.
              </p>
            </div>
          ) : (
            sortedChapters.map((chapter, index) => (
              <ChapterRow
                key={chapter.id}
                chapter={chapter}
                index={index}
                status={chapterStatuses.get(chapter.id) ?? 'needsQuestions'}
                expanded={expandedChapterId === chapter.id}
                transcripts={transcripts}
                onClick={() => setExpandedChapterId((current) => (current === chapter.id ? null : chapter.id))}
              />
            ))
          )}
        </section>
      </main>

      <ChildBottomNav />
    </div>
  )
}
