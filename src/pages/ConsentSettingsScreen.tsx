import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useConsentStore } from '../store/consentStore'
import { useInterviewStore } from '../store/interviewStore'
import { fetchLocalMemories, updateLocalMemory } from '../lib/local-server'
import type { ConsentSettingsV2, ConsentStatus, Memory } from '../lib/types'
import type { Transcript } from '../types/interview'

type MemoryConsentPurpose = keyof ConsentSettingsV2

const MEMORY_CONSENT_PURPOSES: Array<{
  key: MemoryConsentPurpose
  label: string
  description: string
}> = [
  { key: '출판', label: '자서전 출판', description: '책과 출판용 원고에 이 기억을 사용합니다.' },
  { key: '가족열람', label: '가족 열람', description: '연결된 가족이 이 기억을 볼 수 있습니다.' },
  { key: '챗봇', label: '챗봇 답변', description: '나의 분신 대화의 근거로 사용합니다.' },
  { key: '사후공개', label: '사후 공개', description: '사후 전수 정책에 따라 이 기억을 공개합니다.' },
  { key: '민감정보', label: '민감정보 활용', description: '민감할 수 있는 내용을 서비스 기능에 사용합니다.' },
]

const MEMORY_CONSENT_STATUSES: Array<{ value: ConsentStatus; label: string }> = [
  { value: 'granted', label: '허용' },
  { value: 'revoked', label: '사용 안 함' },
  { value: 'needs_review', label: '검토 필요' },
]

const STOPPED_MEMORY_CONSENTS: ConsentSettingsV2 = {
  출판: 'revoked',
  가족열람: 'revoked',
  챗봇: 'revoked',
  사후공개: 'revoked',
  민감정보: 'revoked',
}

function Toggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      onClick={onChange}
      className="relative flex-shrink-0"
      style={{ width: 44, height: 26 }}
      aria-pressed={on}
    >
      <div
        className="absolute inset-0 rounded-full transition-colors duration-200"
        style={{ backgroundColor: on ? '#9485BE' : '#E0DBE8' }}
      />
      <div
        className="absolute top-1 h-6 w-6 rounded-full bg-white shadow-sm transition-all duration-200"
        style={{ left: on ? 20 : 2, top: 1 }}
      />
    </button>
  )
}

function truncate(value: string, max: number) {
  if (value.length <= max) return value
  return `${value.slice(0, max)}...`
}

