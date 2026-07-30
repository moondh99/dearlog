import { useEffect, useMemo, useState } from 'react'
import { CalendarDays, Camera, ChevronRight, FileText, MessageCircle, Phone, type LucideIcon } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useCalendarStore } from '../store/calendarStore'
import { useInterviewStore } from '../store/interviewStore'
import parentHomeMascot from '../assets/figma/parent-home-mascot.png'
import type { CalendarEvent } from '../types/agents'

type ParentActionCardProps = {
  title: string
  description: string
  Icon: LucideIcon
  onClick: () => void
  tall?: boolean
}

function ParentActionCard({ title, description, Icon, onClick, tall = false }: ParentActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-[14px] border border-[#E0DBE8] bg-white p-[17px] text-left transition active:scale-[0.99] ${
        tall ? 'min-h-[93px]' : 'min-h-[78px]'
      }`}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-[#EDE8F0] text-[#7A767F]">
        <Icon className="h-6 w-6" aria-hidden="true" />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-bold leading-[21px] text-[#2A2830]">{title}</span>
        <span className="mt-0.5 block text-[12px] font-medium leading-[18px] text-[#7A767F]">
          {description}
        </span>
      </span>
    </button>
  )
}

type DashboardActionCardProps = {
  title: string
  description: string
  Icon: LucideIcon
  onClick: () => void
  count?: number
}

function DashboardActionCard({ title, description, Icon, onClick, count }: DashboardActionCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[105px] w-full items-center gap-4 rounded-2xl border border-[#E0DBE8] bg-white p-[21px] text-left shadow-[0_2px_6px_rgba(42,40,48,0.06)] transition active:scale-[0.99]"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#EDE8F0] text-[#9485BE]">
        <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block whitespace-nowrap text-[16px] font-bold leading-6 text-[#2A2830]">{title}</span>
        <span className="mt-0.5 block text-[13px] font-medium leading-[18px] text-[#7A767F]">
          {description}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-2 text-[#7A767F]">
        {count ? (
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#9485BE] px-1.5 text-[10px] font-bold leading-[15px] text-white">
            {count}
          </span>
        ) : null}
        <ChevronRight className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
    </button>
  )
}

type CalendarSummary = {
  title: string
  description: string
  badge: string
}

function parseCalendarDate(date: string) {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day)
}

function formatRelativeCalendarDate(date: string, base = new Date()) {
  const eventDate = parseCalendarDate(date)
  const baseDate = new Date(base.getFullYear(), base.getMonth(), base.getDate())
  const diffDays = Math.round((eventDate.getTime() - baseDate.getTime()) / 86_400_000)

  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '내일'
  if (diffDays > 1 && diffDays < 7) return `${diffDays}일 후`
  return `${eventDate.getMonth() + 1}월 ${eventDate.getDate()}일`
}

function buildCalendarSummary(events: CalendarEvent[]): CalendarSummary {
  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const nextEvent = events
    .filter((event) => parseCalendarDate(event.eventDate).getTime() >= todayStart)
    .sort((a, b) => parseCalendarDate(a.eventDate).getTime() - parseCalendarDate(b.eventDate).getTime())[0]

  if (!nextEvent) {
    return {
      title: '인터뷰 캘린더',
      description: '가족 일정을 추가하고 알림을 받아보세요',
      badge: '일정 추가',
    }
  }

  const relativeDate = formatRelativeCalendarDate(nextEvent.eventDate, today)
  const personLabel = nextEvent.relatedPersons[0] ? `${nextEvent.relatedPersons[0]} 관련 일정` : '가족 일정'
  return {
    title: `${relativeDate} · ${nextEvent.eventType}`,
    description: `${personLabel}을 캘린더에서 확인해보세요`,
    badge: '다음 일정',
  }
}

function CalendarSummaryCard({
  summary,
  onClick,
}: {
  summary: CalendarSummary
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[64px] w-full items-center gap-3 rounded-[14px] border border-[#DCD5E5] bg-[#F3EFF8] px-4 text-left shadow-[0_2px_10px_rgba(42,40,48,0.06)] transition active:scale-[0.99]"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[12px] bg-white text-[#9485BE]">
        <CalendarDays className="h-[21px] w-[21px]" aria-hidden="true" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[11px] font-bold leading-[16px] text-[#9485BE]">{summary.badge}</span>
        <span className="block truncate text-[14px] font-bold leading-[20px] text-[#2A2830]">{summary.title}</span>
        <span className="block truncate text-[11px] font-medium leading-[16px] text-[#7A767F]">
          {summary.description}
        </span>
      </span>
      <ChevronRight className="h-[17px] w-[17px] shrink-0 text-[#7A767F]" aria-hidden="true" />
    </button>
  )
}

function formatKoreanDate(date = new Date()) {
  const weekday = new Intl.DateTimeFormat('ko-KR', { weekday: 'long' }).format(date)
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 ${weekday}`
}

