import { useState, useEffect, useMemo } from 'react'
import ChildBottomNav from '../components/ChildBottomNav'
import { useStore } from '../store'
import { fetchLocalQuestions, createLocalQuestion } from '../lib/local-server'

type QuestionPriority = 'urgent' | 'normal' | 'interest'

const PRIORITY_META: Record<QuestionPriority, { label: string; bg: string; text: string; dot: string }> = {
  urgent: { label: '긴급', bg: '#F4DDD0', text: '#8B5E3C', dot: '#C8956C' },
  normal: { label: '일반', bg: '#E7DED2', text: '#7A6A5C', dot: '#7A6A5C' },
  interest: { label: '관심', bg: '#D9E0D2', text: '#3E5E41', dot: '#6B8F71' },
}

export default function ChildQuestionsScreen() {
  const auth = useStore((state) => state.auth)
  const userName = auth.guardianProfile?.name ?? auth.guardianProfile?.preferredName ?? '자녀'

  const [questions, setQuestions] = useState<any[]>([])
  const [text, setText] = useState('')
  const [anonymous, setAnonymous] = useState(false)
  const [priority, setPriority] = useState<QuestionPriority>('normal')
  const [submitted, setSubmitted] = useState(false)

  // Load questions
  const loadQuestions = async () => {
    try {
      const res = await fetchLocalQuestions()
      setQuestions(res.questions || [])
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    loadQuestions()
  }, [])

  const handleSubmit = async () => {
    if (!text.trim()) return
    try {
      // In the local API, priority can be mapped or processed
      await createLocalQuestion(text.trim())
      setText('')
      setAnonymous(false)
      setPriority('normal')
      setSubmitted(true)
      await loadQuestions()
      setTimeout(() => setSubmitted(false), 2000)
    } catch (e) {
      console.error(e)
      alert("질문 등록에 실패했습니다. 서버 상태를 확인해 주세요.")
    }
  }

  const sorted = useMemo(() => {
    return [...questions].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [questions])

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
      <div className="flex-1 overflow-y-auto pb-24">
        {/* Header */}
        <div className="px-5 pt-14 pb-5">
          <h1 className="text-[22px] font-bold text-[#3E3128]">질문 등록</h1>
          <p className="mt-0.5 text-[16px] text-[#7A6A5C]">부모님께 드리고 싶은 질문을 등록하세요</p>
        </div>

        {/* Question form */}
        <div
          className="mx-5 rounded-2xl p-5 mb-6"
          style={{ backgroundColor: '#FFFDF8', boxShadow: '0 2px 12px rgba(139,94,60,0.08)' }}
        >
          {/* Textarea */}
          <label className="block text-[14px] font-medium text-[#3E3128] mb-2">
            질문 내용
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="부모님께 여쭤보고 싶은 질문을 입력하세요..."
            rows={3}
            className="w-full rounded-xl px-4 py-3 text-[15px] text-[#3E3128] resize-none outline-none leading-relaxed"
            style={{
              backgroundColor: '#F8F3EA',
              border: '1.5px solid #E7DED2',
              caretColor: '#C8956C',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = '#C8956C')}
            onBlur={(e) => (e.currentTarget.style.borderColor = '#E7DED2')}
          />

          {/* Priority */}
          <div className="mt-4 mb-4">
            <p className="text-[14px] font-medium text-[#3E3128] mb-2">우선순위</p>
            <div className="flex gap-2">
              {(Object.entries(PRIORITY_META) as [QuestionPriority, typeof PRIORITY_META[QuestionPriority]][]).map(
                ([key, meta]) => (
                  <button
                    key={key}
                    onClick={() => setPriority(key)}
                    className="flex-1 py-2.5 rounded-xl text-[14px] font-medium transition-all duration-150"
                    style={{
                      backgroundColor: priority === key ? meta.bg : '#F8F3EA',
                      color: priority === key ? meta.text : '#7A6A5C',
                      border: `1.5px solid ${priority === key ? meta.dot : '#E7DED2'}`,
                    }}
                  >
                    {meta.label}
                  </button>
                )
              )}
            </div>
          </div>

          {/* Anonymous toggle */}
          <div className="flex items-center justify-between py-3 border-t border-[#E7DED2] mb-4">
            <div>
              <p className="text-[15px] font-medium text-[#3E3128]">익명으로 등록</p>
              <p className="text-[12px] text-[#7A6A5C] mt-0.5">
                {anonymous ? '작성자가 표시되지 않아요' : `'${userName}'로 표시돼요`}
              </p>
            </div>
            <button
              onClick={() => setAnonymous((v) => !v)}
              className="relative w-12 h-6 rounded-full transition-colors duration-200"
              style={{ backgroundColor: anonymous ? '#C8956C' : '#C7D1BE' }}
            >
              <div
                className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200"
                style={{ transform: anonymous ? 'translateX(24px)' : 'translateX(2px)' }}
              />
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleSubmit}
            disabled={!text.trim()}
            className="w-full min-h-[48px] rounded-xl text-[16px] font-medium transition-all duration-150 disabled:opacity-40"
            style={{
              backgroundColor: submitted ? '#6B8F71' : '#C8956C',
              color: 'white',
            }}
          >
            {submitted ? '✓ 등록되었습니다' : '등록하기'}
          </button>
        </div>

        {/* Question list */}
        <div className="px-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[16px] font-bold text-[#3E3128]">등록한 질문</h2>
            <span className="text-[13px] text-[#7A6A5C]">총 {questions.length}개</span>
          </div>

          {sorted.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-[15px] text-[#7A6A5C]">아직 등록한 질문이 없어요</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sorted.map((q) => {
                const priorityKey = (q.category === 'urgent' ? 'urgent' : q.category === 'interest' ? 'interest' : 'normal') as QuestionPriority
                const meta = PRIORITY_META[priorityKey]
                return (
                  <div
                    key={q.id}
                    className="rounded-2xl px-4 py-4 animate-fade-in"
                    style={{ backgroundColor: '#FFFDF8', boxShadow: '0 1px 8px rgba(139,94,60,0.06)' }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                        style={{ backgroundColor: meta.bg, color: meta.text }}
                      >
                        {meta.label}
                      </span>
                      <span
                        className="text-[11px] font-medium px-2.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: q.answeredAt ? '#D9E0D2' : '#F4DDD0',
                          color: q.answeredAt ? '#3E5E41' : '#8B5E3C',
                        }}
                      >
                        {q.answeredAt ? '답변 완료' : '대기 중'}
                      </span>
                    </div>
                    <p className="text-[15px] text-[#3E3128] leading-relaxed mb-2">{q.text}</p>
                    <div className="flex items-center justify-between">
                      <p className="text-[12px] text-[#7A6A5C]">
                        {q.anonymous ? '익명' : (q.createdBy?.name || userName)}  ·  {new Date(q.createdAt).toLocaleDateString('ko-KR')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <ChildBottomNav />
    </div>
  )
}
