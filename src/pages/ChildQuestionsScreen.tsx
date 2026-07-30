import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ArrowLeft, CheckCircle2, ChevronRight, ImagePlus, Loader2, PencilLine, Plus, Trash2 } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ActiveSeniorContextBar, MissingSeniorState } from '../components/ActiveSeniorContextBar'
import ChildBottomNav from '../components/ChildBottomNav'
import { useActiveSeniorContext } from '../hooks/useActiveSeniorContext'
import { useAuthStore } from '../store/authStore'
import { useChildStore } from '../store/childStore'
import { reformulateQuestion } from '../lib/agents/questionQueue'
import type { ChildQuestion, QuestionPriority } from '../types/child'
import questionMascot from '../assets/figma/question-mascot.png'

const DEFAULT_QUESTION_PRIORITY: QuestionPriority = 'normal'
const DEFAULT_QUESTION_PRIORITY_SCORE = 2

const RECOMMENDED_QUESTIONS = [
  '처음으로 일을 시작했을 때 어떤 기분이었나요?',
  '가장 행복했던 날의 기억을 떠올려 보세요.',
  '나에게 꼭 하고 싶은 말이 있다면?',
]

const CHAPTER_OPTIONS = [
  { id: 'childhood', label: '어린 시절' },
  { id: 'youth', label: '청년 시절' },
  { id: 'family_home', label: '결혼과 가족' },
  { id: 'hobbies', label: '일과 삶' },
  { id: 'messages', label: '자녀에게 남기는 말' },
]

function normalizeQuestionText(value: string) {
  return value
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[?!？!。．.]+$/u, '')
    .toLocaleLowerCase()
}

function BrandHeader() {
  return (
    <div className="px-6 pb-3 pt-4">
      <p className="text-[3.987px] font-medium uppercase leading-[5.436px] tracking-[1.2685px] text-[#2A2830]">
        FAMILY ARCHIVE
      </p>
      <p className="mt-0.5 font-serif text-[18px] font-semibold leading-[22px] text-[#2A2830]">
        Dearlog
      </p>
    </div>
  )
}

function SectionHeader({ title, count }: { title: string; count: number }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
        {title}
      </p>
      <p className="text-[11px] font-normal leading-[16.5px] text-[#7A767F]">{count}개</p>
    </div>
  )
}

