import { useMemo, useState, useEffect } from 'react'
import BottomNav from '../components/BottomNav'
import { fetchLocalChapters, fetchLocalQuestions } from '../lib/local-server'

const AUTOBIOGRAPHY_THRESHOLD = 0.8

interface Question {
  id: string
  text: string
  completed: boolean
  answeredAt: string | null
}

interface Chapter {
  id: string
  title: string
  slug: string
  questions: Question[]
}

function ChapterCard({ chapter }: { chapter: Chapter }) {
  const [expanded, setExpanded] = useState(false)
  const total = chapter.questions.length
  const completed = chapter.questions.filter((q) => q.completed).length
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0
  const canGenerate = total > 0 && completed / total >= AUTOBIOGRAPHY_THRESHOLD

  return (
    <div
      className="rounded-2xl overflow-hidden mb-3"
      style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.07)' }}
    >
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full text-left px-5 py-4 focus:outline-none"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-[16px] font-bold text-[#3E3128]">{chapter.title}</span>
            {canGenerate && (
              <span className="text-[11px] font-medium text-[#6B8F71] bg-[#D9E0D2] px-2 py-0.5 rounded-full">
                생성 가능
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-medium text-[#C8956C]">{pct}%</span>
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              className="transition-transform duration-200"
              style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              <path d="M6 9L12 15L18 9" stroke="#7A6A5C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 rounded-full bg-[#F4DDD0] overflow-hidden mb-2">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${pct}%`,
              backgroundColor: canGenerate ? '#6B8F71' : '#C8956C',
            }}
          />
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[13px] text-[#7A6A5C]">이야기 기록 범위</p>
          <p className="text-[13px] text-[#7A6A5C]">
            {completed}/{total} 완료
          </p>
        </div>
      </button>

      {/* Question list (expanded) */}
      {expanded && (
        <div className="border-t border-[#E7DED2] px-5 py-3 bg-[#FCF9F2]">
          <div className="flex flex-col gap-2">
            {chapter.questions.length > 0 ? (
              chapter.questions.map((q) => (
                <div key={q.id} className="flex items-start gap-3 py-1 animate-fade-in">
                  <div
                    className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: q.completed ? '#6B8F71' : '#E7DED2' }}
                  >
                    {q.completed && (
                      <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <div className="flex-1">
                    <p
                      className="text-[14px] leading-snug"
                      style={{ color: q.completed ? '#7A6A5C' : '#3E3128' }}
                    >
                      {q.text}
                    </p>
                    {q.answeredAt && (
                      <p className="text-[11px] text-[#7A6A5C] mt-0.5">{q.answeredAt} 완료</p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <p className="text-[13px] text-[#7A6A5C] py-2 text-center">등록된 질문이 없습니다.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ParentProgressScreen() {
  const [chapters, setChapters] = useState<any[]>([])
  const [questions, setQuestions] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      try {
        const chRes = await fetchLocalChapters()
        const qRes = await fetchLocalQuestions()
        setChapters(chRes.chapters || [])
        setQuestions(qRes.questions || [])
      } catch (e) {
        console.error(e)
      }
    }
    load()
  }, [])

  const groupedChapters = useMemo(() => {
    return chapters.map((ch) => {
      const chQuestions = questions
        .filter((q) => q.chapterId === ch.id)
        .map((q) => ({
          id: q.id,
          text: q.text,
          completed: !!q.answeredAt,
          answeredAt: q.answeredAt ? new Date(q.answeredAt).toLocaleDateString('ko-KR') : null,
        }))
      return {
        id: ch.id,
        title: ch.title,
        slug: ch.slug,
        questions: chQuestions,
      } as Chapter
    })
  }, [chapters, questions])

  const { totalQuestions, completedQuestions } = useMemo(() => {
    let total = 0
    let completed = 0
    for (const ch of groupedChapters) {
      total += ch.questions.length
      completed += ch.questions.filter((q) => q.completed).length
    }
    return { totalQuestions: total, completedQuestions: completed }
  }, [groupedChapters])

  const overallPct = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0

  const circumference = 2 * Math.PI * 44
  const strokeDashoffset = circumference * (1 - overallPct / 100)

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="px-5 pt-14 pb-6">
          <h1 className="text-[22px] font-bold text-[#3E3128]">진척도</h1>
          <p className="mt-0.5 text-[16px] text-[#7A6A5C]">챕터별 완료 현황을 확인하세요</p>
        </div>

        {/* Overall circle progress */}
        <div
          className="mx-5 rounded-2xl p-6 mb-6 flex items-center gap-6"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <div className="relative w-24 h-24 flex-shrink-0">
            <svg width="96" height="96" viewBox="0 0 96 96">
              <circle cx="48" cy="48" r="44" fill="none" stroke="#F4DDD0" strokeWidth="8" />
              <circle
                cx="48"
                cy="48"
                r="44"
                fill="none"
                stroke="#C8956C"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                transform="rotate(-90 48 48)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[20px] font-bold text-[#3E3128]">{overallPct}%</span>
            </div>
          </div>
          <div>
            <p className="text-[16px] font-bold text-[#3E3128] mb-1">전체 진척도</p>
            <p className="text-[14px] text-[#7A6A5C] mb-3">
              {completedQuestions}/{totalQuestions}개 완료
            </p>
            <p className="text-[13px] text-[#7A6A5C] leading-relaxed">
              80% 이상 완료 시{'\n'}챕터 자서전 생성이 가능해요
            </p>
          </div>
        </div>

        {/* Chapter list */}
        <div className="px-5">
          <h2 className="text-[16px] font-bold text-[#3E3128] mb-3">챕터별 현황</h2>
          {groupedChapters.map((ch) => (
            <ChapterCard key={ch.id} chapter={ch} />
          ))}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
