import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { useConsentStore } from '../store/consentStore'
import { useInterviewStore } from '../store/interviewStore'
import { DEFAULT_CONSENT, type ConsentPurpose } from '../store/consentStore'
import { useChildStore } from '../store/childStore'
import type { Transcript } from '../types/interview'
import type { DemoPhoto } from '../types/child'

// 목적별 동의는 실제 답변(InterviewRecord)에 붙는다.
// 예전에는 운영에서 생성되지 않는 Memory 테이블을 대상으로 해서 이 화면이 늘 비어 있었다.
const RECORD_CONSENT_PURPOSES: Array<{
  key: ConsentPurpose
  label: string
  description: string
}> = [
  { key: 'publish', label: '자서전 출판', description: '책과 출판용 원고에 이 답변을 사용합니다.' },
  { key: 'familyRead', label: '가족 열람', description: '연결된 가족이 이 답변의 내용을 볼 수 있습니다.' },
  { key: 'chatbot', label: '챗봇 답변', description: '나의 분신 대화의 근거로 사용합니다.' },
  { key: 'posthumous', label: '사후 공개', description: '끄면 사후에 유산이 전수된 뒤에도 이 답변을 공개하지 않습니다.' },
  { key: 'sensitive', label: '민감정보 활용', description: '끄면 이 답변을 외부 AI 제공자에게 보내지 않습니다. 책 집필과 챗봇에서도 빠집니다.' },
]

// 사진에는 챗봇이 없다. 분신 대화는 사진을 근거로 쓰지 않는다.
type PhotoConsentPurpose = 'publish' | 'familyRead' | 'posthumous' | 'sensitive'

const PHOTO_CONSENT_PURPOSES: Array<{
  key: PhotoConsentPurpose
  label: string
  description: string
}> = [
  { key: 'publish', label: '자서전 출판', description: '책에 이 사진을 싣습니다.' },
  { key: 'familyRead', label: '가족 열람', description: '연결된 가족이 이 사진을 볼 수 있습니다.' },
  { key: 'posthumous', label: '사후 공개', description: '끄면 사후에 유산이 전수된 뒤에도 이 사진을 공개하지 않습니다.' },
  { key: 'sensitive', label: '민감정보 활용', description: '끄면 이 사진을 외부 AI 제공자에게 보내지 않습니다. 책에서도 빠집니다.' },
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
          <Toggle on={publish} onChange={onPublish} label="자서전 출판 동의" />
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
          <Toggle on={chatbot} onChange={onChatbot} label="챗봇 사용 동의" />
        </div>
      </div>
    </div>
  )
}

