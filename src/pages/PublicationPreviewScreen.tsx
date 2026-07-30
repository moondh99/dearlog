import { AlertTriangle, ArrowLeft, Camera, CheckCircle2, ListChecks, Quote, RotateCw } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { usePublicationPreview } from '../components/PublicationBookPreview'
import { useAuthStore } from '../store/authStore'
import type { LocalPublicationEditorialPlan } from '../lib/local-server'

const readinessCopy: Record<string, { label: string; tone: string }> = {
  ready_for_paid_book: { label: '제작 준비됨', tone: 'bg-[#E8F3ED] text-[#2E704F]' },
  needs_family_review: { label: '가족 검수 필요', tone: 'bg-[#F1ECFA] text-[#6E56A5]' },
  needs_more_records: { label: '기록 보강 필요', tone: 'bg-[#FCEEEE] text-[#B94E4E]' },
}

const checklistLabels: Record<string, string> = {
  'minimum-source-volume': '기록량',
  'chapter-episode-density': '장별 밀도',
  'scene-specificity': '장면 구체성',
  'elder-voice': '당사자 목소리',
  'photo-memory-link': '사진 연결',
  'narrative-arc': '책의 흐름',
  'repetition-control': '반복 제거',
  'family-review-readiness': '가족 검수',
}

function formatNumber(value: number | undefined) {
  return Number.isFinite(value) ? String(value) : '0'
}

function readinessBadge(plan: LocalPublicationEditorialPlan | null) {
  const copy = plan ? readinessCopy[plan.readiness] : null
  return copy ?? { label: '기획안 없음', tone: 'bg-[#EEEAF0] text-[#7A767F]' }
}

function ReviewStatusState({
  error,
  loading,
  statusMessage,
}: {
  error: string | null
  loading: boolean
  statusMessage?: string
}) {
  return (
    <div className="flex h-full items-center justify-center px-8 text-center">
      <div className="rounded-lg border border-[#DED7E6] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(42,40,48,0.06)]">
        <p className={`text-[13px] font-medium leading-5 ${error ? 'text-[#C94A4A]' : 'text-[#7A767F]'}`}>
          {error ?? (loading ? statusMessage ?? '검수 내용을 불러오는 중입니다...' : '검수 내용을 불러오지 못했어요.')}
        </p>
      </div>
    </div>
  )
}

