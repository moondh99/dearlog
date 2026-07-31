import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useInterviewStore } from '../store/interviewStore'
import { useCalendarStore } from '../store/calendarStore'
import { processCalendarTrigger } from '../lib/agents/calendarTrigger'
import type { Transcript } from '../types/interview'
import type { EventType, CalendarTriggerResult, CalendarEvent } from '../types/agents'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']
const MONTH_NAMES = [
  '1월', '2월', '3월', '4월', '5월', '6월',
  '7월', '8월', '9월', '10월', '11월', '12월',
]
const EVENT_TYPES: EventType[] = ['결혼식', '졸업식', '생일', '기념일', '기일', '입학', '출산']
const EVENT_EMOJIS: Record<EventType, string> = {
  결혼식: '💍', 졸업식: '🎓', 생일: '🎂', 기념일: '🌸', 기일: '🕯️', 입학: '📚', 출산: '👶',
}

function BackArrow() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M15 18L9 12L15 6" stroke="#2A2830" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M15 18L9 12L15 6" stroke="#2A2830" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M9 18L15 12L9 6" stroke="#2A2830" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function TranscriptCard({ t }: { t: Transcript }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#EDE8F0' }}>
      <div className="flex items-center gap-2 mb-1.5">
        <span className="text-[11px] font-medium text-[#2A2830] bg-[#EDE8F0] px-2 py-0.5 rounded-full">
          {t.chapterTitle}
        </span>
      </div>
      <p className="text-[14px] font-medium text-[#2A2830] mb-1">{t.questionText}</p>
      <p className="text-[13px] text-[#7A767F] leading-relaxed line-clamp-2">{t.originalText}</p>
    </div>
  )
}

function TriggerResultCard({
  result,
  eventType,
}: {
  result: CalendarTriggerResult
  eventType: string
}) {
  const navigate = useNavigate()
  if (result.triggerType === 'DELIVERY' && result.editedStory) {
    return (
      <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: '#EDE8F0' }}>
        <p className="text-[12px] font-bold text-[#2A2830] mb-2">
          {EVENT_EMOJIS[eventType as EventType] ?? '📖'} {eventType} 이야기
        </p>
        <p className="text-[14px] text-[#2A2830] leading-relaxed">{result.editedStory.text}</p>
        <p className="text-[11px] text-[#7A767F] mt-2">
          근거 척도: {result.editedStory.reliability}
        </p>
      </div>
    )
  }
  return (
    <div className="rounded-xl p-4 mt-2" style={{ backgroundColor: '#EEE9F2' }}>
      <p className="text-[12px] font-bold text-[#6F648F] mb-2">📋 추가 인터뷰 추천 주제</p>
      <div className="flex flex-col gap-2">
        {result.suggestedInterviewTopics.map((topic, i) => (
          <button
            key={i}
            onClick={() => navigate('/child/questions')}
            className="text-left bg-white/70 rounded-lg px-3 py-2 active:opacity-70"
          >
            <p className="text-[13px] text-[#2A2830]">{topic}</p>
          </button>
        ))}
      </div>
    </div>
  )
}