function PhotoConsentSettingsSection() {
  const { photos, fetchPhotos, setPhotoConsent } = useChildStore()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    void fetchPhotos()
  }, [fetchPhotos])

  const togglePurpose = async (photo: DemoPhoto, purpose: PhotoConsentPurpose, next: boolean) => {
    if (pendingId) return
    setPendingId(photo.id)
    setNotice(null)
    const label = PHOTO_CONSENT_PURPOSES.find((item) => item.key === purpose)?.label ?? purpose
    try {
      await setPhotoConsent(photo.id, purpose, next)
      setNotice({
        kind: 'success',
        message: `${label}: ${next ? '허용' : '사용 안 함'}으로 변경했습니다.`,
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '사진 동의 상태를 변경하지 못했습니다.',
      })
    } finally {
      setPendingId(null)
    }
  }

  if (photos.length === 0) return null

  return (
    <section className="mb-6" aria-labelledby="photo-consent-heading">
      <div className="mb-3 px-1">
        <h2 id="photo-consent-heading" className="text-[15px] font-bold text-[#2A2830]">
          사진별 활용 설정
        </h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[#7A767F]">
          사진마다 이용 목적을 따로 정할 수 있습니다.
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

      <div className="flex flex-col gap-3">
        {photos.map((photo) => {
          const title = photo.caption || '가족 사진'
          return (
            <article
              key={photo.id}
              className="overflow-hidden rounded-2xl bg-white"
              style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
            >
              <div className="border-b border-[#E0DBE8] px-5 py-4">
                <h3 className="text-[14px] font-bold text-[#2A2830]">{title}</h3>
                <p className="mt-1 text-[12px] text-[#7A767F]">{photo.addedAt}</p>
              </div>

              <div className="flex flex-col gap-4 px-5 py-4">
                {PHOTO_CONSENT_PURPOSES.map((purpose) => {
                  const on = photo[purpose.key] !== false
                  return (
                    <div key={purpose.key} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-[13px] font-bold text-[#2A2830]">{purpose.label}</p>
                        <p className="mt-0.5 text-[11px] leading-relaxed text-[#7A767F]">
                          {purpose.description}
                        </p>
                      </div>
                      <Toggle
                        on={on}
                        onChange={() => void togglePurpose(photo, purpose.key, !on)}
                        label={`${title} 사진 ${purpose.label} ${on ? '끄기' : '켜기'}`}
                      />
                    </div>
                  )
                })}
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}

function RecordConsentSettingsSection() {
  const { transcripts, fetchTranscripts } = useInterviewStore()
  const { consents, fetchConsents, setConsent, stopAllUse } = useConsentStore()
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [notice, setNotice] = useState<{ kind: 'success' | 'error'; message: string } | null>(null)

  useEffect(() => {
    void fetchTranscripts()
    void fetchConsents()
  }, [fetchTranscripts, fetchConsents])

  const consentOf = (transcriptId: string) => consents[transcriptId] ?? DEFAULT_CONSENT

  const togglePurpose = async (transcript: Transcript, purpose: ConsentPurpose, next: boolean) => {
    if (pendingId) return
    setPendingId(transcript.id)
    setNotice(null)
    const label = RECORD_CONSENT_PURPOSES.find((item) => item.key === purpose)?.label ?? purpose
    try {
      await setConsent(transcript.id, purpose, next)
      setNotice({
        kind: 'success',
        message: `${label}: ${next ? '허용' : '사용 안 함'}으로 변경했습니다.`,
      })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '동의 상태를 변경하지 못했습니다.',
      })
    } finally {
      setPendingId(null)
    }
  }

  const stopUsingRecord = async (transcript: Transcript) => {
    if (pendingId) return
    const confirmed = window.confirm(
      `이 답변의 모든 활용을 중지할까요?\n\n자서전 출판, 가족 열람, 챗봇, 사후 공개, 민감정보 활용이 모두 중지됩니다. 나중에 목적별로 다시 허용할 수 있습니다.`,
    )
    if (!confirmed) return

    setPendingId(transcript.id)
    setNotice(null)
    try {
      await stopAllUse(transcript.id)
      setNotice({ kind: 'success', message: '이 답변의 활용을 중지했습니다.' })
    } catch (error) {
      setNotice({
        kind: 'error',
        message: error instanceof Error ? error.message : '활용을 중지하지 못했습니다.',
      })
    } finally {
      setPendingId(null)
    }
  }

  return (
    <section className="mb-6" aria-labelledby="record-consent-heading">
      <div className="mb-3 px-1">
        <h2 id="record-consent-heading" className="text-[15px] font-bold text-[#2A2830]">
          답변별 활용 설정
        </h2>
        <p className="mt-0.5 text-[12px] leading-relaxed text-[#7A767F]">
          저장된 답변마다 이용 목적을 따로 정하고, 필요하면 모든 활용을 한 번에 중지할 수 있습니다.
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

      {transcripts.length === 0 ? (
        <div className="rounded-2xl bg-white px-5 py-8 text-center text-[14px] text-[#7A767F]">
          아직 관리할 답변이 없습니다
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {transcripts.map((transcript) => {
            const isPending = pendingId === transcript.id
            const consent = consentOf(transcript.id)
            const title = transcript.questionText || transcript.chapterTitle || '답변'
            return (
              <article
                key={transcript.id}
                className="overflow-hidden rounded-2xl bg-white"
                style={{ boxShadow: '0 2px 12px rgba(42,40,48,0.08)' }}
              >
                <div className="border-b border-[#E0DBE8] px-5 py-4">
                  <h3 className="text-[14px] font-bold text-[#2A2830]">{title}</h3>
                  <p className="mt-1 text-[12px] leading-relaxed text-[#7A767F]">
                    {truncate(transcript.aiSummary || transcript.originalText || '내용 미리보기가 없습니다.', 64)}
                  </p>
                </div>

                <div className="flex flex-col gap-4 px-5 py-4">
                  {RECORD_CONSENT_PURPOSES.map((purpose) => {
                    const on = consent[purpose.key]
                    return (
                      <div key={purpose.key} className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[13px] font-bold text-[#2A2830]">{purpose.label}</p>
                          <p className="mt-0.5 text-[11px] leading-relaxed text-[#7A767F]">
                            {purpose.description}
                          </p>
                        </div>
                        <Toggle
                          on={on}
                          onChange={() => void togglePurpose(transcript, purpose.key, !on)}
                          label={`${title} ${purpose.label} ${on ? '끄기' : '켜기'}`}
                        />
                      </div>
                    )
                  })}
                </div>

                <div className="border-t border-[#E0DBE8] px-5 py-4">
                  <button
                    type="button"
                    onClick={() => void stopUsingRecord(transcript)}
                    disabled={isPending}
                    aria-label={`${title} 활용 중지`}
                    className="min-h-11 w-full rounded-xl border border-[#B95C5C] bg-white px-4 text-[13px] font-bold text-[#9E3B3B] active:bg-[#FFF0F0] disabled:opacity-55"
                  >
                    {isPending ? '변경 중...' : '이 답변 활용 중지'}
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
        <RecordConsentSettingsSection />
        <PhotoConsentSettingsSection />

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