function ConsentRecordRow({
  transcript,
  publish,
  chatbot,
  onPublish,
  onChatbot,
}: {
  transcript: Transcript
  publish: boolean
  chatbot: boolean
  onPublish: () => void
  onChatbot: () => void
}) {
  const question = transcript.questionText || '기록된 답변'
  const preview = transcript.originalText || transcript.aiSummary || ''

  return (
    <div className="border-t border-[#E0DBE8] px-5 py-4">
      <p className="mb-1 text-[13px] font-semibold leading-snug text-[#2A2830]">
        {truncate(question, 30)}
      </p>
      <p className="mb-3 text-[12px] leading-snug text-[#7A767F]">
        "{truncate(preview, 42)}"
      </p>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M12 2L2 7L12 12L22 7L12 2Z"
                stroke={publish ? '#9485BE' : '#E0DBE8'}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path
                d="M2 17L12 22L22 17"
                stroke={publish ? '#9485BE' : '#E0DBE8'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M2 12L12 17L22 12"
                stroke={publish ? '#9485BE' : '#E0DBE8'}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14px] text-[#2A2830]">자서전 출판</span>
          </div>
          <Toggle on={publish} onChange={onPublish} />
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z"
                stroke={chatbot ? '#9485BE' : '#E0DBE8'}
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14px] text-[#2A2830]">챗봇 사용</span>
          </div>
          <Toggle on={chatbot} onChange={onChatbot} />
        </div>
      </div>
    </div>
  )
}

function getMemoryConsentStatus(memory: Memory, purpose: MemoryConsentPurpose): ConsentStatus {
  return memory.consentSettings?.[purpose] ?? 'granted'
}

function MemoryConsentSettingsSection() {
  const [memories, setMemories] = useState<Memory[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingMemoryId, setPendingMemoryId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    let active = true

    void fetchLocalMemories()
      .then((response) => {
        if (!active) return
        setMemories(response.memories ?? [])
        setNotice(null)
      })
      .catch((error) => {
        if (!active) return
        setNotice({
          kind: 'error',
          message: error instanceof Error ? error.message : '기억 설정을 불러오지 못했습니다.',
        })
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  const replaceMemory = (updatedMemory: Memory) => {
    setMemories((current) => current.map((memory) =>
      memory.id === updatedMemory.id ? updatedMemory : memory
    ))
  }

  const setPurposeStatus = async (
    memory: Memory,
    purpose: MemoryConsentPurpose,
    status: ConsentStatus,
  ) => {
    if (pendingMemoryId === memory.id || getMemoryConsentStatus(memory, purpose) === status) return

    setPendingMemoryId(memory.id)
    setNotice(null)
    try {
      const response = await updateLocalMemory(memory.id, {
        consentSettings: { [purpose]: status },
      })
      replaceMemory(response.memory)
      const purposeLabel = MEMORY_CONSENT_PURPOSES.find((item) => item.key === purpose)?.label ?? purpose
      const statusLabel = MEMORY_CONSENT_STATUSES.find((item) => item.value === status)?.label ?? status
      setNotice({ kind: 'success', message: `${memory.topic}의 ${purposeLabel}: ${statusLabel} 상태로 변경했습니다.` })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '기억 동의 상태를 변경하지 못했습니다.',
      })
    } finally {
      setPendingMemoryId(null)
    }
  }

  const stopUsingMemory = async (memory: Memory) => {
    if (pendingMemoryId === memory.id) return
    const confirmed = window.confirm(
      `"${memory.topic}" 기억의 모든 활용을 중지할까요?\n\n자서전, 가족 열람, 챗봇, 사후 공개, 민감정보 활용이 모두 중지되고 검색용 데이터도 제거됩니다. 나중에 목적별로 다시 허용할 수 있습니다.`,
    )
    if (!confirmed) return

    setPendingMemoryId(memory.id)
    setNotice(null)
    try {
      const response = await updateLocalMemory(memory.id, {
        privacy: 'private',
        consentSettings: STOPPED_MEMORY_CONSENTS,
        embedding: null,
      })
      replaceMemory(response.memory)
      setNotice({ kind: 'success', message: `${memory.topic} 기억의 활용을 중지했습니다.` })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '기억 활용을 중지하지 못했습니다.',
      })
    } finally {
      setPendingMemoryId(null)
    }
  }

  return (
    <section className="mb-6" aria-labelledby="memory-consent-heading">
      <div className="mb-3 px-1">
        <h2 id="memory-consent-heading" className="text-[15px] font-bold text-[#2A2830]">
          기억별 활용 설정
        </h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[#7A767F]">
          저장된 기억마다 이용 목적을 따로 정하고, 필요하면 모든 활용을 한 번에 중지할 수 있습니다.
        </p>
      </div>

      {notice ? (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`mb-3 rounded-xl px-4 py-3 text-[12px] ${
            notice.kind === 'error'
              ? 'bg-[#FFF0F0] text-[#9E3B3B]'
              : 'bg-[#EEF7F0] text-[#376A43]'
          }`}
        >
          {notice.message}
        </p>
      ) : null}

      {loading ? (
        <div className="rounded-2xl bg-white px-5 py-8 text-center text-[14px] text-[#7A767F]" role="status">
          기억 설정을 불러오는 중...
        </div>
      ) : memories.length === 0 ? (
        <div className="rounded-2xl bg-white px-5 py-8 text-center text-[14px] text-[#7A767F]">
          아직 관리할 기억이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {memories.map((memory) => {
            const isPending = pendingMemoryId === memory.id
            return (
              <article
                key={memory.id}
                className="overflow-hidden rounded-2xl bg-white"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <div className="border-b border-[#E0DBE8] px-5 py-4">
                  <h3 className="text-[14px] font-bold text-[#2A2830]">{memory.topic}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#7A767F]">
                    {truncate(memory.cleanedTranscript || memory.originalTranscript || memory.publishVersion || '내용 미리보기가 없습니다.', 64)}
                  </p>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                  {MEMORY_CONSENT_PURPOSES.map((purpose) => {
                    const currentStatus = getMemoryConsentStatus(memory, purpose.key)
                    const currentLabel = MEMORY_CONSENT_STATUSES.find(
                      (status) => status.value === currentStatus
                    )?.label ?? currentStatus

                    return (
                      <fieldset key={purpose.key} disabled={isPending}>
                        <legend className="w-full">
                          <span className="flex items-center justify-between gap-3">
                            <span className="text-[13px] font-bold text-[#2A2830]">{purpose.label}</span>
                            <span className="text-[11px] font-medium text-[#6F648F]">현재: {currentLabel}</span>
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-[#7A767F]">
                            {purpose.description}
                          </span>
                        </legend>
                        <div className="mt-2 grid grid-cols-3 gap-1.5">
                          {MEMORY_CONSENT_STATUSES.map((status) => {
                            const selected = currentStatus === status.value
                            return (
                              <button
                                key={status.value}
                                type="button"
                                onClick={() => void setPurposeStatus(memory, purpose.key, status.value)}
                                aria-pressed={selected}
                                aria-label={`${memory.topic} 기억 ${purpose.label}: ${status.label} 선택`}
                                className={`min-h-9 rounded-lg border px-1.5 py-2 text-[11px] font-bold ${
                                  selected
                                    ? 'border-[#9485BE] bg-[#EEE9F2] text-[#6F648F]'
                                    : 'border-[#E0DBE8] bg-white text-[#7A767F]'
                                } disabled:opacity-55`}
                              >
                                {status.label}
                              </button>
                            )
                          })}
                        </div>
                      </fieldset>
                    )
                  })}
                </div>

                <div className="border-t border-[#E0DBE8] px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void stopUsingMemory(memory)}
                    disabled={isPending}
                    aria-label={`${memory.topic} 기억 활용 중지`}
                    className="min-h-11 w-full rounded-xl border border-[#B95C5C] bg-white px-4 text-[13px] font-bold text-[#9E3B3B] active:bg-[#FFF0F0] disabled:opacity-55"
                  >
                    {isPending ? '변경 중...' : '이 기억 활용 중지'}
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#7A767F]">
                    활용 중지는 되돌릴 수 있으며, 나중에 목적별로 다시 허용할 수 있습니다.
                  </p>
                </div>
              </article>
            )
          })}
        </div>
      )}
    </section>
  )
}

export default function ConsentSettingsScreen() {
  const navigate = useNavigate()
  const { role } = useAuthStore()
  const { transcripts, fetchTranscripts } = useInterviewStore()
  const { consents, fetchConsents, setConsent, setAll } = useConsentStore()
  const [openChapterIds, setOpenChapterIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    void fetchTranscripts()
    void fetchConsents()
  }, [fetchConsents, fetchTranscripts])

  const grouped = useMemo(
    () => transcripts.reduce<Record<string, { title: string; items: Transcript[] }>>((acc, transcript) => {
      const chapterId = transcript.chapterId || 'uncategorized'
      if (!acc[chapterId]) {
        acc[chapterId] = {
          title: transcript.chapterTitle || '기타 기록',
          items: [],
        }
      }
      acc[chapterId].items.push(transcript)
      return acc
    }, {}),
    [transcripts],
  )

  const groupEntries = useMemo(() => Object.entries(grouped), [grouped])
  const allIds = useMemo(() => transcripts.map((transcript) => transcript.id), [transcripts])
  const getConsent = (id: string) => consents[id] ?? { publish: true, chatbot: true }
  const publishAllowedCount = allIds.filter((id) => getConsent(id).publish).length
  const chatbotAllowedCount = allIds.filter((id) => getConsent(id).chatbot).length
  const backPath = role === 'parent' ? '/parent/mypage' : '/child/mypage'

  useEffect(() => {
    setOpenChapterIds((current) => {
      if (groupEntries.length === 0) return new Set()
      const validIds = new Set(groupEntries.map(([chapterId]) => chapterId))
      const next = new Set([...current].filter((chapterId) => validIds.has(chapterId)))
      if (next.size === 0) next.add(groupEntries[0][0])
      return next
    })
  }, [groupEntries])

  const allOpen = groupEntries.length > 0 && openChapterIds.size === groupEntries.length

  const toggleChapter = (chapterId: string) => {
    setOpenChapterIds((current) => {
      const next = new Set(current)
      if (next.has(chapterId)) next.delete(chapterId)
      else next.add(chapterId)
      return next
    })
  }

  const toggleAllChapters = () => {
    setOpenChapterIds(allOpen ? new Set() : new Set(groupEntries.map(([chapterId]) => chapterId)))
  }

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F6F9]">
      <div className="flex items-center px-5 pb-4 pt-12">
        <button
          type="button"
          onClick={() => navigate(backPath)}
          className="mr-3 flex h-10 w-10 items-center justify-center rounded-full active:bg-[#EDE8F0]"
          aria-label="마이페이지로 돌아가기"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18L9 12L15 6"
              stroke="#2A2830"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <div>
          <h1 className="text-[18px] font-bold text-[#2A2830]">동의 설정</h1>
          <p className="mt-0.5 text-[12px] text-[#7A767F]">답변과 기억의 활용 범위를 관리하세요</p>
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-5 pb-12">
        <MemoryConsentSettingsSection />

        <section
          className="mb-4 rounded-2xl px-5 py-4"
          style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
        >
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: '전체 답변', value: transcripts.length },
              { label: '출판 허용', value: publishAllowedCount },
              { label: '챗봇 허용', value: chatbotAllowedCount },
            ].map((item) => (
              <div key={item.label} className="rounded-xl bg-[#F8F6F9] px-2 py-3 text-center">
                <p className="text-[18px] font-bold text-[#2A2830]">{item.value}</p>
                <p className="mt-0.5 text-[11px] text-[#7A767F]">{item.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void setAll(allIds, true, true)}
              className="h-9 rounded-full border px-3 text-[12px] font-medium leading-none whitespace-nowrap active:opacity-70"
              style={{ borderColor: '#9485BE', color: '#9485BE', backgroundColor: '#FFFFFF' }}
            >
              전체 공개
            </button>
            <button
              type="button"
              onClick={() => void setAll(allIds, false, false)}
              className="h-9 rounded-full border px-3 text-[12px] font-medium leading-none whitespace-nowrap active:opacity-70"
              style={{ borderColor: '#E0DBE8', color: '#7A767F', backgroundColor: '#FFFFFF' }}
            >
              전체 비공개
            </button>
          </div>
        </section>

        <div className="mb-3 flex items-center justify-between px-1">
          <p className="text-[13px] font-bold text-[#2A2830]">챕터별 답변</p>
          {groupEntries.length > 0 ? (
            <button
              type="button"
              onClick={toggleAllChapters}
              className="rounded-full bg-[#EEE9F2] px-3 py-1.5 text-[12px] font-bold text-[#6F648F] active:opacity-75"
            >
              {allOpen ? '모두 접기' : '모두 펼치기'}
            </button>
          ) : null}
        </div>

        {transcripts.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-8 text-center"
            style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
          >
            <p className="text-[14px] text-[#7A767F]">아직 기록된 답변이 없습니다</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {groupEntries.map(([chapterId, { title, items }]) => {
              const isOpen = openChapterIds.has(chapterId)
              const chapterIds = items.map((item) => item.id)
              const chapterPublishCount = chapterIds.filter((id) => getConsent(id).publish).length
              const chapterChatbotCount = chapterIds.filter((id) => getConsent(id).chatbot).length

              return (
                <section
                  key={chapterId}
                  className="overflow-hidden rounded-2xl"
                  style={{ backgroundColor: '#FFFFFF', boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
                >
                  <button
                    type="button"
                    onClick={() => toggleChapter(chapterId)}
                    className="flex w-full items-center justify-between px-5 py-4 text-left active:bg-[#F8F6F9]"
                    aria-expanded={isOpen}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-[#9485BE]" />
                        <p className="truncate text-[14px] font-bold text-[#2A2830]">{title}</p>
                      </div>
                      <p className="mt-1 text-[11px] text-[#7A767F]">
                        답변 {items.length}개 · 출판 {chapterPublishCount}개 · 챗봇 {chapterChatbotCount}개
                      </p>
                    </div>
                    <span className="ml-3 shrink-0 text-[18px] text-[#9485BE]" aria-hidden="true">
                      {isOpen ? '−' : '+'}
                    </span>
                  </button>

                  {isOpen ? (
                    <>
                      <div className="grid grid-cols-2 gap-2 border-t border-[#E0DBE8] px-5 py-3">
                        <button
                          type="button"
                          onClick={() => void setAll(chapterIds, true, true)}
                          className="h-8 rounded-full bg-[#EEE9F2] px-3 text-[12px] font-bold text-[#6F648F] active:opacity-75"
                        >
                          챕터 공개
                        </button>
                        <button
                          type="button"
                          onClick={() => void setAll(chapterIds, false, false)}
                          className="h-8 rounded-full bg-[#F3EFF5] px-3 text-[12px] font-bold text-[#2A2830] active:opacity-75"
                        >
                          챕터 비공개
                        </button>
                      </div>

                      {items.map((transcript) => {
                        const consent = getConsent(transcript.id)
                        return (
                          <ConsentRecordRow
                            key={transcript.id}
                            transcript={transcript}
                            publish={consent.publish}
                            chatbot={consent.chatbot}
                            onPublish={() => void setConsent(transcript.id, 'publish', !consent.publish)}
                            onChatbot={() => void setConsent(transcript.id, 'chatbot', !consent.chatbot)}
                          />
                        )
                      })}
                    </>
                  ) : null}
                </section>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
