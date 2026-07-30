import { useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { ActiveSeniorContextBar, MissingSeniorState } from '../components/ActiveSeniorContextBar'
import ChildBottomNav from '../components/ChildBottomNav'
import { useActiveSeniorContext } from '../hooks/useActiveSeniorContext'
import { useInterviewStore } from '../store/interviewStore'
import { useChildStore } from '../store/childStore'
import progressMascot from '../assets/figma/progress-family-mascot.png'
import completeMascot from '../assets/figma/progress-complete-mascot.png'
import bookIcon from '../assets/figma/progress-book-icon.png'
import moreIcon from '../assets/figma/progress-more-icon.png'

function BrandHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex items-center gap-3 px-6 pb-2 pt-5">
      <button
        type="button"
        onClick={onBack}
        className="-ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[#7A767F] transition active:bg-[#EDE8F0]"
        aria-label="자녀 홈으로 돌아가기"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>
      <div>
        <p className="text-[3.987px] font-medium uppercase leading-[5.436px] tracking-[1.2685px] text-[#2A2830]">
          FAMILY ARCHIVE
        </p>
        <p className="mt-0.5 font-serif text-[18px] font-semibold leading-[22px] text-[#2A2830]">
          Dearlog
        </p>
      </div>
    </header>
  )
}

function SummaryMetric({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex min-h-[64px] min-w-0 flex-1 flex-col items-center justify-center rounded-[14px] bg-white/70 px-2 py-2.5">
      <p className="font-serif text-[18px] font-semibold leading-[22px] text-[#2A2830]">{value}</p>
      <p className="mt-1 max-w-full truncate text-center text-[10.5px] leading-[16px] text-[#7A767F]">{label}</p>
    </div>
  )
}