type ParentLandingViewProps = {
  initial: string
  calendarSummary: CalendarSummary
  nextQuestionTitle: string | null
  onStart: () => void
  onProfile: () => void
  onCalendar: () => void
  onPhotoInterview: () => void
  onQuestionInterview: () => void
  onPhoneInterview: () => void
}

function ParentLandingView({
  initial,
  calendarSummary,
  nextQuestionTitle,
  onStart,
  onProfile,
  onCalendar,
  onPhotoInterview,
  onQuestionInterview,
  onPhoneInterview,
}: ParentLandingViewProps) {
  return (
    <main className="relative min-h-[807.5px] flex-1 px-6">
      <div className="absolute left-[151px] top-[38px] w-[78px] text-[5.5px] font-medium uppercase leading-[7.5px] tracking-[1.75px] text-[#2A2830]">
        FAMILY ARCHIVE
      </div>
      <h1 className="absolute left-1/2 top-[45px] -translate-x-1/2 font-serif text-[27px] font-semibold leading-[31px] text-[#183025]">
        Dearlog
      </h1>

      <button
        type="button"
        onClick={onProfile}
        className="absolute left-[164px] top-[116.5px] flex h-[53px] w-[53px] items-center justify-center rounded-full bg-[#4E5B73] text-[18.55px] font-medium leading-[27.825px] text-white transition active:scale-95"
        aria-label="마이페이지로 이동"
      >
        {initial}
      </button>

      <section className="absolute left-6 top-[196px] w-[340px]">
        <h2 className="font-serif text-[30px] font-normal leading-[39px] text-[#2A2830]">
          가족이 이야기를
          <br />
          기다리고 있어요
        </h2>
        <p className="mt-4 text-[13px] font-normal leading-[23.4px] text-[#7A767F]">
          편하게 말씀만 해주세요.
          <br />
          정리와 확인은 가족이 도와드립니다.
        </p>
      </section>

      <section className="absolute left-6 top-[347.5px] flex w-[340px] flex-col gap-2.5">
        <CalendarSummaryCard summary={calendarSummary} onClick={onCalendar} />
        <ParentActionCard
          title="사진 보고 이야기하기"
          description="가족이 올린 사진을 보며 기억을 떠올려 보세요"
          Icon={Camera}
          onClick={onPhotoInterview}
          tall
        />
        <ParentActionCard
          title="질문에 답하기"
          description={nextQuestionTitle ? `${nextQuestionTitle} 질문에 답해보세요` : '가족이 준비한 질문에 답해보세요'}
          Icon={MessageCircle}
          onClick={onQuestionInterview}
        />
        <ParentActionCard
          title="전화로 이야기하기"
          description="전화를 연결해 이야기를 나눠보세요"
          Icon={Phone}
          onClick={onPhoneInterview}
        />
      </section>

      <button
        type="button"
        onClick={onStart}
        className="absolute left-6 top-[716.5px] flex h-[51px] w-[340px] items-center justify-center rounded-[14px] bg-[#2A2830] text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99]"
      >
        지금 시작하기
      </button>
    </main>
  )
}

type ParentDashboardViewProps = {
  userName: string
  initial: string
  calendarSummary: CalendarSummary
  questionCount: number
  storyCount: number
  onProfile: () => void
  onCalendar: () => void
  onInterview: () => void
  onPhoneInterview: () => void
  onTranscript: () => void
}

