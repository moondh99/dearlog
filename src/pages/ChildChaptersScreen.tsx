import { useMemo, useState, useEffect } from 'react'
import ChildBottomNav from '../components/ChildBottomNav'
import { fetchLocalChapters, fetchLocalInterviewRecords } from '../lib/local-server'

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
      <div className="mt-3 rounded-xl px-3 py-2.5 flex items-center gap-2" style={{ backgroundColor: '#D9E0D2' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path d="M20 6L9 17L4 12" stroke="#6B8F71" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="text-[13px] text-[#3E5E41] font-medium">제안이 전송되었습니다</p>
      </div>
    )
  }

  return (
    <div className="mt-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="더 자연스러운 표현이나 추가하고 싶은 내용을 입력하세요..."
        rows={2}
        className="w-full rounded-xl px-3 py-2.5 text-[14px] text-[#3E3128] resize-none outline-none leading-relaxed"
        style={{ backgroundColor: '#F8F3EA', border: '1.5px solid #E7DED2' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = '#C8956C')}
        onBlur={(e) => (e.currentTarget.style.borderColor = '#E7DED2')}
      />
      <button
        onClick={() => value.trim() && onSend(transcriptId, value.trim())}
        disabled={!value.trim()}
        className="mt-2 w-full min-h-[40px] rounded-xl text-[14px] font-medium disabled:opacity-40 transition-opacity"
        style={{ backgroundColor: '#C8956C', color: 'white' }}
      >
        제안 보내기
      </button>
    </div>
  )
}

function AnswerCard({ transcript }: { transcript: any }) {
  const [showSuggestion, setShowSuggestion] = useState(false)
  const [sentSuggestions, setSentSuggestions] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'original' | 'ai'>('original')

  const handleSend = (id: string) => {
    setSentSuggestions((prev) => new Set([...prev, id]))
    setShowSuggestion(false)
  }

  const questionText = transcript.question?.text ?? '자유 회상 대화'
  const originalText = transcript.transcriptText
  const aiSummary = transcript.transcriptText
  const recordedAt = new Date(transcript.recordedAt).toLocaleDateString('ko-KR')

  return (
    <div className="rounded-2xl overflow-hidden mb-3" style={{ backgroundColor: '#FFFDF8', boxShadow: '0 1px 8px rgba(139,94,60,0.06)' }}>
      <div className="px-4 pt-4 pb-2">
        <p className="text-[14px] font-medium text-[#3E3128] leading-relaxed mb-3">
          {questionText}
        </p>

        {/* Mini tab */}
        <div className="flex rounded-lg p-0.5 mb-3" style={{ backgroundColor: '#E7DED2' }}>
          {(['original', 'ai'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              className="flex-1 py-1.5 rounded-md text-[12px] font-medium transition-all"
              style={{
                backgroundColor: viewMode === v ? '#FFFDF8' : 'transparent',
                color: viewMode === v ? '#8B5E3C' : '#7A6A5C',
              }}
            >
              {v === 'original' ? '원문' : 'AI 정리'}
            </button>
          ))}
        </div>

        <p className="text-[14px] text-[#3E3128] leading-relaxed line-clamp-3"
          style={{ backgroundColor: viewMode === 'original' ? '#F2D9B8' : '#F8F3EA', borderRadius: 10, padding: '10px 12px' }}>
          {viewMode === 'original' ? originalText : aiSummary}
        </p>
        <p className="text-[11px] text-[#7A6A5C] mt-1.5">{recordedAt}</p>
      </div>

      {/* Actions */}
      <div className="flex border-t border-[#E7DED2]">
        <button
          onClick={() => setShowSuggestion((v) => !v)}
          className="flex-1 py-3 text-[13px] font-medium text-[#C8956C] transition-opacity active:opacity-60"
        >
          수정 제안
        </button>
        <div className="w-px bg-[#E7DED2]" />
        <button
          className="flex-1 py-3 text-[13px] font-medium text-[#7A6A5C] transition-opacity active:opacity-60"
        >
          사진 첨부 (준비 중)
        </button>
      </div>

      {showSuggestion && (
        <div className="px-4 pb-4">
          <SuggestionForm
            transcriptId={transcript.id}
            onSend={handleSend}
            sent={sentSuggestions.has(transcript.id)}
          />
        </div>
      )}
    </div>
  )
}

