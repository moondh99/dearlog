import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import BottomNav from '../components/BottomNav'
import { useInterviewStore } from '../store/interviewStore'
import type { Transcript } from '../types/interview'
import type { ReliabilityLabel } from '../types/agents'

type ViewMode = 'original' | 'ai'

const RELIABILITY_COLOR: Record<ReliabilityLabel, string> = {
  CONFIRMED: '#9485BE',
  ESTIMATED: '#9485BE',
  UNVERIFIED: '#B4AFA9',
}
const RELIABILITY_LABEL: Record<ReliabilityLabel, string> = {
  CONFIRMED: '확인됨',
  ESTIMATED: '추정',
  UNVERIFIED: '미확인',
}

const NER_META = [
  { key: 'persons' as const, emoji: '🟤', label: '인물' },
  { key: 'places'  as const, emoji: '🟢', label: '장소' },
  { key: 'times'   as const, emoji: '🔵', label: '시간' },
  { key: 'events'  as const, emoji: '🟠', label: '사건' },
]

type TranscriptStatusTone = 'done' | 'progress' | 'saved' | 'review'

function ParentTranscriptHeader({ onBack }: { onBack: () => void }) {
  return (
    <>
      <header className="flex h-[60px] shrink-0 items-center gap-3 px-6 py-5">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7A767F] transition active:bg-[#EDE8F0]"
          aria-label="부모 홈으로 돌아가기"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
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

function formatRecordDate(date: string) {
  return date ? date.replaceAll('-', '.') : '방금 전'
}

function getTranscriptStatus(transcript: Transcript): { label: string; tone: TranscriptStatusTone } {
  if (transcript.reviewStatus === 'applied') return { label: '정리 완료', tone: 'done' }
  if (transcript.reviewStatus === 'revision_requested') return { label: '수정 요청', tone: 'review' }
  if (transcript.aiSummary || transcript.chunk) return { label: '정리 중', tone: 'progress' }
  return { label: '원문 저장됨', tone: 'saved' }
}

function getStatusClass(tone: TranscriptStatusTone) {
  if (tone === 'done') return 'border-[#C5E1C5] bg-[#E8F4E8] text-[#3D7A3D]'
  if (tone === 'review') return 'border-[#F6D6A8] bg-[#FFF5E8] text-[#9A6B24]'
  if (tone === 'saved') return 'border-[#D7CDEE] bg-[#F4F0FA] text-[#6A5AA0]'
  return 'border-[#BEDBFF] bg-[#EFF6FF] text-[#2B7FFF]'
}

function getModeLabel(mode?: string) {
  if (mode === 'photo') return '사진 이야기'
  if (mode === 'phone') return '전화 답변'
  return '음성 답변'
}

function getRecordTitle(transcript: Transcript) {
  const text = transcript.questionText.trim()
  if (!text) return `${transcript.chapterTitle || '나의'} 이야기`
  if (text.includes('음식')) return `${transcript.chapterTitle || '어린 시절'} 음식 이야기`
  if (text.includes('사진') && text.includes('이야기')) return '이 사진을 찍은 날의 이야기'
  return text.replace(/[?？.。!！]+$/, '')
}

function formatEstimatedDuration(transcript: Transcript) {
  const text = transcript.originalText || transcript.aiSummary || ''
  const seconds = Math.max(34, Math.min(180, Math.round(text.length / 3)))
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

const ORIGINAL_WAVEFORM_BARS = [
  8, 24, 30, 22, 10, 25, 30, 21,
  11, 26, 30, 20, 13, 27, 30, 19,
  13, 27, 29, 18, 14, 28, 29, 17,
  16, 28, 28, 16, 17, 29, 28, 15,
]

function quoteOriginalText(text: string) {
  const trimmed = text.trim()
  if (!trimmed) return '"원문 기록이 아직 준비되지 않았어요."'
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith('“') && trimmed.endsWith('”'))) {
    return trimmed
  }
  return `"${trimmed}"`
}

function OriginalAudioCard({
  duration,
  onPlay,
}: {
  duration: string
  onPlay: () => void
}) {
  return (
    <div className="rounded-[14px] border border-[#E0DBE8] bg-white p-[17px]">
      <div className="flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M11 5L6 9H3V15H6L11 19V5Z" stroke="#9485BE" strokeWidth="1.8" strokeLinejoin="round" />
          <path d="M15 9.5C15.7 10.2 16 11.05 16 12C16 12.95 15.7 13.8 15 14.5" stroke="#9485BE" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <span className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
          원본 음성
        </span>
        <span className="ml-auto text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
          {duration}
        </span>
      </div>

      <div className="flex h-[52px] items-center gap-[3px] pt-3" aria-hidden="true">
        {ORIGINAL_WAVEFORM_BARS.map((height, index) => (
          <span
            key={`${height}-${index}`}
            className={`min-w-px flex-1 rounded-full ${index < 14 ? 'bg-[#9485BE]' : 'bg-[#E0DBE8]'}`}
            style={{ height }}
          />
        ))}
      </div>

      <button
        type="button"
        onClick={onPlay}
        className="flex w-full items-center justify-center gap-2 pt-3 text-[14px] font-medium leading-[21px] text-[#2A2830] transition active:scale-[0.99]"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M8 5V19L19 12L8 5Z" stroke="#9485BE" strokeWidth="1.8" strokeLinejoin="round" />
        </svg>
        원문 듣기
      </button>
    </div>
  )
}

function TranscriptDetail({
  transcript,
  onClose,
}: {
  transcript: Transcript
  onClose: () => void
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('ai')
  const bodyText = viewMode === 'ai'
    ? transcript.chunk?.clean || transcript.aiSummary || transcript.originalText
    : transcript.originalText
  const helperText = viewMode === 'ai' ? '자녀가 정리한 이야기' : '원문 그대로 보존된 이야기'
  const duration = formatEstimatedDuration(transcript)

  const handlePlayOriginal = () => {
    if (!transcript.audioUrl) return
    void new Audio(transcript.audioUrl).play()
  }

  return (
    <div className="fixed inset-y-0 left-1/2 z-40 flex w-full max-w-[390px] -translate-x-1/2 flex-col overflow-hidden bg-[#F8F6F9] text-[#2A2830] shadow-[0_0_0_1px_rgba(224,219,232,0.55)]">
      <div className="shrink-0 px-6 pb-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex h-6 w-6 items-center justify-start text-[#7A767F] transition active:scale-95"
          aria-label="내 기록으로 돌아가기"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M15 18L9 12L15 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <section className="shrink-0 px-6 pb-4">
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex h-[25px] items-center rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] text-[#7A767F]">
            {transcript.chapterTitle || '기타'}
          </span>
          <span className="inline-flex h-[25px] items-center rounded-full border border-[#9485BE]/25 bg-[#9485BE]/[0.12] px-[11px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] text-[#6A5AA0]">
            {getModeLabel(transcript.mode)}
          </span>
        </div>
        <h1 className="mt-3 line-clamp-2 font-serif text-[22px] font-normal leading-[30.8px] text-[#2A2830]">
          {getRecordTitle(transcript)}
        </h1>
        <p className="mt-1.5 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
          {formatRecordDate(transcript.recordedAt)} · {duration}
        </p>
      </section>

      <div className="shrink-0 px-6">
        <div className="grid h-[41px] grid-cols-2 border-b border-[#E0DBE8]">
          {(['ai', 'original'] as ViewMode[]).map((v) => {
            const active = viewMode === v
            return (
              <button
                key={v}
                type="button"
                onClick={() => setViewMode(v)}
                className={`relative flex items-start justify-center pt-1.5 text-[13px] font-medium leading-[19.5px] ${
                  active ? 'text-[#2A2830]' : 'text-[#7A767F]'
                }`}
              >
                {v === 'ai' ? '정리본' : '원문'}
                {active ? <span className="absolute -bottom-px left-0 right-0 h-px bg-[#2A2830]" /> : null}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 pb-8 pt-5">
        {viewMode === 'original' ? (
          <>
            <OriginalAudioCard duration={duration} onPlay={handlePlayOriginal} />
            <p className="mt-6 whitespace-pre-wrap font-serif text-[15px] font-normal leading-[30px] text-[#7A767F]">
              {quoteOriginalText(bodyText)}
            </p>
          </>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="flex h-3 w-3 items-center justify-center rounded-full border border-[#9BB899] text-[8px] text-[#7FA07C]">
                ✓
              </span>
              <span className="text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                {helperText}
              </span>
            </div>
            <p className="mt-4 whitespace-pre-wrap font-serif text-[16px] font-normal leading-[33.6px] text-[#2A2830]">
              {bodyText}
            </p>
          </>
        )}
      </div>
    </div>
  )
}

function TranscriptCard({
  transcript,
  onClick,
}: {
  transcript: Transcript
  onClick: () => void
}) {
  const status = getTranscriptStatus(transcript)
  const preview = transcript.aiSummary || transcript.originalText

  return (
    <button
      onClick={onClick}
      className="mb-3 w-full rounded-2xl border border-[#E0DBE8] bg-white p-[21px] text-left shadow-[0_2px_6px_rgba(42,40,48,0.06)] transition active:scale-[0.99]"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 flex-wrap gap-1.5">
          <span className="inline-flex h-[25px] items-center rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] text-[#7A767F]">
            {transcript.chapterTitle || '기타'}
          </span>
          <span className={`inline-flex h-[21px] items-center rounded-full border px-2 text-[10px] font-normal leading-[15px] tracking-[0.6px] ${getStatusClass(status.tone)}`}>
            {status.label}
          </span>
        </div>
        <span className="shrink-0 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
          {formatRecordDate(transcript.recordedAt)}
        </span>
      </div>
      <p className="mt-3 line-clamp-1 font-serif text-[16px] font-semibold leading-6 text-[#2A2830]">
        {getRecordTitle(transcript)}
      </p>
      <p className="mt-2 line-clamp-2 text-[12px] font-normal leading-[19.5px] text-[#7A767F]">
        {preview}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="inline-flex h-[25px] items-center rounded-full border border-[#9485BE]/25 bg-[#9485BE]/[0.12] px-[11px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] text-[#6A5AA0]">
          {getModeLabel(transcript.mode)}
        </span>
        <span className="inline-flex items-center gap-1 text-[13px] font-medium leading-[19.5px] text-[#2A2830]">
          보기
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M9 18L15 12L9 6" stroke="#2A2830" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </div>
    </button>
  )
}

export default function ParentTranscriptScreen() {
  const navigate = useNavigate()
  const { transcripts, fetchTranscripts } = useInterviewStore()
  const [selectedId, setSelectedId] = useState<string | null>(null)

  useEffect(() => {
    void fetchTranscripts()
  }, [fetchTranscripts])

  const sorted = useMemo(
    () => [...transcripts].sort((a, b) => b.recordedAt.localeCompare(a.recordedAt)),
    [transcripts]
  )

  const selected = useMemo(
    () => sorted.find((t) => t.id === selectedId) ?? null,
    [sorted, selectedId]
  )

  const stats = useMemo(() => {
    const done = transcripts.filter((transcript) => getTranscriptStatus(transcript).tone === 'done').length
    return {
      total: transcripts.length,
      done,
      inProgress: Math.max(0, transcripts.length - done),
    }
  }, [transcripts])

  return (
    <>
      <div className="flex flex-col min-h-screen bg-[#F8F6F9]">
        <ParentTranscriptHeader onBack={() => navigate('/parent')} />

        <div className="flex-1 overflow-y-auto pb-28">
          <section className="px-5 pt-5">
            <h1 className="font-serif text-[24px] font-normal leading-9 text-[#2A2830]">내가 남긴 이야기</h1>
            <p className="mt-1.5 text-[12px] font-normal leading-[18px] text-[#7A767F]">
              자녀가 소중히 정리하고 있어요.
            </p>
          </section>

          <section className="px-5 pt-5">
            <div className="grid grid-cols-3 rounded-2xl bg-[#F0EDF7] p-5">
              {[
                { value: stats.total, label: '총 이야기' },
                { value: stats.done, label: '정리 완료' },
                { value: stats.inProgress, label: '정리 중' },
              ].map((item) => (
                <div key={item.label} className="text-center">
                  <p className="font-serif text-[26px] font-semibold leading-[39px] text-[#2A2830]">
                    {item.value}
                  </p>
                  <p className="pt-0.5 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                    {item.label}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className="px-5 pt-6">
            {sorted.length === 0 ? (
              <div className="rounded-2xl border border-[#E0DBE8] bg-white px-5 py-14 text-center shadow-[0_2px_6px_rgba(42,40,48,0.06)]">
                <p className="font-serif text-[18px] text-[#2A2830]">아직 기록된 이야기가 없어요</p>
                <p className="mt-2 text-[13px] leading-[20px] text-[#7A767F]">기록하기에서 첫 이야기를 남겨보세요.</p>
              </div>
            ) : (
              sorted.map((t) => (
                <TranscriptCard key={t.id} transcript={t} onClick={() => setSelectedId(t.id)} />
              ))
            )}
          </section>
        </div>

        <BottomNav />
      </div>

      {selected && (
        <TranscriptDetail transcript={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  )
}
