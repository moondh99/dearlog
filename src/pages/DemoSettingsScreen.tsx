import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  ClipboardList,
  MessageSquareQuote,
  PlayCircle,
  RotateCcw,
  WifiOff,
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useChildStore } from '../store/childStore'
import { useInterviewStore } from '../store/interviewStore'
import { useAutobiographyStore } from '../store/autobiographyStore'
import { useCalendarStore } from '../store/calendarStore'
import { useConsentStore } from '../store/consentStore'
import { useDevModeStore } from '../store/devModeStore'
import { buildNewGenDemoSeed, DEMO_ROLE_PROFILES } from '../lib/demo/demo-seed-adapter'
import type { UserRole } from '../types/user'

interface DemoStep {
  step: number
  title: string
  path: string
  routeRole: UserRole | null
  action: string
  presenterLine: string
  successSignal: string
}

/** 신세대(App.tsx) 라우트 경로 기준 3~5분 시연 순서 */
const DEMO_STEPS: DemoStep[] = [
  {
    step: 1,
    title: '발표 데이터 준비',
    path: '/settings',
    routeRole: null,
    action: '발표용 데이터 불러오기를 누르고 네트워크 없이 시연을 켭니다.',
    presenterLine: '오늘 시연은 어르신 인터뷰가 이미 저장돼 있다는 가정으로, 사전 데이터를 불러와 안정적으로 진행합니다.',
    successSignal: '아래 준비 상태의 기억, 사진, 가족 질문, 자서전 챕터 수가 모두 채워집니다.',
  },
  {
    step: 2,
    title: '부모님 인터뷰',
    path: '/parent/interview',
    routeRole: 'parent',
    action: '질문 하나를 열어 음성으로 답하는 시니어 화면을 짧게 보여줍니다.',
    presenterLine: '부모님은 큰 글씨와 음성 버튼만으로 답하고, AI가 정리본을 만들어 가족에게 넘깁니다.',
    successSignal: '질문 카드와 음성 답변 흐름이 보이고 기록이 대화 목록에 남습니다.',
  },
  {
    step: 3,
    title: '자녀의 사진과 질문 준비',
    path: '/child/photos',
    routeRole: 'child',
    action: '사진 속 인물·장소·시기 단서에서 생성된 질문을 확인하고 질문으로 등록합니다.',
    presenterLine: '자녀가 올린 사진은 그대로 AI 인터뷰 질문이 되고, 위치 정보는 공개 전 확인 대상으로 표시됩니다.',
    successSignal: '사진 카드마다 추천 질문이 보이고 등록한 질문이 가족 질문 목록에 쌓입니다.',
  },
  {
    step: 4,
    title: '가족 질문과 진행률',
    path: '/child/questions',
    routeRole: 'child',
    action: '가족 질문 목록과 챕터별 진행률을 보여 구독 재방문 루프를 설명합니다.',
    presenterLine: '저장된 기억은 가족 질문과 다음 인터뷰 예약으로 이어져 대화가 계속 돌아옵니다.',
    successSignal: '챕터별 진행률과 답변 완료/대기 질문이 함께 표시됩니다.',
  },
  {
    step: 5,
    title: '나의 분신 대화',
    path: '/child/chatbot',
    routeRole: 'child',
    action: '아래 추천 질문 중 하나를 입력하고 답변의 근거(원문)를 엽니다.',
    presenterLine: '분신 대화는 없는 이야기를 지어내지 않고, 답변에 사용한 실제 기억의 원문을 바로 확인시켜 줍니다.',
    successSignal: '답변 아래에서 STT 원문과 AI 정리본을 함께 확인할 수 있습니다.',
  },
  {
    step: 6,
    title: '자서전과 인쇄용 PDF',
    path: '/child/autobiography',
    routeRole: 'child',
    action: '불러온 자서전 챕터를 넘겨 보고 A5 인쇄용 PDF를 생성합니다.',
    presenterLine: '최종 결과물은 기억 수집, 가족 검수, 문장별 출처 확인을 거친 실물 책 주문 준비 상태입니다.',
    successSignal: 'A5 인쇄용 기록집 미리보기와 챕터 목록이 함께 표시됩니다.',
  },
]

