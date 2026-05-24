import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '../components/BottomNav'
import Button from '../components/Button'
import { useStore } from '../store'
import { fetchLocalProgress, fetchLocalInterviewRecords } from '../lib/local-server'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']
const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

function todayLabel() {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

function formatScheduleTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':').map(Number)
  const period = h < 12 ? '오전' : '오후'
  const displayHour = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${period} ${displayHour}:${String(m).padStart(2, '0')}`
}

export default function ParentHomeScreen() {
  const navigate = useNavigate()
  
  // Auth state from local useStore
  const auth = useStore((state) => state.auth)
  const userName = auth.profile?.name ?? auth.profile?.preferredName ?? ''

  // Progress and Transcripts states loaded from server API
  const [serverProgress, setServerProgress] = useState<any>(null)
  const [transcripts, setTranscripts] = useState<any[]>([])

  // Load data
  useEffect(() => {
    async function loadData() {
      try {
        const prog = await fetchLocalProgress()
        setServerProgress(prog)
      } catch (e) {
        console.error("Progress fetch error:", e)
      }
      try {
        const recordsRes = await fetchLocalInterviewRecords()
        setTranscripts(recordsRes.records || [])
      } catch (e) {
        console.error("Records fetch error:", e)
      }
    }
    loadData()
  }, [])

  // Schedule settings in local state (or localStorage for persistence)
  const [scheduledTime, setScheduledTime] = useState(() => localStorage.getItem('dearlog-schedule-time') ?? '10:00')
  const [scheduledDays, setScheduledDays] = useState<number[]>(() => {
    try {
      const saved = localStorage.getItem('dearlog-schedule-days')
      return saved ? JSON.parse(saved) : [1, 3, 5] // Mon, Wed, Fri
    } catch {
      return [1, 3, 5]
    }
  })
  const [isEnabled, setEnabled] = useState(() => localStorage.getItem('dearlog-schedule-enabled') === 'true')

  useEffect(() => {
    localStorage.setItem('dearlog-schedule-time', scheduledTime)
  }, [scheduledTime])

  useEffect(() => {
    localStorage.setItem('dearlog-schedule-days', JSON.stringify(scheduledDays))
  }, [scheduledDays])

  useEffect(() => {
    localStorage.setItem('dearlog-schedule-enabled', String(isEnabled))
  }, [isEnabled])

  // Progress calculations
  const totalQuestions = serverProgress?.totalRecords ?? 0
  const completedQuestions = serverProgress?.progress?.reduce((acc: number, item: any) => acc + item.count, 0) ?? 0
  
  // Calculate completion percentage: minimum count sum vs actual count sum
  const targetQuestions = serverProgress?.progress?.reduce((acc: number, item: any) => acc + (item.chapter?.minAnswerCount ?? 15), 0) ?? 90
  const progressPct = targetQuestions > 0 ? Math.min(100, Math.round((completedQuestions / targetQuestions) * 100)) : 0

  // Fallback next question/chapter info
  const nextQuestion = useMemo(() => {
    if (!serverProgress?.progress) return null
    const incomplete = serverProgress.progress.find((item: any) => !item.complete)
    if (incomplete) {
      return {
        question: { text: `"${incomplete.chapter.title}" 챕터에 대한 어르신의 소중한 이야기를 들려주세요.` },
        chapter: { title: incomplete.chapter.title }
      }
    }
    return null
  }, [serverProgress])

  const recentTranscripts = useMemo(
    () => transcripts.slice(0, 3).map(t => ({
      id: t.id,
      chapterTitle: t.chapter?.title ?? '기억',
      recordedAt: new Date(t.recordedAt).toLocaleDateString('ko-KR'),
      questionText: t.question?.text ?? '자유 회상 대화',
      originalText: t.transcriptText
    })),
    [transcripts]
  )

  const resetForDemo = () => {
    alert("테스트 설정이 완료되었습니다. 1분 후 인터뷰 알림이 울립니다.")
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
      <div className="flex-1 overflow-y-auto pb-24 px-5">
        {/* Header */}
        <div className="pt-14 pb-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[14px] text-[#7A6A5C]">{todayLabel()}</p>
              <h1 className="mt-1 text-[22px] font-bold text-[#3E3128]">
                {userName ? `${userName}님, 안녕하세요` : '안녕하세요'}
              </h1>
              <p className="mt-0.5 text-[16px] text-[#7A6A5C]">오늘도 소중한 이야기를 들려주세요</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="mt-1 w-10 h-10 rounded-full bg-[#EBC7A6] flex items-center justify-center active:opacity-70"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill="#8B5E3C" />
                <path
                  d="M4 20C4 16.134 7.582 13 12 13C16.418 13 20 16.134 20 20"
                  stroke="#8B5E3C"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Today's interview card */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-medium text-[#C8956C] bg-[#F4DDD0] px-3 py-1 rounded-full">
              오늘의 인터뷰
            </span>
            {nextQuestion && (
              <span className="text-[12px] text-[#7A6A5C]">{nextQuestion.chapter.title}</span>
            )}
          </div>
          {nextQuestion ? (
            <>
              <p className="text-[17px] font-medium text-[#3E3128] leading-relaxed mb-5">
                {nextQuestion.question.text}
              </p>
              <Button fullWidth onClick={() => navigate('/parent/interview')}>
                답변하기
              </Button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-[17px] font-medium text-[#6B8F71]">모든 질문에 답변하셨어요!</p>
              <p className="mt-1 text-[14px] text-[#7A6A5C]">자서전 생성이 가능합니다</p>
            </div>
          )}
        </div>

        {/* Overall progress */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-[16px] font-bold text-[#3E3128]">전체 진척도</span>
            <span className="text-[16px] font-bold text-[#C8956C]">{progressPct}%</span>
          </div>
          <div className="w-full h-3 rounded-full bg-[#F4DDD0] overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: '#C8956C' }}
            />
          </div>
          <p className="text-[13px] text-[#7A6A5C]">
            전체 목표 답변 수 {targetQuestions}개 중 {completedQuestions}개 기록됨
          </p>
        </div>

        {/* Recent memories */}
        {recentTranscripts.length > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold text-[#3E3128]">최근 기억</h2>
              <button
                onClick={() => navigate('/parent/interview')}
                className="text-[13px] text-[#C8956C]"
              >
                전체 보기
              </button>
            </div>
            <div className="flex flex-col gap-3">
              {recentTranscripts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate('/parent/interview')}
                  className="text-left rounded-2xl p-4 transition-opacity active:opacity-70 animate-fade-in"
                  style={{ backgroundColor: '#F2D9B8' }}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[11px] font-medium text-[#8B5E3C] bg-[#EBC7A6] px-2 py-0.5 rounded-full">
                      {t.chapterTitle}
                    </span>
                    <span className="text-[11px] text-[#7A6A5C]">{t.recordedAt}</span>
                  </div>
                  <p className="text-[14px] font-medium text-[#3E3128] mb-1 line-clamp-1">
                    {t.questionText}
                  </p>
                  <p className="text-[13px] text-[#7A6A5C] leading-relaxed line-clamp-2">
                    {t.originalText}
                  </p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Schedule card */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[16px] font-bold text-[#3E3128]">인터뷰 시간 설정</h2>
            <button
              onClick={() => setEnabled(!isEnabled)}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 ${
                isEnabled ? 'bg-[#C8956C]' : 'bg-[#E7DED2]'
              }`}
            >
              <span
                className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform duration-200 ${
                  isEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`}
              />
            </button>
          </div>

          {isEnabled ? (
            <>
              {/* Time picker */}
              <div className="mb-4">
                <label className="text-[13px] text-[#7A6A5C] mb-1 block">시간</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full h-12 rounded-xl px-4 text-[17px] font-medium text-[#3E3128] border border-[#E7DED2] bg-[#F8F3EA] focus:outline-none focus:border-[#C8956C]"
                />
              </div>

              {/* Day toggles */}
              <div className="mb-4">
                <label className="text-[13px] text-[#7A6A5C] mb-2 block">반복 요일</label>
                <div className="flex gap-1.5 flex-wrap">
                  {WEEKDAY_LABELS.map((label, idx) => {
                    const active = scheduledDays.includes(idx)
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          if (active) {
                            if (scheduledDays.length > 1) {
                              setScheduledDays(scheduledDays.filter((d) => d !== idx))
                            }
                          } else {
                            setScheduledDays([...scheduledDays, idx].sort())
                          }
                        }}
                        className={`flex-1 min-w-[36px] h-9 rounded-lg text-[13px] font-medium transition-colors ${
                          active
                            ? 'bg-[#C8956C] text-white'
                            : 'bg-[#F4DDD0] text-[#7A6A5C]'
                        }`}
                      >
                        {label}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Next interview info */}
              <div className="rounded-xl bg-[#F8F3EA] px-4 py-3 mb-3">
                <p className="text-[13px] text-[#7A6A5C]">다음 인터뷰</p>
                <p className="text-[15px] font-medium text-[#3E3128] mt-0.5">
                  오늘 {formatScheduleTime(scheduledTime)}
                </p>
              </div>

              {/* Demo reset */}
              <button
                onClick={resetForDemo}
                className="w-full h-10 rounded-xl border border-[#E7DED2] text-[13px] text-[#7A6A5C] active:opacity-70"
              >
                1분 후 테스트
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <p className="text-[15px] text-[#7A6A5C] mb-3">인터뷰 시간을 설정해보세요</p>
              <button
                onClick={() => setEnabled(true)}
                className="h-10 px-6 rounded-xl bg-[#F4DDD0] text-[13px] font-medium text-[#8B5E3C] active:opacity-70"
              >
                시간 설정하기
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  )
}