function QuestionRow({
  text,
  answered = false,
  disabled = false,
  deleting = false,
  onClick,
  onDelete,
  statusLabel,
}: {
  text: string
  answered?: boolean
  disabled?: boolean
  deleting?: boolean
  onClick?: () => void
  onDelete?: () => void
  statusLabel?: string
}) {
  const icon = answered ? (
    <CheckCircle2 className="h-[14px] w-[14px] shrink-0 text-[#9485BE]" aria-hidden="true" />
  ) : (
    <span className="h-1 w-1 shrink-0 rounded-full bg-[#9485BE]" aria-hidden="true" />
  )
  const textBlock = (
    <span className="min-w-0 flex-1 text-[13px] font-normal leading-[22.1px] text-[#2A2830]">
      <span className="overflow-hidden [display:-webkit-box] [-webkit-box-orient:vertical] [-webkit-line-clamp:2]">
        {text}
      </span>
      {statusLabel ? (
        <span className="mt-1 block text-[11px] font-medium leading-[16.5px] text-[#9485BE]">
          {statusLabel}
        </span>
      ) : null}
    </span>
  )
  const rowClassName = `flex min-h-[56px] w-full items-center gap-3 rounded-[14px] border border-[#E0DBE8] bg-white px-4 py-3 text-left transition ${
    answered ? 'opacity-60' : ''
  }`

  if (onDelete) {
    return (
      <div className={rowClassName}>
        {icon}
        {textBlock}
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#7A767F] transition hover:bg-[#F8F6F9] active:scale-95 disabled:cursor-wait disabled:opacity-50"
          aria-label={`${text} 삭제`}
        >
          {deleting ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || !onClick}
      className={`${rowClassName} active:scale-[0.99] disabled:cursor-default`}
    >
      {icon}
      {textBlock}
      <ChevronRight className="h-[13px] w-[13px] shrink-0 text-[#7A767F]" aria-hidden="true" />
    </button>
  )
}

function EmptySection({ children }: { children: string }) {
  return (
    <div className="rounded-[14px] border border-dashed border-[#E0DBE8] bg-white/70 px-4 py-4 text-[12px] leading-[18px] text-[#7A767F]">
      {children}
    </div>
  )
}

function QuestionSection({
  title,
  count,
  children,
}: {
  title: string
  count: number
  children: ReactNode
}) {
  return (
    <section className="space-y-3">
      <SectionHeader title={title} count={count} />
      <div className="space-y-2">{children}</div>
    </section>
  )
}

function CreationMethodSheet({
  onClose,
  onPhoto,
  onText,
}: {
  onClose: () => void
  onPhoto: () => void
  onText: () => void
}) {
  return (
    <div className="fixed inset-0 z-[60] mx-auto flex max-w-[390px] items-end bg-[rgba(28,25,32,0.48)]">
      <div className="w-full rounded-t-[28px] bg-white px-5 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-3 shadow-[0_-8px_24px_rgba(42,40,48,0.16)]">
        <div className="flex justify-center">
          <span className="h-[3.5px] w-9 rounded-full bg-[#E0DBE8]" />
        </div>

        <div className="pt-5">
          <h2 className="font-serif text-[18px] font-semibold leading-[27px] text-[#2A2830]">
            어떤 방식으로 질문을 만들까요?
          </h2>
          <p className="mt-1.5 text-[12px] font-normal leading-[20.4px] text-[#7A767F]">
            사진을 단서로 질문을 만들거나, 직접 질문을 적을 수 있어요.
          </p>
        </div>

        <div className="mt-5 h-px bg-[#E0DBE8]" />

        <div className="space-y-3 py-5">
          <button
            type="button"
            onClick={onPhoto}
            className="flex min-h-[88px] w-full items-start gap-4 rounded-[16px] border border-[#E0DBE8] bg-[#F8F6F9] p-[17px] text-left transition active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EDE8F0] text-[#6F648F]">
              <ImagePlus className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="block text-[14px] font-bold leading-[21px] text-[#2A2830]">
                사진 등록해서 질문 만들기
              </span>
              <span className="mt-1 block text-[12px] font-medium leading-[19.8px] text-[#7A767F]">
                가족사진을 올리고, 사진에 맞는 질문을 부모님께 보낼 수 있어요.
              </span>
            </span>
            <ChevronRight className="mt-1 h-[15px] w-[15px] shrink-0 text-[#7A767F]" aria-hidden="true" />
          </button>

          <button
            type="button"
            onClick={onText}
            className="flex min-h-[88px] w-full items-start gap-4 rounded-[16px] border border-[#E0DBE8] bg-[#F8F6F9] p-[17px] text-left transition active:scale-[0.99]"
          >
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-[#EDE8F0] text-[#6F648F]">
              <PencilLine className="h-7 w-7" aria-hidden="true" />
            </span>
            <span className="min-w-0 flex-1 pt-0.5">
              <span className="block text-[14px] font-bold leading-[21px] text-[#2A2830]">
                텍스트로 질문 만들기
              </span>
              <span className="mt-1 block text-[12px] font-medium leading-[19.8px] text-[#7A767F]">
                부모님께 묻고 싶은 이야기를 직접 적어 질문으로 남겨요.
              </span>
            </span>
            <ChevronRight className="mt-1 h-[15px] w-[15px] shrink-0 text-[#7A767F]" aria-hidden="true" />
          </button>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex min-h-[43px] w-full items-center justify-center text-[13px] font-medium leading-[19.5px] tracking-[0.325px] text-[#7A767F] transition active:opacity-60"
        >
          닫기
        </button>
      </div>
    </div>
  )
}

function CreateQuestionScreen({
  contextBar,
  canSubmit,
  text,
  selectedChapterId,
  isReformulating,
  onBack,
  onSubmit,
  onTextChange,
  onChapterChange,
}: {
  contextBar?: ReactNode
  canSubmit: boolean
  text: string
  selectedChapterId: string | null
  isReformulating: boolean
  onBack: () => void
  onSubmit: () => void
  onTextChange: (text: string) => void
  onChapterChange: (chapterId: string | null) => void
}) {
  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-[96px] pt-2">
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 flex h-12 w-12 items-center justify-center rounded-full text-[#2A2830] transition active:scale-95"
          aria-label="질문 관리로 돌아가기"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>

        <header className="relative mt-1">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            새 질문
          </p>
          <h1 className="mt-[15px] font-serif text-[26px] font-normal leading-[39px] text-[#2A2830]">
            질문 만들기
          </h1>
          <img
            src={questionMascot}
            alt=""
            className="absolute right-1 top-[22px] h-[70px] w-14 object-contain drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
          />
        </header>

        {contextBar ? <div className="mt-6">{contextBar}</div> : null}

        <section className={contextBar ? 'mt-6' : 'mt-[34px]'}>
          <label
            htmlFor="question-text"
            className="text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]"
          >
            질문 내용
          </label>
          <textarea
            id="question-text"
            value={text}
            onChange={(event) => onTextChange(event.target.value)}
            placeholder="부모님께 묻고 싶은 이야기를 적어보세요."
            rows={4}
            className="mt-2.5 h-[130px] w-full resize-none rounded-[14px] border border-[#E0DBE8] bg-white p-[17px] text-[14px] leading-[25.2px] text-[#2A2830] outline-none placeholder:text-[#7A767F]/50 focus:border-[#9485BE]"
          />
        </section>

        <aside className="mt-6 border-l-2 border-[#9485BE]/40 pl-[18px]">
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
            예시
          </p>
          <p className="mt-1.5 font-serif text-[13px] font-normal leading-[22.1px] text-[#7A767F]">
            "엄마가 된 순간은 어떤 기억으로 남아 있나요?"
          </p>
        </aside>

        <div className="mt-6 h-px bg-[#E0DBE8]" />

        <section className="mt-6">
          <p className="text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]">
            연결할 챕터 선택 <span className="text-[#7A767F]/60">(선택)</span>
          </p>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {CHAPTER_OPTIONS.map((chapter) => {
              const active = selectedChapterId === chapter.id
              return (
                <button
                  key={chapter.id}
                  type="button"
                  onClick={() => onChapterChange(active ? null : chapter.id)}
                  className={`min-h-8 rounded-full border px-3 text-[12px] font-medium leading-[18px] transition active:scale-[0.98] ${
                    active
                      ? 'border-[#9485BE] bg-[#EDE8F0] text-[#2A2830]'
                      : 'border-[#E0DBE8] bg-white text-[#2A2830]'
                  }`}
                  aria-pressed={active}
                >
                  {chapter.label}
                </button>
              )
            })}
          </div>
        </section>
      </main>

      <footer className="shrink-0 bg-[#F8F6F9]/95 px-6 pb-[calc(env(safe-area-inset-bottom)+38px)] pt-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={!canSubmit || !text.trim() || isReformulating}
          className="flex min-h-[51px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#CFC8DA]"
        >
          {isReformulating ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
          {isReformulating ? '질문을 정리하고 있어요...' : '질문 저장하기'}
        </button>
      </footer>
    </div>
  )
}
export default function ChildQuestionsScreen() {
  const location = useLocation()
  const navigate = useNavigate()
  const { userName } = useAuthStore()
  const { questions, fetchQuestions, addQuestion, deleteQuestion } = useChildStore()
  const incomingSeniorId = (location.state as { seniorId?: string | null } | null)?.seniorId ?? null
  const {
    activeSenior,
    activeSeniorId,
    loading: seniorLoading,
    seniors,
    setActiveSeniorId,
  } = useActiveSeniorContext({ preferredSeniorId: incomingSeniorId })
  const [text, setText] = useState('')
  const [isReformulating, setIsReformulating] = useState(false)
  const [previewText, setPreviewText] = useState<string | null>(null)
  const [pendingOriginal, setPendingOriginal] = useState('')
  const [selectedChapterId, setSelectedChapterId] = useState<string | null>(null)
  const [showCreationMethod, setShowCreationMethod] = useState(false)
  const [showTextCreator, setShowTextCreator] = useState(false)
  const [addingRecommendation, setAddingRecommendation] = useState<string | null>(null)
  const [deletingQuestionId, setDeletingQuestionId] = useState<string | null>(null)
  const [questionNotice, setQuestionNotice] = useState<string | null>(null)

  useEffect(() => {
    if (activeSeniorId) void fetchQuestions()
  }, [activeSeniorId, fetchQuestions])

  const sorted = useMemo(() => {
    return [...questions].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
  }, [questions])

  const pendingQuestions = sorted.filter((question) => question.status !== 'answered')
  const answeredQuestions = sorted.filter((question) => question.status === 'answered')
  const existingQuestionKeys = useMemo(() => {
    return new Set(questions.map((question) => normalizeQuestionText(question.text)).filter(Boolean))
  }, [questions])
  const hasDuplicateQuestion = (questionText: string) => existingQuestionKeys.has(normalizeQuestionText(questionText))

  const showQuestionNotice = (message: string) => {
    setQuestionNotice(message)
    window.setTimeout(() => setQuestionNotice((current) => (current === message ? null : current)), 2400)
  }

  const resetComposer = () => {
    setText('')
    setSelectedChapterId(null)
  }

  const submitQuestion = async () => {
    if (!activeSeniorId || !text.trim() || isReformulating) return
    setIsReformulating(true)
    const original = text.trim()
    if (hasDuplicateQuestion(original)) {
      showQuestionNotice('이미 등록된 질문이에요.')
      setIsReformulating(false)
      return
    }

    try {
      const result = await reformulateQuestion(original, DEFAULT_QUESTION_PRIORITY_SCORE, false, '인생 이야기')
      if (hasDuplicateQuestion(result.reformulatedQuestion)) {
        showQuestionNotice('이미 등록된 질문이에요.')
        setIsReformulating(false)
        return
      }
      if (result.sensitivityLevel === 'high') {
        setPreviewText(result.reformulatedQuestion)
        setPendingOriginal(original)
        setIsReformulating(false)
        return
      }
      await addQuestion({
        text: result.reformulatedQuestion,
        originalText: original,
        anonymous: false,
        submittedBy: userName || '자녀',
        priority: DEFAULT_QUESTION_PRIORITY,
        chapterId: selectedChapterId,
        seniorId: activeSeniorId,
      })
    } catch {
      if (hasDuplicateQuestion(original)) {
        showQuestionNotice('이미 등록된 질문이에요.')
        return
      }
      await addQuestion({
        text: original,
        anonymous: false,
        submittedBy: userName || '자녀',
        priority: DEFAULT_QUESTION_PRIORITY,
        chapterId: selectedChapterId,
        seniorId: activeSeniorId,
      })
    } finally {
      setIsReformulating(false)
    }

    resetComposer()
    setShowTextCreator(false)
  }

  const confirmPreview = async () => {
    if (!previewText || !activeSeniorId) return
    if (hasDuplicateQuestion(previewText)) {
      showQuestionNotice('이미 등록된 질문이에요.')
      setPreviewText(null)
      return
    }
    await addQuestion({
      text: previewText,
      originalText: pendingOriginal,
      anonymous: false,
      submittedBy: userName || '자녀',
      priority: DEFAULT_QUESTION_PRIORITY,
      chapterId: selectedChapterId,
      seniorId: activeSeniorId,
    })
    setPreviewText(null)
    setPendingOriginal('')
    resetComposer()
    setShowTextCreator(false)
  }

  const addRecommendedQuestion = async (questionText: string) => {
    if (addingRecommendation || !activeSeniorId) return
    if (hasDuplicateQuestion(questionText)) {
      showQuestionNotice('이미 등록된 질문이에요.')
      return
    }
    setAddingRecommendation(questionText)

    // Map recommended questions to appropriate chapters so they appear on the parent's list
    let chapterId: string | null = null
    if (questionText.includes('일을 시작했을 때')) {
      chapterId = 'youth'
    } else if (questionText.includes('행복했던 날')) {
      chapterId = 'family_home'
    } else if (questionText.includes('하고 싶은 말')) {
      chapterId = 'messages'
    }

    try {
      await addQuestion({
        text: questionText,
        anonymous: false,
        submittedBy: userName || '자녀',
        priority: DEFAULT_QUESTION_PRIORITY,
        seniorId: activeSeniorId,
        chapterId,
      })
    } finally {
      setAddingRecommendation(null)
    }
  }

  const handleDeleteQuestion = async (question: ChildQuestion) => {
    if (deletingQuestionId) return
    setDeletingQuestionId(question.id)
    try {
      await deleteQuestion(question.id)
      showQuestionNotice('질문을 삭제했어요.')
    } finally {
      setDeletingQuestionId(null)
    }
  }

  const previewModal = previewText ? (
    <div className="fixed inset-0 z-[70] mx-auto flex max-w-[390px] items-end bg-[rgba(28,25,32,0.42)]">
      <div className="w-full rounded-t-[28px] bg-white px-6 pb-[calc(env(safe-area-inset-bottom)+28px)] pt-6 shadow-[0_-8px_24px_rgba(42,40,48,0.16)]">
        <p className="text-[16px] font-bold text-[#2A2830]">이렇게 전달될 예정이에요</p>
        <p className="mt-1 text-[13px] leading-[19.5px] text-[#7A767F]">민감한 표현이 있어 부드럽게 바꿨어요</p>
        <div className="mt-4 rounded-[14px] bg-[#EDE8F0] p-4">
          <p className="text-[15px] leading-relaxed text-[#2A2830]">{previewText}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setPreviewText(null)}
            className="min-h-[48px] rounded-[14px] bg-[#E0DBE8] text-[14px] font-medium text-[#7A767F]"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => void confirmPreview()}
            className="min-h-[48px] rounded-[14px] bg-[#2A2830] text-[14px] font-medium text-white"
          >
            이대로 등록
          </button>
        </div>
      </div>
    </div>
  ) : null

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
        <BrandHeader />
        <MissingSeniorState onCreate={() => navigate('/child/record-space/new')} />
        <ChildBottomNav />
      </div>
    )
  }

  if (showTextCreator) {
    return (
      <>
        {previewModal}
        <CreateQuestionScreen
          contextBar={contextBar}
          canSubmit={Boolean(activeSeniorId)}
          text={text}
          selectedChapterId={selectedChapterId}
          isReformulating={isReformulating}
          onBack={() => setShowTextCreator(false)}
          onSubmit={() => void submitQuestion()}
          onTextChange={setText}
          onChapterChange={setSelectedChapterId}
        />
      </>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      {previewModal}

      {showCreationMethod ? (
        <CreationMethodSheet
          onClose={() => setShowCreationMethod(false)}
          onPhoto={() => {
            setShowCreationMethod(false)
            navigate('/child/photos', { state: { fromQuestions: true, seniorId: activeSeniorId } })
          }}
          onText={() => {
            setShowCreationMethod(false)
            setShowTextCreator(true)
          }}
        />
      ) : null}

      <BrandHeader />

      <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-[132px] pt-1">
        <div className="mb-5">{contextBar}</div>

        <header>
          <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">질문 관리</p>
          <h1 className="mt-2 font-serif text-[26px] font-normal leading-[39px] text-[#2A2830]">
            부모님께 남길 질문
          </h1>
          <div className="mt-4 h-px bg-[#E0DBE8]" />
        </header>

        <div className="mt-[18px] space-y-[18px]">
          {questionNotice ? (
            <div
              role="status"
              className="rounded-[14px] border border-[#E0DBE8] bg-white px-4 py-3 text-[12px] font-medium leading-[18px] text-[#6F648F]"
            >
              {questionNotice}
            </div>
          ) : null}

          <QuestionSection title="추천 질문" count={RECOMMENDED_QUESTIONS.length}>
            {RECOMMENDED_QUESTIONS.map((question) => {
              const alreadyAdded = hasDuplicateQuestion(question)
              return (
                <QuestionRow
                  key={question}
                  text={addingRecommendation === question ? '질문을 추가하고 있어요...' : question}
                  answered={alreadyAdded}
                  disabled={!!addingRecommendation || !activeSeniorId || alreadyAdded}
                  statusLabel={alreadyAdded ? '등록됨' : undefined}
                  onClick={() => void addRecommendedQuestion(question)}
                />
              )
            })}
          </QuestionSection>

          <QuestionSection title="내가 만든 질문" count={pendingQuestions.length}>
            {pendingQuestions.length === 0 ? (
              <EmptySection>아직 만든 질문이 없어요. 오른쪽 아래 + 버튼으로 질문을 추가해 보세요.</EmptySection>
            ) : (
              pendingQuestions.map((question: ChildQuestion) => (
                <QuestionRow
                  key={question.id}
                  text={question.text}
                  deleting={deletingQuestionId === question.id}
                  onDelete={() => void handleDeleteQuestion(question)}
                />
              ))
            )}
          </QuestionSection>

          <QuestionSection title="답변 완료" count={answeredQuestions.length}>
            {answeredQuestions.length === 0 ? (
              <EmptySection>부모님이 답변을 남기면 이곳에 모여요.</EmptySection>
            ) : (
              answeredQuestions.map((question: ChildQuestion) => (
                <QuestionRow
                  key={question.id}
                  text={question.text}
                  answered
                  deleting={deletingQuestionId === question.id}
                  onDelete={() => void handleDeleteQuestion(question)}
                />
              ))
            )}
          </QuestionSection>
        </div>
      </main>

      <button
        type="button"
        onClick={() => setShowCreationMethod(true)}
        disabled={!activeSeniorId}
        className="fixed bottom-[106px] left-1/2 z-40 ml-[117px] flex h-[45px] w-[45px] items-center justify-center rounded-full bg-[#2A2830] text-white shadow-[0_4px_8px_rgba(0,0,0,0.28)] transition active:scale-95"
        aria-label="질문 추가"
      >
        <Plus className="h-6 w-6" aria-hidden="true" />
      </button>

      <ChildBottomNav />
    </div>
  )
}