function ChapterSection({
  chapter,
  transcripts,
}: {
  chapter: any
  transcripts: any[]
}) {
  const [expanded, setExpanded] = useState(false)
  
  const chapterTranscripts = useMemo(
    () => transcripts.filter((t) => t.chapterId === chapter.id),
    [transcripts, chapter.id]
  )

  const completed = chapterTranscripts.length
  const total = chapter.minAnswerCount ?? 15
  const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0

  return (
    <div className="mb-4">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full rounded-2xl px-5 py-4 text-left transition-opacity active:opacity-70"
        style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 10px rgba(139,94,60,0.07)' }}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold text-[#3E3128]">{chapter.title}</span>
            {completed > 0 && (
              <span className="text-[11px] font-medium text-[#6B8F71] bg-[#D9E0D2] px-2 py-0.5 rounded-full">
                {completed}개 답변
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[13px] text-[#C8956C] font-medium">{pct}%</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s' }}
            >
              <path d="M6 9L12 15L18 9" stroke="#7A6A5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>
        <div className="w-full h-2 rounded-full bg-[#F4DDD0] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: '#C8956C', transition: 'width 0.5s' }} />
        </div>
        <p className="text-[12px] text-[#7A6A5C] mt-1.5">{chapter.title} 챕터 기록 · {completed}/{total} 완료</p>
      </button>

      {expanded && (
        <div className="mt-2 pl-2">
          {chapterTranscripts.length === 0 ? (
            <div className="rounded-2xl px-4 py-6 text-center" style={{ backgroundColor: '#F4DDD0' }}>
              <p className="text-[14px] text-[#7A6A5C]">아직 답변된 질문이 없어요</p>
              <p className="text-[13px] text-[#7A6A5C] mt-1">부모님이 인터뷰에 답변하시면 여기에 표시됩니다</p>
            </div>
          ) : (
            chapterTranscripts.map((t) => <AnswerCard key={t.id} transcript={t} />)
          )}
        </div>
      )}
    </div>
  )
}

export default function ChildChaptersScreen() {
  const [chapters, setChapters] = useState<any[]>([])
  const [transcripts, setTranscripts] = useState<any[]>([])

  useEffect(() => {
    async function loadData() {
      try {
        const chaptersRes = await fetchLocalChapters()
        setChapters(chaptersRes.chapters || [])
        const recordsRes = await fetchLocalInterviewRecords()
        setTranscripts(recordsRes.records || [])
      } catch (e) {
        console.error("ChildChapters loadData error:", e)
      }
    }
    loadData()
  }, [])

  const totalAnswered = transcripts.length

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-[22px] font-bold text-[#3E3128]">챕터 확인</h1>
          <p className="mt-0.5 text-[16px] text-[#7A6A5C]">부모님의 답변을 챕터별로 확인하세요</p>
        </div>

        {/* Summary */}
        <div
          className="mx-5 mb-5 rounded-2xl px-5 py-4 flex items-center gap-4"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: '#F2D9B8' }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M4 19.5C4 18.1 5.1 17 6.5 17H20" stroke="#8B5E3C" strokeWidth="1.8" strokeLinecap="round" />
              <path d="M6.5 2H20V22H6.5C5.1 22 4 20.9 4 19.5V4.5C4 3.1 5.1 2 6.5 2Z" fill="#F2D9B8" stroke="#8B5E3C" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
          </div>
          <div>
            <p className="text-[15px] font-bold text-[#3E3128]">
              총 <span style={{ color: '#C8956C' }}>{totalAnswered}개</span> 이야기 기록됨
            </p>
            <p className="text-[13px] text-[#7A6A5C] mt-0.5">
              챕터를 탭해서 답변을 확인하고 수정을 제안하세요
            </p>
          </div>
        </div>

        {/* Chapters */}
        <div className="px-5">
          {chapters.map((ch) => (
            <ChapterSection key={ch.id} chapter={ch} transcripts={transcripts} />
          ))}
        </div>
      </div>

      <ChildBottomNav />
    </div>
  )
}