function ActionCard({
  title,
  description,
  actionLabel,
  image,
  highlighted = false,
  onClick,
}: {
  title: string
  description: string
  actionLabel: string
  image: string
  highlighted?: boolean
  onClick: () => void
}) {
  return (
    <section
      className={`rounded-[16px] border-[1.5px] px-4 py-3.5 ${
        highlighted
          ? 'border-[#DDD7EF] bg-[#F0EDF7]'
          : 'border-[#DDD7EF] bg-white'
      }`}
    >
      <div className="flex gap-3">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[14px] bg-[#E0DBE8]">
          <img src={image} alt="" className="h-10 w-10 object-contain" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h2 className="font-serif text-[15px] font-medium leading-5 text-black">{title}</h2>
          <p className="mt-1 text-[12px] font-normal leading-[20.4px] text-[#2A2830]/80">
            {description}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        className="mt-3 flex min-h-10 w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99]"
      >
        {actionLabel}
      </button>
    </section>
  )
}

export default function ChildProgressScreen() {
  const navigate = useNavigate()
  const {
    activeSenior,
    activeSeniorId,
    loading: seniorLoading,
    seniors,
    setActiveSeniorId,
  } = useActiveSeniorContext()
  const {
    chapters,
    transcripts,
    fetchChaptersAndQuestions,
    fetchTranscripts,
  } = useInterviewStore()
  const {
    questions,
    photos,
    fetchQuestions,
    fetchPhotos,
  } = useChildStore()

  useEffect(() => {
    if (!activeSeniorId) return
    void fetchChaptersAndQuestions()
    void fetchTranscripts()
    void fetchQuestions()
    void fetchPhotos()
  }, [activeSeniorId, fetchChaptersAndQuestions, fetchPhotos, fetchQuestions, fetchTranscripts])

  const chapterStats = useMemo(() => {
    let total = 0
    let completed = 0
    let activeChapters = 0

    for (const chapter of chapters) {
      const chapterCompleted = chapter.questions.filter((question) => question.completed).length
      total += chapter.questions.length
      completed += chapterCompleted
      if (chapterCompleted > 0) activeChapters += 1
    }

    return { total, completed, activeChapters }
  }, [chapters])

  const questionStats = useMemo(() => {
    const answeredQuestions = questions.filter((question) => question.status === 'answered').length
    const answered = Math.max(answeredQuestions, transcripts.length)
    const pending = questions.filter((question) => question.status === 'pending').length
    return { answered, answeredQuestions, pending, total: questions.length }
  }, [questions, transcripts.length])

  const progressPct = useMemo(() => {
    if (chapterStats.total > 0) {
      return Math.min(100, Math.round((chapterStats.completed / chapterStats.total) * 100))
    }
    if (questionStats.total > 0) {
      return Math.min(100, Math.round((questionStats.answeredQuestions / questionStats.total) * 100))
    }
    return 0
  }, [chapterStats, questionStats])

  const recordedStories = transcripts.length || chapterStats.completed || questionStats.answered
  const episodes = Math.max(
    chapterStats.activeChapters,
    chapters.filter((chapter) => transcripts.some((transcript) => transcript.chapterId === chapter.id)).length,
  )
  const isComplete = progressPct >= 100 && (chapterStats.total > 0 || questionStats.total > 0)
  const ownerLabel = activeSenior?.displayName || '부모님'
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
        <BrandHeader onBack={() => navigate('/child')} />
        <MissingSeniorState onCreate={() => navigate('/child/record-space/new')} />
        <ChildBottomNav />
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <BrandHeader onBack={() => navigate('/child')} />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-[112px] pt-3">
        <div className="mb-5">{contextBar}</div>

        <section>
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            기록집
          </p>
          <h1 className="mt-2 font-serif text-[26px] font-normal leading-[33px] text-[#2A2830]">
            {isComplete ? '기록공간이 완성되었어요' : '기록공간이 진행중이에요'}
          </h1>
          <p className="mt-2 text-[12px] font-normal leading-[18px] text-[#7A767F]">
            {isComplete
              ? '차곡차곡 모인 부모님의 이야기가 이제 한 권의 기록집이 될 준비를 마쳤어요.'
              : '차곡차곡 부모님의 이야기가 모아지고 있어요.'}
          </p>
        </section>

        <section className={isComplete ? 'mt-4' : 'mt-3'}>
          <img
            src={isComplete ? completeMascot : progressMascot}
            alt=""
            className={isComplete
              ? 'mx-auto h-[132px] w-[189px] rounded-[21px] object-cover'
              : 'mx-auto h-[220px] w-[260px] object-contain drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)]'}
          />
        </section>

        <section className={isComplete ? 'mt-5' : 'mt-5'}>
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-normal leading-[16.5px] tracking-[0.88px] text-[#2A2830]">
              기록공간 진척도
            </p>
            <p className="font-serif text-[13px] font-bold leading-[19.5px] text-[#2A2830]">
              {progressPct}%
            </p>
          </div>
          <div className="mt-2 h-[6px] overflow-hidden rounded-full bg-[#EDE8F0]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[#2A2830] to-[#7A767F] transition-[width]"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </section>

        <div className="mt-6 h-px bg-[#E0DBE8]" />

        {isComplete ? (
          <div className="mt-5 space-y-5">
            <ActionCard
              title="기록집 제작하기"
              description={`완성된 기록을 바탕으로 ${ownerLabel}의 삶을 한 권의 책으로 엮어보세요.`}
              actionLabel="제작하기"
              image={bookIcon}
              highlighted
              onClick={() => navigate('/child/autobiography', { state: { seniorId: activeSeniorId } })}
            />
            <ActionCard
              title="더 만들기"
              description="아직 남기고 싶은 이야기가 있다면 질문과 에피소드를 더 추가해보세요."
              actionLabel="기록 더 하기"
              image={moreIcon}
              onClick={() => navigate('/child/questions', { state: { seniorId: activeSeniorId } })}
            />
          </div>
        ) : (
          <>
            <section className="mt-5 rounded-[16px] border border-[#DDD7EF] bg-[#F0EDF7] px-[17px] py-[18px]">
              <div className="flex gap-3">
                <SummaryMetric value={recordedStories} label="기록된 이야기" />
                <SummaryMetric value={episodes} label="에피소드" />
                <SummaryMetric value={photos.length} label="사진" />
              </div>
            </section>

            <section className="mt-4 rounded-[16px] border border-[#E0DBE8] bg-white/55 px-4 py-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-medium leading-[18px] text-[#2A2830]">질문 현황</p>
                <p className="text-[11px] leading-[16.5px] text-[#7A767F]">
                  답변 {questionStats.answered}개 · 대기 {questionStats.pending}개
                </p>
              </div>
            </section>

            {recordedStories > 0 ? (
              <div className="mt-5">
                <ActionCard
                  title="지금까지로 기록집 미리 만들기"
                  description={`아직 진행 중이지만, 지금까지 모은 답변으로 ${ownerLabel}의 자서전 초안을 미리 엮어볼 수 있어요.`}
                  actionLabel="미리 제작하기"
                  image={bookIcon}
                  highlighted
                  onClick={() => navigate('/child/autobiography', { state: { seniorId: activeSeniorId } })}
                />
              </div>
            ) : null}
          </>
        )}
      </main>

      <ChildBottomNav />
    </div>
  )
}