export default function CalendarScreen() {
  const navigate = useNavigate()
  const { role } = useAuthStore()
  const { transcripts } = useInterviewStore()
  const { events, addEvent, fetchEvents } = useCalendarStore()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(todayStr)

  const [showEventForm, setShowEventForm] = useState(false)
  const [eventType, setEventType] = useState<EventType | ''>('')
  const [relatedPerson, setRelatedPerson] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const [processingEventId, setProcessingEventId] = useState<string | null>(null)
  const [triggerResults, setTriggerResults] = useState<Record<string, CalendarTriggerResult>>({})

  useEffect(() => {
    void fetchEvents()
  }, [fetchEvents])

  const transcriptDateMap = useMemo(() => {
    const map = new Map<string, Transcript[]>()
    for (const t of transcripts) {
      const arr = map.get(t.recordedAt) ?? []
      arr.push(t)
      map.set(t.recordedAt, arr)
    }
    return map
  }, [transcripts])

  const eventDateMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const e of events) {
      const arr = map.get(e.eventDate) ?? []
      arr.push(e)
      map.set(e.eventDate, arr)
    }
    return map
  }, [events])

  const memoryChunks = useMemo(
    () =>
      transcripts
        .filter((t) => t.chunk)
        .map((t) => ({ ...t.chunk!, chunkId: t.id })),
    [transcripts]
  )

  const calendarCells = useMemo(() => {
    const firstDow = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    while (cells.length % 7 !== 0) cells.push(null)
    return cells
  }, [year, month])

  const fmt = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  const prevMonth = () => {
    if (month === 0) { setYear((y) => y - 1); setMonth(11) }
    else setMonth((m) => m - 1)
    setSelectedDate(null)
  }

  const nextMonth = () => {
    if (month === 11) { setYear((y) => y + 1); setMonth(0) }
    else setMonth((m) => m + 1)
    setSelectedDate(null)
  }

  const handleAddEvent = () => {
    if (!selectedDate || !eventType) return
    setIsSubmitting(true)
    const persons = relatedPerson
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    addEvent({
      eventId: `ev_${Date.now()}`,
      eventType,
      eventDate: selectedDate,
      relatedPersons: persons,
      recipientId: 'family-group',
    })
    setEventType('')
    setRelatedPerson('')
    setShowEventForm(false)
    setIsSubmitting(false)
  }

  const handleProcessTrigger = async (event: CalendarEvent) => {
    setProcessingEventId(event.eventId)
    try {
      const result = await processCalendarTrigger(event, memoryChunks)
      setTriggerResults((prev) => ({ ...prev, [event.eventId]: result }))
    } finally {
      setProcessingEventId(null)
    }
  }

  const selectedTranscripts = selectedDate ? (transcriptDateMap.get(selectedDate) ?? []) : []
  const selectedEvents = selectedDate ? (eventDateMap.get(selectedDate) ?? []) : []
  const recordCount = transcriptDateMap.size
  const backPath = role === 'parent' ? '/parent' : '/child'

  return (
    <div className="flex flex-col min-h-screen bg-[#F8F6F9]">
      <div className="flex items-center px-5 pt-12 pb-4">
        <button onClick={() => navigate(backPath)} aria-label="뒤로" className="p-2 -ml-2 mr-2 min-h-[44px] min-w-[44px] flex items-center">
          <BackArrow />
        </button>
        <h1 className="text-[18px] font-bold text-[#2A2830]">캘린더</h1>
        <span className="ml-auto text-[13px] text-[#7A767F]">기록 {recordCount}일</span>
      </div>

      <div className="flex-1 overflow-y-auto pb-10 px-5">
        {/* Month navigation */}
        <div
          className="rounded-2xl p-5 mb-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="flex items-center justify-between mb-5">
            <button
              onClick={prevMonth}
              aria-label="이전 달"
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[#F3EFF5] active:opacity-70"
            >
              <ChevronLeft />
            </button>
            <span className="text-[17px] font-bold text-[#2A2830]">
              {year}년 {MONTH_NAMES[month]}
            </span>
            <button
              onClick={nextMonth}
              aria-label="다음 달"
              className="w-11 h-11 rounded-full flex items-center justify-center bg-[#F3EFF5] active:opacity-70"
            >
              <ChevronRight />
            </button>
          </div>

          <div className="grid grid-cols-7 mb-2">
            {WEEKDAY_LABELS.map((label, i) => (
              <div
                key={label}
                className="text-center text-[12px] font-medium py-1"
                style={{ color: i === 0 ? '#9485BE' : i === 6 ? '#2A2830' : '#7A767F' }}
              >
                {label}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-y-1">
            {calendarCells.map((day, idx) => {
              if (day === null) return <div key={`empty-${idx}`} />

              const dateStr = fmt(day)
              const hasRecord = transcriptDateMap.has(dateStr)
              const hasEvent = eventDateMap.has(dateStr)
              const isToday = dateStr === todayStr
              const isSelected = dateStr === selectedDate
              const dow = idx % 7

              return (
                <button
                  key={dateStr}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className="flex flex-col items-center py-1 rounded-xl transition-colors active:opacity-70"
                  style={{
                    backgroundColor: isSelected ? '#9485BE' : isToday ? '#F3EFF5' : 'transparent',
                  }}
                >
                  <span
                    className="text-[15px] font-medium"
                    style={{
                      color: isSelected
                        ? '#FFFFFF'
                        : isToday
                        ? '#2A2830'
                        : dow === 0
                        ? '#9485BE'
                        : dow === 6
                        ? '#2A2830'
                        : '#2A2830',
                    }}
                  >
                    {day}
                  </span>
                  <div className="flex gap-0.5 mt-0.5 min-h-[8px]">
                    {hasRecord && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#FFFFFF' : '#9485BE' }}
                      />
                    )}
                    {hasEvent && (
                      <span
                        className="w-1.5 h-1.5 rounded-full"
                        style={{ backgroundColor: isSelected ? '#FFFFFF' : '#9485BE' }}
                      />
                    )}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="flex items-center gap-4 mt-4 pt-4 border-t border-[#E0DBE8]">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9485BE]" />
              <span className="text-[12px] text-[#7A767F]">인터뷰 기록</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#9485BE]" />
              <span className="text-[12px] text-[#7A767F]">기념일·이벤트</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-6 h-6 rounded-xl flex items-center justify-center text-[12px] font-medium"
                style={{ backgroundColor: '#F3EFF5', color: '#2A2830' }}
              >
                오
              </span>
              <span className="text-[12px] text-[#7A767F]">오늘</span>
            </div>
          </div>
        </div>

        {/* Selected date panel */}
        {selectedDate && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[15px] font-bold text-[#2A2830]">
                {selectedDate.replace(/-/g, '.')}
              </h2>
              <button
                onClick={() => setShowEventForm((v) => !v)}
                className="h-8 px-3 rounded-xl text-[12px] font-medium active:opacity-70"
                style={{ backgroundColor: '#EEE9F2', color: '#6F648F' }}
              >
                {showEventForm ? '닫기' : '+ 이벤트 추가'}
              </button>
            </div>

            {/* Event form */}
            {showEventForm && (
              <div
                className="rounded-2xl p-4 mb-4"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <p className="text-[14px] font-bold text-[#2A2830] mb-3">이벤트 등록</p>

                <p className="text-[12px] text-[#7A767F] mb-2">이벤트 종류</p>
                <div className="flex flex-wrap gap-2 mb-4">
                  {EVENT_TYPES.map((type) => (
                    <button
                      key={type}
                      onClick={() => setEventType(type)}
                      className="h-9 px-3 rounded-xl text-[13px] font-medium transition-all active:opacity-70"
                      style={{
                        backgroundColor: eventType === type ? '#9485BE' : '#F3EFF5',
                        color: eventType === type ? '#FFFFFF' : '#2A2830',
                      }}
                    >
                      {EVENT_EMOJIS[type]} {type}
                    </button>
                  ))}
                </div>

                <p className="text-[12px] text-[#7A767F] mb-2">관련 인물 (쉼표로 구분)</p>
                <input
                  type="text"
                  placeholder="예: 어머니, 형, 배우자"
                  value={relatedPerson}
                  onChange={(e) => setRelatedPerson(e.target.value)}
                  className="w-full h-12 rounded-xl px-4 text-[14px] text-[#2A2830] outline-none mb-4"
                  style={{ backgroundColor: '#F8F6F9', border: '1.5px solid #E0DBE8' }}
                />

                <button
                  onClick={handleAddEvent}
                  disabled={!eventType || isSubmitting}
                  className="w-full h-12 rounded-xl text-[15px] font-bold transition-all active:opacity-70 disabled:opacity-40"
                  style={{ backgroundColor: '#9485BE', color: '#FFFFFF' }}
                >
                  등록하기
                </button>
              </div>
            )}

            {/* Registered events */}
            {selectedEvents.length > 0 && (
              <div className="flex flex-col gap-3 mb-4">
                {selectedEvents.map((ev) => (
                  <div
                    key={ev.eventId}
                    className="rounded-2xl p-4"
                    style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-[18px]">{EVENT_EMOJIS[ev.eventType]}</span>
                        <span className="text-[15px] font-bold text-[#2A2830]">{ev.eventType}</span>
                      </div>
                      <span
                        className="text-[11px] font-medium px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: '#EEE9F2', color: '#6F648F' }}
                      >
                        기념일
                      </span>
                    </div>
                    {ev.relatedPersons.length > 0 && (
                      <p className="text-[13px] text-[#7A767F] mb-3">
                        관련 인물: {ev.relatedPersons.join(', ')}
                      </p>
                    )}
                    {triggerResults[ev.eventId] ? (
                      <TriggerResultCard
                        result={triggerResults[ev.eventId]}
                        eventType={ev.eventType}
                      />
                    ) : (
                      <button
                        onClick={() => handleProcessTrigger(ev)}
                        disabled={processingEventId === ev.eventId}
                        className="w-full h-10 rounded-xl text-[13px] font-medium transition-all active:opacity-70 disabled:opacity-60"
                        style={{ backgroundColor: '#EEE9F2', color: '#6F648F' }}
                      >
                        {processingEventId === ev.eventId ? '연결 중...' : '이야기 연결하기'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Transcripts */}
            {selectedTranscripts.length > 0 ? (
              <div className="flex flex-col gap-3">
                {selectedTranscripts.map((t) => (
                  <TranscriptCard key={t.id} t={t} />
                ))}
              </div>
            ) : selectedEvents.length === 0 ? (
              <div
                className="rounded-2xl p-5 text-center"
                style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <p className="text-[15px] text-[#7A767F]">이 날에는 기록된 이야기가 없어요</p>
                {role === 'parent' && (
                  <button
                    onClick={() => navigate('/parent/interview')}
                    className="mt-3 h-10 px-5 rounded-xl bg-[#F3EFF5] text-[13px] font-medium text-[#2A2830] active:opacity-70"
                  >
                    인터뷰 시작하기
                  </button>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
