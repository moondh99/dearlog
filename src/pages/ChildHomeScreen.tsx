import { useMemo, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  BookOpen,
  ChevronRight,
  ClipboardCheck,
  ImagePlus,
  Layers,
  MessageCircle,
  PencilLine,
  Plus,
} from 'lucide-react'
import ChildBottomNav from '../components/ChildBottomNav'
import { useAuthStore } from '../store/authStore'
import { useInterviewStore } from '../store/interviewStore'
import { useChildStore } from '../store/childStore'
import { useCalendarStore } from '../store/calendarStore'
import { useConsentStore } from '../store/consentStore'
import { useDevModeStore } from '../store/devModeStore'
import {
  DEMO_SENIOR_ID,
  DEMO_SENIOR_NAME,
} from '../lib/demo/demo-seed-adapter'
import { toLocalDateStamp } from '../lib/date'
import childRecordSpace from '../assets/figma/child-record-space.png'
import childHomeMascot from '../assets/figma/child-home-mascot.png'

function fullDateLabel() {
  return new Date().toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  })
}

function dateStamp() {
  return toLocalDateStamp()
}

function firstLetter(name: string) {
  return name.trim().charAt(0) || '홍'
}

function formatCount(value: number) {
  if (value > 999) return '999+'
  return `${value}`
}

type QuickMenuItem = {
  title: string
  subtitle: string
  badge?: number
  Icon: typeof ClipboardCheck
  onClick: () => void
}