function ParentDashboardView({
  userName,
  initial,
  calendarSummary,
  questionCount,
  storyCount,
  onProfile,
  onCalendar,
  onInterview,
  onPhoneInterview,
  onTranscript,
}: ParentDashboardViewProps) {
  const displayName = userName.trim() || '김영자'
  const hasQuestions = questionCount > 0

  return (
    <>
      <header className="relative h-[132px] shrink-0">
        <div className="absolute left-6 top-[21px]">
          <p className="text-[4px] font-medium uppercase leading-[6px] tracking-[1.25px] text-[#2A2830]">
            FAMILY ARCHIVE
          </p>
          <p className="font-serif text-[18px] font-semibold leading-[22px] text-[#183025]">Dearlog</p>
        </div>
        <button
          type="button"
          onClick={onProfile}
          className="absolute right-6 top-[11.5px] flex h-[37px] w-[37px] items-center justify-center rounded-full bg-[#4E5B73] text-[14px] font-medium leading-[21px] text-white transition active:scale-95"
          aria-label="마이페이지로 이동"
        >
          {initial}
        </button>
        <div className="absolute left-[30px] top-[60.5px]">
          <h1 className="font-serif text-[21px] font-medium leading-[31.5px] text-[#2F3136]">
            안녕하세요, {displayName}님
          </h1>
          <p className="text-[12px] font-normal leading-[18px] text-[#B0B4BC]">{formatKoreanDate()}</p>
        </div>
        <img
          src={parentHomeMascot}
          alt=""
          className="absolute right-6 top-[60.5px] h-[58px] w-[46px] object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.18)]"
        />
        <div className="absolute bottom-0 left-6 h-px w-[calc(100%-48px)] bg-[#E0DBE8]" />
      </header>

      <main className="flex flex-1 flex-col px-5 pb-28 pt-4">
        <h2 className="font-serif text-[28px] font-normal leading-[39.2px] text-[#2A2830]">
          오늘은 어떤 이야기를
          <br />
          남겨볼까요?
        </h2>

        <section className="mt-6 flex flex-col gap-3">
          <CalendarSummaryCard summary={calendarSummary} onClick={onCalendar} />
          <DashboardActionCard
            title="기록하기"
            description={hasQuestions ? `자녀가 준비한 질문이 ${questionCount}개 있어요` : '가족이 준비한 질문을 모두 확인했어요'}
            Icon={MessageCircle}
            count={hasQuestions ? questionCount : undefined}
            onClick={onInterview}
          />
          <DashboardActionCard
            title="전화로 이야기하기"
            description="오래된 사진을 보며 기억을 이야기해주세요"
            Icon={Camera}
            onClick={onPhoneInterview}
          />
          <DashboardActionCard
            title="내가 남긴 이야기 확인하기"
            description={`지금까지 ${storyCount}개의 이야기를 남겨주셨어요`}
            Icon={FileText}
            onClick={onTranscript}
          />
        </section>
      </main>
    </>
  )
}

export default function ParentHomeScreen() {
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  const { chapters, transcripts, fetchChaptersAndQuestions, fetchTranscripts } = useInterviewStore()
  const { events: calendarEvents, fetchEvents: fetchCalendarEvents } = useCalendarStore()
  const [view, setView] = useState<'landing' | 'dashboard'>('landing')

  useEffect(() => {
    void fetchChaptersAndQuestions()
    void fetchTranscripts()
    void fetchCalendarEvents()
  }, [fetchCalendarEvents, fetchChaptersAndQuestions, fetchTranscripts])

  const nextQuestion = useMemo(() => {
    for (const chapter of chapters) {
      const question = chapter.questions.find((item) => !item.completed)
      if (question) return { chapter, question }
    }
    return null
  }, [chapters])

  const questionCount = useMemo(() => {
    if (chapters.length === 0) return 12
    return chapters.reduce(
      (total, chapter) => total + chapter.questions.filter((question) => !question.completed).length,
      0,
    )
  }, [chapters])

  const initial = Array.from(userName.trim())[0] ?? '홍'
  const calendarSummary = useMemo(() => buildCalendarSummary(calendarEvents), [calendarEvents])
  const goToInterview = () => navigate('/parent/interview')
  const goToPhotoInterview = () => navigate('/parent/interview?filter=photo')
  const goToQuestionInterview = () => navigate('/parent/interview?filter=text')
  const goToPhoneInterview = () => navigate('/parent/interview?type=scheduled')
  const goToCalendar = () => navigate('/calendar')

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      {view === 'landing' ? (
        <ParentLandingView
          initial={initial}
          calendarSummary={calendarSummary}
          nextQuestionTitle={nextQuestion?.chapter.title ?? null}
          onStart={() => setView('dashboard')}
          onProfile={() => navigate('/parent/mypage')}
          onCalendar={goToCalendar}
          onPhotoInterview={goToPhotoInterview}
          onQuestionInterview={goToQuestionInterview}
          onPhoneInterview={goToPhoneInterview}
        />
      ) : (
        <ParentDashboardView
          userName={userName}
          initial={initial}
          calendarSummary={calendarSummary}
          questionCount={questionCount}
          storyCount={transcripts.length}
          onProfile={() => navigate('/parent/mypage')}
          onCalendar={goToCalendar}
          onInterview={goToInterview}
          onPhoneInterview={goToPhoneInterview}
          onTranscript={() => navigate('/parent/transcript')}
        />
      )}
    </div>
  )
}