function ReviewPanel({ plan }: { plan: LocalPublicationEditorialPlan | null }) {
  if (!plan) {
    return (
      <div className="flex h-full items-center justify-center px-8 text-center text-[13px] font-medium leading-5 text-[#7A767F]">
        검수 기획안을 불러오지 못했어요.
      </div>
    )
  }

  const badge = readinessBadge(plan)
  const sourceSummary = plan.sourceSummary ?? {}
  const checklistFindings = plan.checklistFindings ?? []
  const needsWork = checklistFindings.filter((finding) => finding.status === 'needs_work')
  const followUpQuestions = plan.followUpQuestions ?? []
  const quoteCandidates = plan.directQuoteCandidates ?? []
  const photoPlacements = plan.photoStoryPlacements ?? []
  const chapterPlans = plan.chapterPlans ?? []
  const strongChapterNames = chapterPlans
    .filter((chapter) => plan.strongChapters?.includes(chapter.chapterId))
    .map((chapter) => chapter.chapterTitle || chapter.chapterId)
  const weakChapterNames = chapterPlans
    .filter((chapter) => plan.weakChapters?.includes(chapter.chapterId))
    .map((chapter) => chapter.chapterTitle || chapter.chapterId)

  return (
    <div className="h-full overflow-y-auto px-5 pb-8 pt-4">
      <section className="rounded-lg border border-[#DED7E6] bg-white px-5 py-4 shadow-[0_10px_30px_rgba(42,40,48,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold leading-4 text-[#8D8793]">판매용 기록집 검수</p>
            <h2 className="mt-1 text-[18px] font-semibold leading-6 text-[#2A2830]">{plan.coreTheme || '편집 기획안'}</h2>
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-semibold leading-4 ${badge.tone}`}>
            {badge.label}
          </span>
        </div>
        {plan.editorialThesis ? (
          <p className="mt-3 text-[13px] leading-5 text-[#5E5967]">{plan.editorialThesis}</p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          {[
            ['답변', sourceSummary.sourceRecordCount],
            ['사진', sourceSummary.photoLedRecordCount],
            ['보강 장', sourceSummary.weakChapterCount],
          ].map(([label, value]) => (
            <div key={label} className="min-h-[62px] rounded-md bg-[#F8F6F9] px-3 py-2">
              <p className="text-[11px] font-medium leading-4 text-[#8D8793]">{label}</p>
              <p className="mt-1 text-[20px] font-semibold leading-6 text-[#2A2830]">{formatNumber(value as number | undefined)}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[#DED7E6] bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <ListChecks className="h-4 w-4 text-[#9485BE]" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold leading-5 text-[#2A2830]">장 구성</h2>
        </div>
        <div className="mt-3 grid gap-2">
          <div className="rounded-md bg-[#F8F6F9] px-3 py-3">
            <p className="text-[11px] font-semibold leading-4 text-[#2E704F]">강한 장</p>
            <p className="mt-1 text-[13px] leading-5 text-[#5E5967]">{strongChapterNames.length > 0 ? strongChapterNames.join(', ') : '아직 없음'}</p>
          </div>
          <div className="rounded-md bg-[#F8F6F9] px-3 py-3">
            <p className="text-[11px] font-semibold leading-4 text-[#B94E4E]">보강할 장</p>
            <p className="mt-1 text-[13px] leading-5 text-[#5E5967]">{weakChapterNames.length > 0 ? weakChapterNames.join(', ') : '없음'}</p>
          </div>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[#DED7E6] bg-white px-5 py-4">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-[#B94E4E]" aria-hidden="true" />
          <h2 className="text-[15px] font-semibold leading-5 text-[#2A2830]">품질 체크</h2>
        </div>
        <div className="mt-3 space-y-2">
          {(needsWork.length > 0 ? needsWork : checklistFindings.slice(0, 3)).map((finding) => {
            const passed = finding.status === 'pass'
            const Icon = passed ? CheckCircle2 : AlertTriangle
            return (
              <div key={finding.checklistItemId} className="flex gap-3 rounded-md bg-[#F8F6F9] px-3 py-3">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${passed ? 'text-[#2E704F]' : 'text-[#B94E4E]'}`} aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[12px] font-semibold leading-4 text-[#2A2830]">
                    {checklistLabels[finding.checklistItemId] ?? finding.checklistItemId}
                  </p>
                  <p className="mt-1 text-[12px] leading-5 text-[#6D6875]">{finding.note}</p>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <section className="mt-4 grid gap-3">
        <div className="rounded-lg border border-[#DED7E6] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Quote className="h-4 w-4 text-[#9485BE]" aria-hidden="true" />
            <h2 className="text-[15px] font-semibold leading-5 text-[#2A2830]">인용 후보</h2>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-[#5E5967]">
            {quoteCandidates[0]?.text ?? '직접 인용으로 쓸 문장을 더 모아야 합니다.'}
          </p>
        </div>

        <div className="rounded-lg border border-[#DED7E6] bg-white px-5 py-4">
          <div className="flex items-center gap-2">
            <Camera className="h-4 w-4 text-[#9485BE]" aria-hidden="true" />
            <h2 className="text-[15px] font-semibold leading-5 text-[#2A2830]">사진 기록</h2>
          </div>
          <p className="mt-3 text-[13px] leading-5 text-[#5E5967]">
            {photoPlacements[0]?.caption ?? '사진과 연결된 기억을 더 수집해야 합니다.'}
          </p>
        </div>
      </section>

      <section className="mt-4 rounded-lg border border-[#DED7E6] bg-white px-5 py-4">
        <h2 className="text-[15px] font-semibold leading-5 text-[#2A2830]">추가 질문</h2>
        <div className="mt-3 space-y-2">
          {(followUpQuestions.length > 0 ? followUpQuestions.slice(0, 5) : ['장소, 함께 있던 사람, 그때 마음이 담긴 답변을 더 모아야 합니다.']).map((question) => (
            <p key={question} className="rounded-md bg-[#F8F6F9] px-3 py-2 text-[13px] leading-5 text-[#5E5967]">
              {question}
            </p>
          ))}
        </div>
      </section>
    </div>
  )
}

export default function PublicationPreviewScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { role } = useAuthStore()
  const seniorId = (location.state as { seniorId?: string | null } | null)?.seniorId ?? null
  const requestRole = role === 'parent' ? 'senior' : 'guardian'
  const preview = usePublicationPreview(seniorId, 0, requestRole)

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <header className="flex h-[54px] shrink-0 items-center justify-between px-6 pb-3 pt-2">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="-ml-2 flex h-10 items-center gap-1 rounded-full px-2 text-[#7A767F] transition active:scale-95"
          aria-label="이전 화면으로 돌아가기"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span className="text-[12px] font-medium leading-4">뒤로</span>
        </button>
        <h1 className="text-[14px] font-medium leading-[21px] text-[#2A2830]">기록집 검수</h1>
        <button
          type="button"
          onClick={() => void preview.refresh()}
          disabled={preview.loading}
          className="-mr-2 flex h-10 w-10 items-center justify-center rounded-full text-[#9485BE] transition active:scale-95 disabled:text-[#CFC8DA]"
          aria-label="검수 내용 새로고침"
        >
          <RotateCw className={`h-4 w-4 ${preview.loading ? 'animate-spin' : ''}`} aria-hidden="true" />
        </button>
      </header>

      <main className="relative min-h-0 flex-1 overflow-hidden bg-[#F8F6F9]">
        {!preview.loading && !preview.error ? (
          <ReviewPanel plan={preview.editorialPlan} />
        ) : (
          <ReviewStatusState
            error={preview.error}
            loading={preview.loading}
            statusMessage={preview.statusMessage}
          />
        )}
      </main>
    </div>
  )
}