const DEMO_PERSONA_QUESTIONS = [
  '처음 서울에 올라왔을 때 이야기를 들려주세요',
  '어머니와 시장에 갔던 날은 어떤 기억인가요?',
  '첫 월급을 받았을 때 어떤 마음이었나요?',
  '가족에게 꼭 남기고 싶은 말씀이 있으신가요?',
]

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative flex-shrink-0"
      style={{ width: 44, height: 26 }}
      aria-pressed={on}
      aria-label={label}
    >
      <div
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: on ? '#9485BE' : '#E0DBE8' }}
      />
      <div
        className="absolute w-6 h-6 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ left: on ? 20 : 2, top: 1 }}
      />
    </button>
  )
}

function formatSeededAt(value: string | null) {
  if (!value) return null
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export default function DemoSettingsScreen() {
  const navigate = useNavigate()
  const role = useAuthStore((state) => state.role)
  const photos = useChildStore((state) => state.photos)
  const familyQuestions = useChildStore((state) => state.questions)
  const interviewChapters = useInterviewStore((state) => state.chapters)
  const transcripts = useInterviewStore((state) => state.transcripts)
  const autobiographyChapters = useAutobiographyStore((state) => state.chapters)
  const calendarEvents = useCalendarStore((state) => state.events)
  const isOfflineDemo = useDevModeStore((state) => state.isOfflineDemo)
  const demoSeededAt = useDevModeStore((state) => state.demoSeededAt)
  const setOfflineDemo = useDevModeStore((state) => state.setOfflineDemo)
  const setDemoSeededAt = useDevModeStore((state) => state.setDemoSeededAt)

  const [notice, setNotice] = useState<string | null>(null)

  const isSeeded = transcripts.length > 0 || photos.length > 0

  const applyDemoRole = (nextRole: UserRole) => {
    const profile = DEMO_ROLE_PROFILES[nextRole]
    useAuthStore.setState({
      role: profile.role,
      userId: profile.userId,
      userName: profile.userName,
      phoneNumber: useAuthStore.getState().phoneNumber || '01012345678',
      authToken: null,
    })
  }

  const handleSeed = () => {
    const seed = buildNewGenDemoSeed()

    useChildStore.setState({
      photos: seed.photos,
      questions: seed.familyQuestions,
      activeSeniorId: seed.seniorId,
    })
    useInterviewStore.setState({
      chapters: seed.chapters,
      transcripts: seed.transcripts,
    })
    useAutobiographyStore.setState({ chapters: seed.autobiographyChapters })
    useCalendarStore.setState({ events: seed.calendarEvents })
    useConsentStore.setState({ consents: seed.consents })

    if (!useAuthStore.getState().role) {
      applyDemoRole('child')
    }

    setDemoSeededAt(new Date().toISOString())
    setNotice('발표용 데이터를 불러왔습니다.')
  }

  const handleClear = () => {
    useChildStore.setState({ photos: [], questions: [], activeSeniorId: null })
    useInterviewStore.setState({ chapters: [], transcripts: [] })
    useAutobiographyStore.setState({ chapters: [] })
    useCalendarStore.setState({ events: [] })
    useConsentStore.setState({ consents: {} })
    setDemoSeededAt(null)
    setNotice('데모 데이터를 초기화했습니다.')
  }

  const handleGoToStep = (step: DemoStep) => {
    if (step.path === '/settings') return
    if (step.routeRole && role !== step.routeRole) {
      applyDemoRole(step.routeRole)
    }
    navigate(step.path)
  }

  const readinessChecks = [
    { label: '발표용 데이터 불러오기', ready: isSeeded },
    { label: '네트워크 없이 시연', ready: isOfflineDemo },
    { label: '자서전 챕터 준비', ready: autobiographyChapters.length > 0 },
    { label: '시연 역할 로그인', ready: Boolean(role) },
  ]
  const readyCount = readinessChecks.filter((check) => check.ready).length
  const isReady = readyCount === readinessChecks.length
  const seededAtLabel = formatSeededAt(demoSeededAt)

  const counts = [
    { label: '대화 기록', value: transcripts.length },
    { label: '사진', value: photos.length },
    { label: '가족 질문', value: familyQuestions.length },
    { label: '인터뷰 챕터', value: interviewChapters.length },
    { label: '자서전 챕터', value: autobiographyChapters.length },
    { label: '가족 일정', value: calendarEvents.length },
  ]

  return (
    <div className="flex flex-col min-h-[100dvh] bg-[#F8F6F9]">
      {/* Header */}
      <div className="flex items-center px-5 pt-12 pb-4">
        <button
          type="button"
          onClick={() => navigate(role === 'parent' ? '/parent' : '/child')}
          className="p-2 -ml-2 mr-2 min-h-[48px] flex items-center"
          aria-label="뒤로"
        >
          <ChevronLeft size={24} color="#2A2830" />
        </button>
        <h1 className="text-[18px] font-bold text-[#2A2830]">발표 데모</h1>
      </div>

      <div className="flex-1 overflow-y-auto pb-16 px-5">
        {/* 안내 */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="flex items-center gap-2 mb-2">
            <PlayCircle size={18} color="#9485BE" />
            <span className="text-[15px] font-bold text-[#2A2830]">캡스톤 발표 준비</span>
          </div>
          <p className="text-[13px] leading-relaxed text-[#7A767F]">
            사전 데모 데이터를 불러와 서버와 AI 호출 없이도 인터뷰, 사진 질문, 분신 대화, 인쇄용 자서전을
            안정적으로 보여줍니다.
          </p>

          <div className="grid grid-cols-3 gap-2 mt-4">
            {counts.map((item) => (
              <div key={item.label} className="rounded-xl bg-[#F8F6F9] px-2 py-3 text-center">
                <p className="text-[18px] font-bold text-[#2A2830]">{item.value}</p>
                <p className="mt-0.5 text-[11px] text-[#7A767F]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-2">
            <button
              type="button"
              onClick={handleSeed}
              className="h-12 w-full rounded-xl bg-[#9485BE] text-[15px] font-bold text-white active:opacity-80"
            >
              발표용 데이터 불러오기
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!isSeeded && !demoSeededAt}
              className="h-12 w-full rounded-xl border border-[#E0DBE8] bg-white text-[15px] font-bold text-[#7A767F] active:opacity-70 disabled:opacity-40"
            >
              <span className="inline-flex items-center justify-center gap-1.5">
                <RotateCcw size={16} color="#7A767F" />
                데모 데이터 초기화
              </span>
            </button>
          </div>

          {notice && (
            <p className="mt-3 text-[12px] font-medium text-[#9485BE]" role="status">
              {notice}
            </p>
          )}
        </div>

        {/* 오프라인 시연 토글 */}
        <div
          className="rounded-2xl overflow-hidden mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-start gap-3">
              <WifiOff size={18} color={isOfflineDemo ? '#9485BE' : '#7A767F'} className="mt-0.5" />
              <div>
                <p className="text-[16px] text-[#2A2830]">네트워크 없이 시연</p>
                <p className="text-[12px] text-[#7A767F] mt-0.5 leading-relaxed">
                  AI 에이전트가 사전 응답을 사용합니다. 서버가 꺼져 있어도 불러온 데모 데이터가 유지됩니다.
                </p>
              </div>
            </div>
            <Toggle
              on={isOfflineDemo}
              onChange={() => setOfflineDemo(!isOfflineDemo)}
              label="네트워크 없이 시연"
            />
          </div>
        </div>

        {/* 시연 역할 */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <p className="text-[15px] font-bold text-[#2A2830]">시연 역할</p>
          <p className="text-[12px] text-[#7A767F] mt-0.5">
            현재 역할: {role === 'parent' ? '부모님(김영자)' : role === 'child' ? '자녀(김민수)' : '미설정'}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => applyDemoRole('parent')}
              className="h-10 rounded-full border px-3 text-[13px] font-medium active:opacity-70"
              style={{
                borderColor: role === 'parent' ? '#9485BE' : '#E0DBE8',
                color: role === 'parent' ? '#9485BE' : '#7A767F',
                backgroundColor: '#FFFFFF',
              }}
            >
              부모님 화면으로
            </button>
            <button
              type="button"
              onClick={() => applyDemoRole('child')}
              className="h-10 rounded-full border px-3 text-[13px] font-medium active:opacity-70"
              style={{
                borderColor: role === 'child' ? '#9485BE' : '#E0DBE8',
                color: role === 'child' ? '#9485BE' : '#7A767F',
                backgroundColor: '#FFFFFF',
              }}
            >
              자녀 화면으로
            </button>
          </div>
        </div>

        {/* 준비 상태 */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <p className="text-[15px] font-bold text-[#2A2830]">
            {isReady ? '발표 준비가 완료되었습니다' : `발표 준비 ${readyCount}/${readinessChecks.length}개 완료`}
          </p>
          {seededAtLabel && (
            <p className="text-[12px] text-[#7A767F] mt-0.5">불러온 시각: {seededAtLabel}</p>
          )}
          <div className="mt-3 flex flex-col gap-2">
            {readinessChecks.map((check) => (
              <div key={check.label} className="flex items-center gap-2">
                {check.ready ? (
                  <CheckCircle2 size={18} color="#9485BE" />
                ) : (
                  <Circle size={18} color="#E0DBE8" />
                )}
                <span className={`text-[14px] ${check.ready ? 'text-[#2A2830]' : 'text-[#7A767F]'}`}>
                  {check.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 시연 순서 */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-3 px-1">
            <ClipboardList size={18} color="#9485BE" />
            <p className="text-[15px] font-bold text-[#2A2830]">3~5분 시연 순서</p>
          </div>
          <div className="flex flex-col gap-3">
            {DEMO_STEPS.map((step) => (
              <div
                key={step.step}
                className="rounded-2xl p-4"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#9485BE] text-[11px] font-bold text-white">
                    {step.step}
                  </span>
                  <span className="text-[15px] font-bold text-[#2A2830]">{step.title}</span>
                  <span className="rounded-full bg-[#EEE9F2] px-2 py-0.5 text-[11px] font-medium text-[#6F648F]">
                    {step.path}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-[#2A2830]">{step.action}</p>
                <p className="mt-1.5 text-[12px] leading-relaxed text-[#7A767F]">{step.presenterLine}</p>
                <p className="mt-1.5 text-[12px] font-medium text-[#9485BE]">{step.successSignal}</p>
                {step.path !== '/settings' && (
                  <button
                    type="button"
                    onClick={() => handleGoToStep(step)}
                    className="mt-3 h-10 w-full rounded-xl bg-[#F8F6F9] border border-[#E0DBE8] text-[13px] font-bold text-[#2A2830] active:opacity-70"
                  >
                    <span className="inline-flex items-center justify-center gap-1">
                      {step.path}로 이동
                      <ChevronRight size={14} color="#7A767F" />
                    </span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 추천 질문 */}
        <div
          className="rounded-2xl p-5"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="flex items-center gap-2 mb-3">
            <MessageSquareQuote size={18} color="#9485BE" />
            <p className="text-[15px] font-bold text-[#2A2830]">분신 대화 추천 질문</p>
          </div>
          <div className="flex flex-col gap-2">
            {DEMO_PERSONA_QUESTIONS.map((question) => (
              <p key={question} className="rounded-xl bg-[#F8F6F9] px-3 py-2.5 text-[13px] text-[#2A2830]">
                {question}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
