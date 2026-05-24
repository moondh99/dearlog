import { useMemo, useState } from 'react'
import BottomNav from '../components/BottomNav'
import { useStore } from '../store'

type ViewMode = 'original' | 'ai'

interface Transcript {
  id: string
  chapterTitle: string
  questionText: string
  originalText: string
  aiSummary: string
  recordedAt: string
}

function TranscriptDetail({
  transcript,
  onClose,
}: {
  transcript: Transcript
  onClose: () => void
}) {
  const [viewMode, setViewMode] = useState<ViewMode>('original')

  return (
    <div className="fixed inset-0 z-40 flex flex-col" style={{ backgroundColor: '#F8F3EA' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 pt-14 pb-4 flex-shrink-0">
        <button
          onClick={onClose}
          className="w-10 h-10 rounded-full flex items-center justify-center focus:outline-none"
          style={{ backgroundColor: '#E7DED2' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="#3E3128" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <div>
          <p className="text-[12px] text-[#7A6A5C]">{transcript.chapterTitle}</p>
          <p className="text-[16px] font-bold text-[#3E3128] line-clamp-1">{transcript.questionText}</p>
        </div>
      </div>

      {/* Tab toggle */}
      <div className="px-5 mb-4 flex-shrink-0">
        <div className="flex rounded-xl p-1" style={{ backgroundColor: '#E7DED2' }}>
          {(['original', 'ai'] as ViewMode[]).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className="flex-1 py-2.5 rounded-lg text-[14px] font-medium transition-all duration-200 focus:outline-none"
              style={{
                backgroundColor: viewMode === v ? '#FFFDF8' : 'transparent',
                color: viewMode === v ? '#8B5E3C' : '#7A6A5C',
                boxShadow: viewMode === v ? '0 1px 4px rgba(139,94,60,0.12)' : 'none',
              }}
            >
              {v === 'original' ? '원문 그대로' : 'AI 정리본'}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 pb-8">
        {viewMode === 'original' ? (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#F2D9B8' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 19V6L21 3V16M9 19C9 20.1 8.1 21 7 21C5.9 21 5 20.1 5 19C5 17.9 5.9 17 7 17C8.1 17 9 17.9 9 19ZM21 16C21 17.1 20.1 18 19 18C17.9 18 17 17.1 17 16C17 14.9 17.9 14 19 14C20.1 14 21 14.9 21 16Z" stroke="#8B5E3C" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] font-medium text-[#8B5E3C]">말씀하신 그대로 기록된 원문입니다</span>
            </div>
            <p className="text-[16px] text-[#3E3128] leading-relaxed whitespace-pre-wrap">
              {transcript.originalText || "녹음된 텍스트가 없습니다."}
            </p>
            <p className="mt-4 text-[12px] text-[#7A6A5C]">기록일: {transcript.recordedAt}</p>
          </div>
        ) : (
          <div className="rounded-2xl p-5" style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.07)' }}>
            <div className="flex items-center gap-2 mb-3">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M2 17L12 22L22 17" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
                <path d="M2 12L12 17L22 12" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
              <span className="text-[13px] font-medium text-[#8B5E3C]">AI가 구조화한 정리본입니다</span>
            </div>
            <p className="text-[16px] text-[#3E3128] leading-relaxed whitespace-pre-wrap">
              {transcript.aiSummary || "정리 진행 중입니다."}
            </p>
            <div className="mt-4 pt-3 border-t border-[#E7DED2]">
              <p className="text-[12px] text-[#7A6A5C]">
                원문은 변경되지 않으며, AI 정리본은 참고용입니다.
              </p>
            </div>
          </div>
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
  return (
    <button
      onClick={onClick}
      className="w-full text-left rounded-2xl p-4 mb-3 transition-opacity active:opacity-70 focus:outline-none"
      style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 10px rgba(139,94,60,0.07)' }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-medium text-[#8B5E3C] bg-[#F2D9B8] px-2.5 py-0.5 rounded-full">
          {transcript.chapterTitle}
        </span>
        <span className="text-[11px] text-[#7A6A5C]">{transcript.recordedAt}</span>
      </div>
      <p className="text-[15px] font-medium text-[#3E3128] mb-2 line-clamp-2">
        {transcript.questionText}
      </p>
      <p className="text-[13px] text-[#7A6A5C] leading-relaxed line-clamp-2">
        {transcript.originalText}
      </p>
      <div className="flex items-center gap-1 mt-3">
        <span className="text-[12px] text-[#C8956C]">원문 · AI 정리 보기</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M9 18L15 12L9 6" stroke="#C8956C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </button>
  )
}

export default function ParentTranscriptScreen() {
  const memories = useStore((state) => state.memories)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const sortedTranscripts = useMemo(() => {
    return [...memories]
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((m) => ({
        id: m.id,
        chapterTitle: m.tags?.timePeriod || '기억 회상',
        questionText: m.topic || '기억 카드',
        originalText: m.originalTranscript,
        aiSummary: m.cleanedTranscript,
        recordedAt: new Date(m.date).toLocaleDateString('ko-KR'),
      })) as Transcript[]
  }, [memories])

  const selected = useMemo(
    () => sortedTranscripts.find((t) => t.id === selectedId) ?? null,
    [sortedTranscripts, selectedId]
  )

  return (
    <>
      <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
        <div className="flex-1 overflow-y-auto pb-24">
          {/* Header */}
          <div className="px-5 pt-14 pb-6">
            <h1 className="text-[22px] font-bold text-[#3E3128]">원문 기록</h1>
            <p className="mt-0.5 text-[16px] text-[#7A6A5C]">
              말씀하신 이야기를 그대로 보존합니다
            </p>
          </div>

          {/* Info banner */}
          <div className="mx-5 mb-5 rounded-xl px-4 py-3 flex items-start gap-3" style={{ backgroundColor: '#D9E0D2' }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
              <circle cx="12" cy="12" r="10" stroke="#6B8F71" strokeWidth="1.8" />
              <line x1="12" y1="8" x2="12" y2="12" stroke="#6B8F71" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="12" cy="16" r="1" fill="#6B8F71" />
            </svg>
            <p className="text-[13px] text-[#3E5E41] leading-relaxed">
              원문은 수정되지 않습니다. AI 정리본은 참고용이며, 출판 시 원문을 기준으로 가독성을 다듬습니다.
            </p>
          </div>

          {/* Transcript list */}
          <div className="px-5">
            {sortedTranscripts.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-[16px] text-[#7A6A5C]">아직 기록된 이야기가 없어요</p>
                <p className="text-[14px] text-[#7A6A5C] mt-1">인터뷰 탭에서 답변해 보세요</p>
              </div>
            ) : (
              sortedTranscripts.map((t) => (
                <TranscriptCard key={t.id} transcript={t} onClick={() => setSelectedId(t.id)} />
              ))
            )}
          </div>
        </div>

        <BottomNav />
      </div>

      {selected && (
        <TranscriptDetail transcript={selected} onClose={() => setSelectedId(null)} />
      )}
    </>
  )
}
