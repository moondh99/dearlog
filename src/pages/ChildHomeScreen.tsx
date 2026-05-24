import { useMemo, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ChildBottomNav from '../components/ChildBottomNav'
import Button from '../components/Button'
import { useStore } from '../store'
import { fetchLocalProgress, fetchLocalInterviewRecords } from '../lib/local-server'

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토']

function todayLabel() {
  const d = new Date()
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`
}

export default function ChildHomeScreen() {
  const navigate = useNavigate()
  
  // Local auth state
  const auth = useStore((state) => state.auth)
  const userName = auth.guardianProfile?.name ?? auth.guardianProfile?.preferredName ?? ''

  // Local store family questions
  const familyQuestions = useStore((state) => state.familyQuestions.questions)

  // API progress & transcripts states
  const [serverProgress, setServerProgress] = useState<any>(null)
  const [transcripts, setTranscripts] = useState<any[]>([])

  // Fetch data from local server
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

  // Progress computations
  const totalQuestions = serverProgress?.totalRecords ?? 0
  const completedQuestions = serverProgress?.progress?.reduce((acc: number, item: any) => acc + item.count, 0) ?? 0
  
  // Calculate completion percentage: minimum count sum vs actual count sum
  const targetQuestions = serverProgress?.progress?.reduce((acc: number, item: any) => acc + (item.chapter?.minAnswerCount ?? 15), 0) ?? 90
  const progressPct = targetQuestions > 0 ? Math.min(100, Math.round((completedQuestions / targetQuestions) * 100)) : 0

  const recentTranscripts = useMemo(
    () => transcripts.slice(0, 3).map(t => ({
      id: t.id,
      chapterTitle: t.chapter?.title ?? '기억',
      recordedAt: new Date(t.recordedAt).toLocaleDateString('ko-KR'),
      questionText: t.question?.text ?? '자유 회상 대화',
    })),
    [transcripts]
  )

  const pendingChildQuestions = useMemo(
    () => familyQuestions.filter((q) => q.status === 'pending' || q.status === 'delivered').length,
    [familyQuestions]
  )

  const answeredChildQuestions = useMemo(
    () => familyQuestions.filter((q) => q.status === 'answered').length,
    [familyQuestions]
  )

  const chaptersInProgress = useMemo(
    () => serverProgress?.progress?.filter((item: any) => item.count > 0).length ?? 0,
    [serverProgress]
  )

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
              <p className="mt-0.5 text-[16px] text-[#7A6A5C]">부모님의 이야기를 함께 기록해요</p>
            </div>
            <button
              onClick={() => navigate('/settings')}
              className="mt-1 w-10 h-10 rounded-full bg-[#D9E0D2] flex items-center justify-center active:opacity-70"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="8" r="4" fill="#6B8F71" />
                <path
                  d="M4 20C4 16.134 7.582 13 12 13C16.418 13 20 16.134 20 20"
                  stroke="#6B8F71"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* New answers notification */}
        {recentTranscripts.length > 0 && (
          <div
            className="rounded-2xl p-4 mb-5 animate-fade-in"
            style={{ backgroundColor: '#D9E0D2', border: '1.5px solid #C7D1BE' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center"
                style={{ backgroundColor: '#6B8F71' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M18 8C18 6.4 17.37 4.87 16.24 3.76C15.13 2.63 13.6 2 12 2C10.4 2 8.87 2.63 7.76 3.76C6.63 4.87 6 6.4 6 8C6 15 3 17 3 17H21C21 17 18 15 18 8Z" fill="white" />
                  <path d="M13.73 21C13.55 21.3 13.3 21.55 13 21.73C12.7 21.9 12.35 22 12 22C11.65 22 11.3 21.9 11 21.73C10.7 21.55 10.45 21.3 10.27 21" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <span className="text-[14px] font-bold text-[#3E5E41]">새 답변 알림</span>
            </div>
            <p className="text-[14px] text-[#3E3128] mb-3">
              부모님이 최근 <strong>{recentTranscripts.length}개</strong>의 인터뷰에 답변하셨어요
            </p>
            <div className="flex flex-col gap-2">
              {recentTranscripts.map((t) => (
                <button
                  key={t.id}
                  onClick={() => navigate('/child/chapters')}
                  className="text-left bg-white/60 rounded-xl px-3 py-2 transition-opacity active:opacity-70"
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="text-[11px] font-medium text-[#6B8F71]">{t.chapterTitle}</span>
                    <span className="text-[11px] text-[#7A6A5C]">{t.recordedAt}</span>
                  </div>
                  <p className="text-[13px] text-[#3E3128] line-clamp-1">{t.questionText}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => navigate('/child/chapters')}
              className="mt-3 text-[13px] font-medium text-[#6B8F71] hover:underline"
            >
              검수 화면에서 전체 보기 →
            </button>
          </div>
        )}

        {/* Progress summary */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <h2 className="text-[16px] font-bold text-[#3E3128] mb-3">자서전 진행 현황</h2>
          <div className="flex gap-4 mb-4">
            {[
              { label: '전체 완료', value: `${progressPct}%`, color: '#C8956C' },
              { label: '진행 중 챕터', value: `${chaptersInProgress}개`, color: '#8B5E3C' },
              { label: '답변 완료', value: `${completedQuestions}개`, color: '#6B8F71' },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex-1 text-center">
                <p className="text-[20px] font-bold" style={{ color }}>{value}</p>
                <p className="text-[11px] text-[#7A6A5C] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
          <div className="w-full h-2.5 rounded-full bg-[#F4DDD0] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%`, backgroundColor: '#C8956C' }}
            />
          </div>
          <button
            onClick={() => navigate('/child/progress')}
            className="mt-3 text-[13px] text-[#C8956C] hover:underline"
          >
            상세 진척도 보기 →
          </button>
        </div>

        {/* My questions summary */}
        <div
          className="rounded-2xl p-5 mb-5"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[#3E3128]">등록한 질문</h2>
            {pendingChildQuestions > 0 && (
              <span
                className="text-[11px] font-medium px-2.5 py-1 rounded-full text-white animate-pulse"
                style={{ backgroundColor: '#C8956C' }}
              >
                {pendingChildQuestions}개 대기 중
              </span>
            )}
          </div>
          <div className="flex gap-3 mb-4">
            <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: '#F4DDD0' }}>
              <p className="text-[18px] font-bold text-[#C8956C]">{pendingChildQuestions}</p>
              <p className="text-[11px] text-[#7A6A5C] mt-0.5">대기 중</p>
            </div>
            <div className="flex-1 rounded-xl p-3 text-center" style={{ backgroundColor: '#D9E0D2' }}>
              <p className="text-[18px] font-bold text-[#6B8F71]">{answeredChildQuestions}</p>
              <p className="text-[11px] text-[#7A6A5C] mt-0.5">답변 완료</p>
            </div>
          </div>
          <Button fullWidth variant="secondary" onClick={() => navigate('/child/questions')}>
            질문 등록하기
          </Button>
        </div>
      </div>

      <ChildBottomNav />
    </div>
  )
}