function QuickMenuButton({ item }: { item: QuickMenuItem }) {
  return (
    <button
      type="button"
      onClick={item.onClick}
      className="flex min-h-[64px] w-full items-center gap-3 border-b border-[#E0DBE8] py-3 text-left transition active:opacity-60"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-[#EDE8F0] text-[#4E5B73]">
        <item.Icon className="h-[18px] w-[18px]" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[14px] font-bold leading-[21px] text-[#2A2830]">{item.title}</span>
        <span className="block truncate text-[11px] font-medium leading-[16.5px] text-[#7A767F]">{item.subtitle}</span>
      </span>
      {item.badge ? (
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2A2830] px-1 text-[10px] font-bold leading-[15px] text-[#F7F5FB]">
          {formatCount(item.badge)}
        </span>
      ) : null}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#C2C5CC]" aria-hidden="true" />
    </button>
  )
}

export default function ChildHomeScreen() {
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  const { chapters, transcripts, fetchChaptersAndQuestions, fetchTranscripts } = useInterviewStore()
  const { questions, fetchQuestions, activeSeniorId, setActiveSeniorId, photos, fetchPhotos } = useChildStore()
  const { fetchEvents } = useCalendarStore()
  const { fetchConsents } = useConsentStore()
  const isOfflineDemo = useDevModeStore((state) => state.isOfflineDemo)

  const [seniors, setSeniors] = useState<Array<{
    id: string
    name: string
    relationship?: string | null
    recordSpaceName?: string | null
    recordSpaceCoverUrl?: string | null
  }>>([])
  const [recordSpaceNotice, setRecordSpaceNotice] = useState<string | null>(null)

  useEffect(() => {
    if (isOfflineDemo) {
      setSeniors([{
        id: DEMO_SENIOR_ID,
        name: DEMO_SENIOR_NAME,
        relationship: '어머니',
        recordSpaceName: `${DEMO_SENIOR_NAME}님의 기록 공간`,
      }])
      if (!useChildStore.getState().activeSeniorId) {
        setActiveSeniorId(DEMO_SENIOR_ID)
      }
      return
    }

    let active = true
    const loadSeniors = async () => {
      try {
        const { fetchFamilyMembers } = await import('../lib/local-server')
        const res = await fetchFamilyMembers()
        if (!active || !res?.members) return
        const parentSeniors = res.members
          .filter((m: any) => m.role === 'parent')
          .map((m: any) => ({
            id: m.id,
            name: m.name,
            relationship: m.relationship ?? null,
            recordSpaceName: m.recordSpaceName ?? null,
            recordSpaceCoverUrl: m.recordSpaceCoverUrl ?? null,
          }))
        setSeniors(parentSeniors)
        const selectedSeniorId = useChildStore.getState().activeSeniorId
        if (parentSeniors.length > 0 && !selectedSeniorId) {
          setActiveSeniorId(parentSeniors[0].id)
        }
      } catch (e) {
        console.error('Failed to load family members in Home:', e)
      }
    }
    loadSeniors()
    return () => {
      active = false
    }
  }, [isOfflineDemo, setActiveSeniorId])

  useEffect(() => {
    if (activeSeniorId) {
      fetchQuestions()
      fetchChaptersAndQuestions()
      fetchTranscripts()
      fetchEvents()
      fetchConsents()
      fetchPhotos()
    }
  }, [activeSeniorId, fetchQuestions, fetchChaptersAndQuestions, fetchTranscripts, fetchEvents, fetchConsents, fetchPhotos])

  const totalQuestions = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.questions.length, 0),
    [chapters]
  )
  const completedQuestions = useMemo(
    () => chapters.reduce((acc, ch) => acc + ch.questions.filter((q) => q.completed).length, 0),
    [chapters]
  )
  const progressPct = totalQuestions > 0 ? Math.round((completedQuestions / totalQuestions) * 100) : 0

  const pendingReviewTranscripts = useMemo(
    () => transcripts.filter((transcript) => transcript.reviewStatus !== 'applied'),
    [transcripts]
  )

  const pendingChildQuestions = useMemo(
    () => questions.filter((q) => q.status === 'pending').length,
    [questions]
  )

  const answeredChildQuestions = useMemo(
    () => questions.filter((q) => q.status === 'answered').length,
    [questions]
  )
  const answeredStoryCount = Math.max(answeredChildQuestions, transcripts.length)

  const chaptersInProgress = useMemo(
    () => chapters.filter((ch) => ch.questions.some((q) => q.completed)).length,
    [chapters]
  )

  const recordSpaces = seniors.length > 0
    ? seniors.map((senior) => ({
        id: senior.id,
        name: senior.recordSpaceName || senior.name,
        relationship: senior.relationship,
        date: dateStamp(),
        active: activeSeniorId === senior.id,
        coverUrl: senior.recordSpaceCoverUrl,
      }))
    : [{ id: 'demo-space', name: '기록 공간 만들기', relationship: '새 기록 공간', date: '부모님 정보 입력', active: false, coverUrl: null }]

  const displayName = userName || '홍길동'

  const showRecordSpaceNotice = (message: string) => {
    setRecordSpaceNotice(message)
    window.setTimeout(() => setRecordSpaceNotice((current) => (current === message ? null : current)), 2400)
  }

  const handleSelectRecordSpace = (space: typeof recordSpaces[number]) => {
    if (space.id === 'demo-space') {
      navigate('/child/record-space/new')
      return
    }
    if (space.active) {
      showRecordSpaceNotice(`이미 선택된 기록 공간이에요. ${space.name}`)
      return
    }
    setActiveSeniorId(space.id)
    showRecordSpaceNotice(`기록 공간을 전환했어요. ${space.name}`)
  }

  const quickMenuItems: QuickMenuItem[] = [
    {
      title: '새 기록 확인하기',
      subtitle: pendingReviewTranscripts.length > 0 ? `검수 대기 ${formatCount(pendingReviewTranscripts.length)}개` : '새 답변을 기다리는 중',
      badge: pendingReviewTranscripts.length || undefined,
      Icon: ClipboardCheck,
      onClick: () => navigate('/child/chapters'),
    },
    {
      title: '질문 준비하기',
      subtitle: `질문 ${formatCount(questions.length)}개 · 답변 ${formatCount(answeredStoryCount)}개`,
      Icon: PencilLine,
      onClick: () => navigate('/child/questions'),
    },
    {
      title: '사진 올리기',
      subtitle: photos.length > 0 ? `사진 ${formatCount(photos.length)}장 업로드됨` : '사진으로 질문 만들기',
      Icon: ImagePlus,
      onClick: () => navigate('/child/photos'),
    },
    {
      title: '챕터 정리하기',
      subtitle: `${formatCount(chaptersInProgress)}개 챕터 구성 중`,
      Icon: Layers,
      onClick: () => navigate('/child/chapters'),
    },
    {
      title: '가족 기록집 보기',
      subtitle: `${progressPct}% 완성`,
      Icon: BookOpen,
      onClick: () => navigate('/child/progress'),
    },
  ]

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <main className="flex-1 overflow-y-auto px-6 pb-[112px]">
        <header className="relative border-b border-[#E0DBE8] pb-4 pt-5">
          <div className="flex items-start justify-between">
            <div className="min-w-0 pr-4">
              <p className="text-[4px] font-medium uppercase leading-[5.5px] tracking-[1.27px] text-[#2A2830]">
                FAMILY ARCHIVE
              </p>
              <p className="font-serif text-[21px] font-bold leading-[25px] text-[#183025]">Dearlog</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/child/mypage')}
              className="flex h-[37px] w-[37px] items-center justify-center rounded-full bg-[#4E5B73] text-[14px] font-medium leading-[21px] text-white transition active:scale-95"
              aria-label="마이페이지"
            >
              {firstLetter(displayName)}
            </button>
          </div>

          <div className="relative mt-4 min-h-[70px] pr-[74px]">
            <h1 className="truncate font-serif text-[21px] font-medium leading-[31.5px] text-[#2F3136]">
              안녕하세요, {displayName}님
            </h1>
            <p className="mt-0.5 truncate text-[12px] font-normal leading-[18px] text-[#B0B4BC]">{fullDateLabel()}</p>
            <span className="sr-only">부모님의 이야기를 함께 기록해요</span>
            <img
              src={childHomeMascot}
              alt=""
              className="absolute right-1 top-0 h-[58px] w-[46px] object-cover drop-shadow-[0_4px_4px_rgba(0,0,0,0.22)]"
            />
          </div>
        </header>

        <section className="pt-4" aria-labelledby="record-space-heading">
          <div className="flex min-h-[21px] items-center justify-between gap-3">
            <h2 id="record-space-heading" className="text-[14px] font-medium leading-[21px] text-[#2F3136]">
              기록 공간 선택하기
            </h2>
            <span className="shrink-0 text-[11px] leading-[16.5px] text-[#7A767F]">
              {seniors.length > 0 ? `${formatCount(seniors.length)}명` : '대기 중'}
            </span>
          </div>

          <div className="-mx-6 mt-3 overflow-x-auto pb-4">
            <div className="flex w-max gap-3 px-6">
              {recordSpaces.map((space) => (
                <button
                  key={space.id}
                  type="button"
                  onClick={() => handleSelectRecordSpace(space)}
                  className={`w-[132px] shrink-0 rounded-[18px] border bg-white p-2.5 text-left transition active:scale-[0.98] ${
                    space.active
                      ? 'border-[#9485BE] shadow-[0_8px_18px_rgba(148,133,190,0.18)]'
                      : 'border-[#E0DBE8] shadow-[0_4px_12px_rgba(42,40,48,0.06)]'
                  }`}
                  aria-pressed={space.active}
                >
                  <div className="flex min-h-[37px] items-start justify-between gap-2">
                    <p className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-bold leading-[18px] text-[#2A2830]">
                        {space.name}
                      </span>
                      <span className="block truncate text-[10px] font-normal leading-[15px] text-[#B0B4BC]">
                        {space.relationship || '기록 공간'} · {space.date}
                      </span>
                    </p>
                    <PencilLine className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#7A767F]" aria-hidden="true" />
                  </div>
                  <div className="mt-2 h-[118px] overflow-hidden rounded-[16px] bg-[#EEE9F4]">
                    <img src={space.coverUrl || childRecordSpace} alt="" className="h-full w-full object-cover" />
                  </div>
                  <span
                    className={`mt-2 flex min-h-6 items-center justify-center rounded-full text-[10px] font-medium leading-[15px] ${
                      space.active ? 'bg-[#EDE8F0] text-[#6F648F]' : 'bg-[#F8F6F9] text-[#7A767F]'
                    }`}
                  >
                    {space.active ? '선택됨' : space.id === 'demo-space' ? '만들기' : '선택하기'}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {recordSpaceNotice ? (
            <div
              role="status"
              className="mt-1 rounded-[14px] border border-[#E0DBE8] bg-white px-4 py-3 text-[12px] font-medium leading-[18px] text-[#6F648F]"
            >
              {recordSpaceNotice}
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => navigate('/child/record-space/new')}
            className="ml-auto mt-1 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#EDE8F0] text-[#2A2830] shadow-[0_4px_8px_rgba(0,0,0,0.18)] transition active:scale-95"
            aria-label="부모님 기록 공간 추가"
          >
            <Plus className="h-6 w-6" aria-hidden="true" />
          </button>
        </section>

        <section className="mt-5 rounded-[14px] border border-[#E0DBE8] bg-white px-5 py-5" aria-labelledby="record-progress-heading">
          <div className="flex items-center justify-between gap-3">
            <h2 id="record-progress-heading" className="text-[13px] font-medium leading-[19.5px] text-[#2F3136]">
              기록 진행도
            </h2>
            <span className="shrink-0 text-[13px] font-normal tabular-nums leading-[19.5px] text-[#2A2830]">{progressPct}%</span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F0EDE8]">
            <div className="h-full rounded-full bg-[#AFA3D0]" style={{ width: `${progressPct}%` }} />
          </div>
          <p className="mt-2 text-[12px] font-normal leading-[16.5px] text-[#B0B4BC]">
            {totalQuestions > 0
              ? `총 ${formatCount(totalQuestions)}개 질문 중 ${formatCount(completedQuestions)}개 완료`
              : '질문이 준비되면 진행도가 표시됩니다'}
          </p>
        </section>

        <section className="mt-8" aria-labelledby="quick-menu-heading">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="quick-menu-heading" className="text-[14px] font-medium leading-[21px] text-[#2F3136]">
              빠른 메뉴
            </h2>
            <button
              type="button"
              onClick={() => navigate('/child/progress')}
              className="text-[11px] font-normal leading-[16.5px] text-[#7A767F] transition active:opacity-60"
            >
              전체 보기
            </button>
          </div>

          <div className="flex flex-col">
            {quickMenuItems.map((item) => (
              <QuickMenuButton key={item.title} item={item} />
            ))}
          </div>
        </section>

        <button
          type="button"
          onClick={() => navigate('/child/chatbot')}
          className="mt-7 flex min-h-[56px] w-full items-center justify-between gap-4 rounded-[14px] border border-[#E0DBE8] bg-white px-5 py-4 text-left transition active:opacity-70"
        >
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-bold leading-[21px] text-[#2A2830]">대화방 바로가기</span>
            <span className="block truncate text-[11px] font-medium leading-[16.5px] text-[#7A767F]">
              부모님 기억 아카이브와 대화해요
            </span>
          </span>
          <MessageCircle className="h-5 w-5 shrink-0 text-[#4E5B73]" aria-hidden="true" />
        </button>
      </main>

      <ChildBottomNav />
    </div>
  )
}
