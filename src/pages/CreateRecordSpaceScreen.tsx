import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, Camera, Check, Home, ImagePlus, Link2, Loader2, MessageCircle } from 'lucide-react'
import { createParentInvitation, type CreateParentInvitationInput, type LocalInvitation } from '../lib/local-server'
import { toLocalDateStamp } from '../lib/date'
import { useChildStore } from '../store/childStore'
import createSpaceMascot from '../assets/figma/create-space-mascot.png'

const MAX_SPACE_NAME_LENGTH = 40
const MAX_PARENT_NAME_LENGTH = 24
const MAX_PARENT_DETAIL_LENGTH = 80
const MAX_IMAGE_BYTES = 2 * 1024 * 1024
const RELATIONSHIPS = ['어머니', '아버지', '할머니', '할아버지', '외할머니', '외할아버지']
const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: CURRENT_YEAR - 1930 + 1 }, (_, index) => 1930 + index)
const MONTHS = Array.from({ length: 12 }, (_, index) => index + 1)

type CreationStep = 1 | 2 | 3 | 4
type Step = CreationStep | 'complete'

function readImageAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

function normalizeBirthDateInput(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null

  const match = trimmed.replace(/\./g, '-').match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (!match) return undefined

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const iso = `${match[1]}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const parsed = new Date(`${iso}T00:00:00.000Z`)
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return undefined
  }
  return iso
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function formatBirthDate(year: number, month: number, day: number) {
  return `${year}.${String(month).padStart(2, '0')}.${String(day).padStart(2, '0')}`
}

function formatDateLabel(value?: string | Date | null) {
  return toLocalDateStamp(value)
}

async function copyTextToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall back below. Clipboard permission can fail after an async API call.
  }

  const textarea = document.createElement('textarea')
  const activeElement = document.activeElement instanceof HTMLElement ? document.activeElement : null
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  textarea.setSelectionRange(0, textarea.value.length)

  try {
    return document.execCommand('copy')
  } finally {
    document.body.removeChild(textarea)
    activeElement?.focus()
  }
}

function StepIndicator({ activeStep }: { activeStep: CreationStep }) {
  return (
    <div className="grid grid-cols-4 gap-1.5" aria-label={`기록 공간 생성 단계 ${activeStep}/4`}>
      {[1, 2, 3, 4].map((step) => (
        <span
          key={step}
          className={`h-1 rounded-full ${step === activeStep ? 'bg-[#9485BE]' : 'bg-[#2A2830]'}`}
        />
      ))}
    </div>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: string }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]"
    >
      {children}
    </label>
  )
}

function DateColumn({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string
  values: number[]
  selected: number
  onSelect: (value: number) => void
}) {
  return (
    <div className="min-w-0">
      <p className="text-center text-[10px] font-normal uppercase leading-[15px] tracking-[1px] text-[#7A767F]">
        {label}
      </p>
      <div className="mt-1.5 max-h-[176px] overflow-y-auto rounded-[14px] bg-[#F8F6F9]">
        {values.map((value) => {
          const active = value === selected
          return (
            <button
              key={value}
              type="button"
              onClick={() => onSelect(value)}
              className={`flex h-[41px] w-full items-center justify-center text-[14px] leading-[21px] transition active:opacity-60 ${
                active ? 'bg-[#EDE8F0] font-bold text-[#2A2830]' : 'font-normal text-[#7A767F]'
              }`}
              aria-pressed={active}
            >
              {value}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function CreateRecordSpaceScreen() {
  const navigate = useNavigate()
  const setActiveSeniorId = useChildStore((state) => state.setActiveSeniorId)
  const profileInputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const invitationPromiseRef = useRef<Promise<LocalInvitation | null> | null>(null)
  const invitationPromiseKeyRef = useRef('')
  const [step, setStep] = useState<Step>(1)
  const [spaceName, setSpaceName] = useState('')
  const [parentName, setParentName] = useState('')
  const [parentBirthDate, setParentBirthDate] = useState('')
  const [selectedRelationship, setSelectedRelationship] = useState(RELATIONSHIPS[0])
  const [showBirthDateSheet, setShowBirthDateSheet] = useState(false)
  const [selectedYear, setSelectedYear] = useState(1952)
  const [selectedMonth, setSelectedMonth] = useState(3)
  const [selectedDay, setSelectedDay] = useState(12)
  const [hasCurrentJob, setHasCurrentJob] = useState(false)
  const [occupation, setOccupation] = useState('')
  const [hometown, setHometown] = useState('')
  const [schoolHistory, setSchoolHistory] = useState('')
  const [profilePreview, setProfilePreview] = useState<string | null>(null)
  const [coverPreview, setCoverPreview] = useState<string | null>(null)
  const [coverFileName, setCoverFileName] = useState('')
  const [createdInvitation, setCreatedInvitation] = useState<LocalInvitation | null>(null)
  const [completedInvitation, setCompletedInvitation] = useState<LocalInvitation | null>(null)
  const [createdPayloadKey, setCreatedPayloadKey] = useState('')
  const [invitePreparing, setInvitePreparing] = useState(false)
  const [sharePending, setSharePending] = useState<'kakao' | 'link' | null>(null)
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const trimmedSpaceName = spaceName.trim()
  const trimmedParentName = parentName.trim()
  const trimmedOccupation = occupation.trim()
  const trimmedHometown = hometown.trim()
  const trimmedSchoolHistory = schoolHistory.trim()
  const resolvedRelationship = selectedRelationship
  const canContinue = step === 'complete' ? false : step === 1 ? trimmedSpaceName.length > 0 : step === 2 ? trimmedParentName.length > 0 : true
  const parentBirthYear = parentBirthDate.match(/^\d{4}/)?.[0] ?? null
  const invitationName = trimmedParentName || '부모님'
  const invitationDisplayName = resolvedRelationship && !invitationName.includes(resolvedRelationship)
    ? `${invitationName} ${resolvedRelationship}`
    : invitationName
  const invitationInitial = Array.from(invitationName)[0] ?? '부'
  const normalizedBirthDateForPayload = normalizeBirthDateInput(parentBirthDate)
  const invitationPayload = normalizedBirthDateForPayload === undefined
    ? null
    : {
        seniorName: trimmedParentName,
        birthDate: normalizedBirthDateForPayload,
        relationship: resolvedRelationship,
        recordSpaceName: trimmedSpaceName,
        profileImageUrl: profilePreview,
        recordSpaceCoverUrl: coverPreview,
        hasCurrentJob,
        occupation: trimmedOccupation || null,
        hometown: trimmedHometown || null,
        schoolHistory: trimmedSchoolHistory || null,
      } satisfies CreateParentInvitationInput
  const invitationPayloadKey = invitationPayload ? JSON.stringify(invitationPayload) : ''
  const invitationReady = !!createdInvitation?.token && createdPayloadKey === invitationPayloadKey

  const goBack = () => {
    if (step === 'complete') {
      navigate('/child', { replace: true })
      return
    }
    if (step !== 1) {
      setStep(step === 4 ? 3 : step === 3 ? 2 : 1)
      setErrorMsg(null)
      setNoticeMsg(null)
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
    } else {
      navigate('/child', { replace: true })
    }
  }

  const clearCover = () => {
    setCoverPreview(null)
    setCoverFileName('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const readSelectedImage = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('JPG 또는 PNG 이미지만 선택할 수 있어요.')
    }
    if (file.size > MAX_IMAGE_BYTES) {
      throw new Error('이미지는 2MB 이하로 선택해 주세요.')
    }
    return readImageAsDataUrl(file)
  }

  const handleProfileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const previewUrl = await readSelectedImage(file)
      setProfilePreview(previewUrl)
      setErrorMsg(null)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '이미지를 불러오지 못했어요.')
      event.target.value = ''
    }
  }

  const handleCoverChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const previewUrl = await readSelectedImage(file)
      setCoverPreview(previewUrl)
      setCoverFileName(file.name)
      setErrorMsg(null)
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : '이미지를 불러오지 못했어요.')
      event.target.value = ''
    }
  }

  const ensureInvitation = async () => {
    if (!invitationPayload) {
      setErrorMsg('생년월일은 예시처럼 1952.03.12 형식으로 입력해 주세요.')
      return null
    }

    if (createdInvitation && createdPayloadKey === invitationPayloadKey) {
      return createdInvitation
    }
    if (invitationPromiseRef.current && invitationPromiseKeyRef.current === invitationPayloadKey) {
      return invitationPromiseRef.current
    }

    invitationPromiseKeyRef.current = invitationPayloadKey
    invitationPromiseRef.current = createParentInvitation(invitationPayload)
      .then((response) => {
        setCreatedInvitation(response.invitation)
        setCreatedPayloadKey(invitationPayloadKey)
        return response.invitation
      })
      .finally(() => {
        if (invitationPromiseKeyRef.current === invitationPayloadKey) {
          invitationPromiseRef.current = null
        }
      })

    return invitationPromiseRef.current
  }

  const buildInviteUrl = (token: string) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    return `${origin}/parent/autologin?token=${encodeURIComponent(token)}`
  }

  const finalizeRecordSpace = async () => {
    if (submitting) return

    setSubmitting(true)
    setErrorMsg(null)
    setNoticeMsg(null)
    try {
      const invitation = await ensureInvitation()
      if (!invitation) return
      setActiveSeniorId(invitation.seniorId)
      setCompletedInvitation(invitation)
      setStep('complete')
    } catch (error) {
      console.error('Failed to create record space:', error)
      setErrorMsg('기록 공간을 만들지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (step === 'complete' || !canContinue || submitting) return

    if (step !== 4) {
      setStep((current) => (current === 1 ? 2 : current === 2 ? 3 : 4))
      setErrorMsg(null)
      setNoticeMsg(null)
      return
    }

    await finalizeRecordSpace()
  }

  const handleInviteShare = async (kind: 'kakao' | 'link') => {
    if (sharePending || submitting) return

    setSharePending(kind)
    setErrorMsg(null)
    setNoticeMsg(null)
    try {
      const invitation = invitationReady ? createdInvitation : await ensureInvitation()
      if (!invitation?.token) {
        throw new Error('초대 토큰을 만들지 못했어요.')
      }

      const inviteUrl = buildInviteUrl(invitation.token)
      const shareText = `${invitationDisplayName}님, 디어로그 초대장이 도착했어요. 링크를 열고 이야기를 남겨주세요.`

      if (kind === 'kakao' && typeof navigator.share === 'function') {
        try {
          await navigator.share({
            title: '디어로그 초대장',
            text: shareText,
            url: inviteUrl,
          })
          setNoticeMsg('초대장을 공유했어요.')
          return
        } catch (error) {
          if ((error as { name?: string })?.name === 'AbortError') {
            setNoticeMsg('공유를 취소했어요.')
            return
          }
        }
      }

      const copied = await copyTextToClipboard(inviteUrl)
      setNoticeMsg(copied
        ? kind === 'kakao'
          ? '초대 링크를 복사했어요. 카카오톡에 붙여넣어 보내주세요.'
          : '초대 링크를 복사했어요.'
        : `초대 링크: ${inviteUrl}`)
    } catch (error) {
      console.error('Failed to share invitation:', error)
      setErrorMsg('초대 링크를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setSharePending(null)
    }
  }

  const handleYearSelect = (year: number) => {
    setSelectedYear(year)
    setSelectedDay((day) => Math.min(day, daysInMonth(year, selectedMonth)))
  }

  const handleMonthSelect = (month: number) => {
    setSelectedMonth(month)
    setSelectedDay((day) => Math.min(day, daysInMonth(selectedYear, month)))
  }

  const confirmBirthDate = () => {
    setParentBirthDate(formatBirthDate(selectedYear, selectedMonth, selectedDay))
    setShowBirthDateSheet(false)
    setErrorMsg(null)
  }

  useEffect(() => {
    if (step !== 4 || invitationReady || !invitationPayloadKey) return

    let active = true
    setInvitePreparing(true)
    setErrorMsg(null)
    void ensureInvitation()
      .catch((error) => {
        if (!active) return
        console.error('Failed to prepare invitation:', error)
        setErrorMsg('초대 링크를 미리 준비하지 못했어요. 다시 시도해 주세요.')
      })
      .finally(() => {
        if (active) setInvitePreparing(false)
      })

    return () => {
      active = false
    }
  }, [step, invitationPayloadKey])

  const completionInvitation = completedInvitation ?? createdInvitation

  if (step === 'complete') {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
        <main className="flex min-h-0 flex-1 flex-col px-6 pb-[calc(env(safe-area-inset-bottom)+40px)] pt-[72px]">
          <section className="flex flex-1 flex-col" aria-labelledby="record-space-complete-heading">
            <div className="flex flex-col items-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#E0DBE8] text-[#9485BE]">
                <Check className="h-[22px] w-[22px]" aria-hidden="true" />
              </div>
              <p className="mt-8 text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
                생성 완료
              </p>
              <h1
                id="record-space-complete-heading"
                className="mt-3 font-serif text-[28px] font-normal leading-[42px] text-[#2A2830]"
              >
                기록 공간이 열렸어요
              </h1>
              <p className="mt-3 text-[13px] font-normal leading-[23.4px] text-[#7A767F]">
                부모님이 링크를 열면
                <br />
                바로 이야기를 시작할 수 있어요.
              </p>
            </div>

            <div className="my-8 h-px w-full bg-[#E0DBE8]" />

            <div className="rounded-[14px] border border-[#E0DBE8] bg-white px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
                    기록 공간
                  </p>
                  <p className="mt-2 truncate text-[13px] font-normal leading-[19.5px] text-[#2A2830]">
                    {trimmedSpaceName}
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
                    시작일
                  </p>
                  <p className="mt-2 text-[13px] font-normal leading-[19.5px] text-[#2A2830]">
                    {formatDateLabel(completionInvitation?.createdAt)}
                  </p>
                </div>
              </div>

              <div className="my-4 h-px w-full bg-[#E0DBE8]" />

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
                    초대 대상
                  </p>
                  <p className="mt-2 truncate font-serif text-[15px] font-semibold leading-[22.5px] text-[#2A2830]">
                    {invitationDisplayName}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-[#E0DBE8] bg-[#EDE8F0] px-[11px] py-[5px] text-[10px] font-medium uppercase leading-[15px] tracking-[1.2px] text-[#7A767F]">
                  응답 대기 중
                </span>
              </div>
            </div>

            <p className="mt-4 rounded-[14px] bg-[#EDE8F0]/50 px-4 py-4 text-[12px] font-normal leading-[20.4px] text-[#7A767F]">
              기다리는 동안 질문을 미리 준비하거나, 함께 찍은 사진을 올려두세요.
            </p>
          </section>

          <div className="mt-8 space-y-3">
            <button
              type="button"
              onClick={() => navigate('/child/questions', { state: { seniorId: completionInvitation?.seniorId } })}
              className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-medium leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99]"
            >
              질문 준비하기
            </button>
            <button
              type="button"
              onClick={() => navigate('/child', { replace: true })}
              className="flex min-h-[51px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#E0DBE8] bg-white px-5 text-[14px] font-medium leading-[21px] tracking-[0.42px] text-[#2A2830] transition active:scale-[0.99]"
            >
              <Home className="h-[15px] w-[15px] text-[#4D5562]" aria-hidden="true" />
              홈으로 이동
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] text-[#2A2830]">
      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <main className="min-h-0 flex-1 overflow-y-auto px-6 pb-7 pt-3">
          <header>
            <button
              type="button"
              onClick={goBack}
              className="-ml-2 flex h-12 w-12 items-center justify-center rounded-full text-[#2A2830] transition active:scale-95"
              aria-label="뒤로가기"
            >
              <ArrowLeft className="h-5 w-5" aria-hidden="true" />
            </button>

            <p className="mt-1 text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
              기록 공간 생성하기
            </p>
            <div className="mt-4 flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <h1 className="font-serif text-[28px] font-normal leading-[36.4px] text-[#2A2830]">
                  {step === 4 ? '부모님을' : '기록 공간을'}
                  <br />
                  {step === 4 ? '초대해보세요' : '만들어보세요'}
                </h1>
                <p className="mt-4 text-[12px] font-normal leading-[18px] tracking-[0.3px] text-[#7A767F]">
                  {step === 1
                    ? '기록 공간의 이름과 표지 사진을 등록해주세요.'
                    : step === 4
                      ? (
                          <>
                            초대로 들어오신 부모님은 주어진 질문에 답하며
                            <br />
                            이야기를 남길 수 있어요.
                          </>
                        )
                      : '부모님에 대한 기본 정보를 입력해주세요.'}
                </p>
              </div>
              <img
                src={createSpaceMascot}
                alt=""
                className="mt-10 h-[61px] w-[45px] shrink-0 object-cover drop-shadow-[0_4px_4px_rgba(0,0,0,0.25)]"
              />
            </div>
          </header>

          <div className="mt-6">
            <StepIndicator activeStep={step} />
          </div>

          {step === 1 ? (
            <>
              <section className="mt-7" aria-labelledby="parent-profile-heading">
                <h2 id="parent-profile-heading" className="text-[14px] font-bold leading-[21px] text-[#2F3136]">
                  부모님 프로필
                </h2>
                <input
                  ref={profileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={handleProfileChange}
                />
                <button
                  type="button"
                  onClick={() => profileInputRef.current?.click()}
                  className="mt-3 flex h-[86px] w-[86px] items-center justify-center overflow-hidden rounded-full bg-[#EDE8F0] text-[#7A767F] shadow-[inset_0_0_0_1px_rgba(224,219,232,0.9)] transition active:scale-95"
                  aria-label="부모님 프로필 사진 선택"
                >
                  {profilePreview ? (
                    <img src={profilePreview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <Camera className="h-7 w-7" aria-hidden="true" />
                  )}
                </button>
              </section>

              <section className="mt-6">
                <label htmlFor="record-space-name" className="text-[13px] font-bold leading-[19.5px] text-[#2F3136]">
                  이름
                </label>
                <div className="mt-2 rounded-[14px] border border-[#E0DBE8] bg-white px-4 py-3 shadow-[0_4px_12px_rgba(42,40,48,0.04)] focus-within:border-[#9485BE]">
                  <input
                    id="record-space-name"
                    value={spaceName}
                    onChange={(event) => setSpaceName(event.target.value.slice(0, MAX_SPACE_NAME_LENGTH))}
                    maxLength={MAX_SPACE_NAME_LENGTH}
                    placeholder="예: 김영숙씨 생애일기"
                    className="h-8 w-full bg-transparent text-[15px] font-medium leading-[22.5px] text-[#2A2830] outline-none placeholder:text-[#B0B4BC]"
                  />
                </div>
                <p className="mt-1 text-right text-[11px] leading-[16.5px] text-[#B0B4BC]">
                  {spaceName.length}/{MAX_SPACE_NAME_LENGTH}
                </p>
              </section>

              <section className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <label className="text-[13px] font-bold leading-[19.5px] text-[#2F3136]">표지 사진</label>
                  {coverPreview ? (
                    <button
                      type="button"
                      onClick={clearCover}
                      className="min-h-9 rounded-full px-3 text-[12px] font-bold text-[#9485BE] transition active:opacity-60"
                    >
                      다시 선택
                    </button>
                  ) : null}
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg"
                  className="sr-only"
                  onChange={handleCoverChange}
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-2 flex min-h-[138px] w-full items-center justify-center overflow-hidden rounded-[18px] border border-dashed border-[#CFC8DA] bg-white text-left shadow-[0_4px_12px_rgba(42,40,48,0.04)] transition active:scale-[0.99]"
                >
                  {coverPreview ? (
                    <span className="relative block h-[154px] w-full">
                      <img src={coverPreview} alt="" className="h-full w-full object-cover" />
                      <span className="absolute inset-x-3 bottom-3 rounded-[12px] bg-white/92 px-3 py-2 text-[12px] font-bold leading-[18px] text-[#2A2830] shadow-[0_4px_12px_rgba(42,40,48,0.12)]">
                        <span className="block truncate">{coverFileName}</span>
                      </span>
                    </span>
                  ) : (
                    <span className="flex flex-col items-center justify-center px-4 text-center">
                      <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-[#EDE8F0] text-[#7A767F]">
                        <ImagePlus className="h-6 w-6" aria-hidden="true" />
                      </span>
                      <span className="mt-3 text-[14px] font-bold leading-[21px] text-[#2A2830]">사진을 선택해주세요</span>
                      <span className="mt-1 text-[12px] font-medium leading-[18px] text-[#B0B4BC]">JPG, PNG · 1장</span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={clearCover}
                  className="mx-auto mt-3 flex min-h-10 items-center justify-center px-4 text-[13px] font-bold leading-[19.5px] text-[#9485BE] transition active:opacity-60"
                >
                  표지 설정 나중에 하기
                </button>
              </section>
            </>
          ) : step === 2 ? (
            <section className="mt-5 space-y-6" aria-labelledby="parent-info-heading">
              <h2 id="parent-info-heading" className="sr-only">부모님 기본 정보</h2>

              <div>
                <FieldLabel htmlFor="parent-name">부모님 이름 또는 호칭</FieldLabel>
                <div className="mt-2 rounded-[10px] border border-[#E0DBE8] bg-white px-4 py-3.5 focus-within:border-[#9485BE]">
                  <input
                    id="parent-name"
                    value={parentName}
                    onChange={(event) => setParentName(event.target.value.slice(0, MAX_PARENT_NAME_LENGTH))}
                    maxLength={MAX_PARENT_NAME_LENGTH}
                    placeholder="예: 엄마, 김영숙"
                    className="h-[23px] w-full bg-transparent text-[14px] font-normal text-[#2A2830] outline-none placeholder:text-[#7A767F]/50"
                  />
                </div>
                <p className="mt-1.5 pl-0.5 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                  부르시는 이름이나 호칭으로 입력해주세요
                </p>
              </div>

              <div>
                <FieldLabel>생년월일</FieldLabel>
                <button
                  type="button"
                  onClick={() => setShowBirthDateSheet(true)}
                  className="mt-2 flex h-[51px] w-full items-center rounded-[10px] border border-[#E0DBE8] bg-white px-4 text-left text-[14px] font-normal text-[#2A2830] transition active:opacity-70"
                  aria-label="생년월일 선택"
                >
                  <span className={parentBirthDate ? 'text-[#2A2830]' : 'text-[#7A767F]/50'}>
                    {parentBirthDate || '예: 1952'}
                  </span>
                </button>
                <div className="sr-only" aria-live="polite">
                  {parentBirthDate ? `선택된 생년월일 ${parentBirthDate}` : '생년월일을 선택하지 않았습니다'}
                </div>
              </div>

              <div>
                <FieldLabel>나와의 관계</FieldLabel>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {RELATIONSHIPS.map((item) => {
                    const active = item === selectedRelationship
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setSelectedRelationship(item)}
                        className={`min-h-[42px] rounded-[10px] border px-1 text-[13px] font-bold leading-[19.5px] tracking-[0.325px] transition active:scale-[0.98] ${
                          active
                            ? 'border-[#2A2830] bg-[#2A2830] text-[#F7F5FB]'
                            : 'border-[#E0DBE8] bg-white text-[#2A2830]'
                        }`}
                        aria-pressed={active}
                      >
                        {item}
                      </button>
                    )
                  })}
                </div>
              </div>
            </section>
          ) : step === 3 ? (
            <section className="mt-5 space-y-6" aria-labelledby="parent-life-heading">
              <h2 id="parent-life-heading" className="sr-only">부모님 생활 정보</h2>

              <div>
                <FieldLabel>현재 직업 유무</FieldLabel>
                <div className="mt-2 rounded-[14px] border border-[#E0DBE8] bg-white p-[5px]">
                  <div className="grid grid-cols-2 gap-1">
                    {[
                      { label: 'O', value: true, aria: '현재 직업 있음' },
                      { label: 'X', value: false, aria: '현재 직업 없음' },
                    ].map((option) => {
                      const active = hasCurrentJob === option.value
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => setHasCurrentJob(option.value)}
                          className={`min-h-[40px] rounded-[10px] text-[13px] font-medium leading-[19.5px] transition active:scale-[0.98] ${
                            active ? 'bg-[#2A2830] text-[#F8F6F9]' : 'bg-transparent text-[#7A767F]'
                          }`}
                          aria-label={option.aria}
                          aria-pressed={active}
                        >
                          {option.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <p className="mt-2 pl-0.5 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                  은퇴하셨을 경우 기존의 직업을 입력해주세요
                </p>
              </div>

              <div>
                <FieldLabel htmlFor="parent-occupation">직업명</FieldLabel>
                <div className="mt-2 rounded-[10px] border border-[#E0DBE8] bg-white px-4 py-3.5 focus-within:border-[#9485BE]">
                  <input
                    id="parent-occupation"
                    value={occupation}
                    onChange={(event) => setOccupation(event.target.value.slice(0, MAX_PARENT_DETAIL_LENGTH))}
                    maxLength={MAX_PARENT_DETAIL_LENGTH}
                    placeholder="예: 교사, 건축가"
                    className="h-[23px] w-full bg-transparent text-[14px] font-normal text-[#2A2830] outline-none placeholder:text-[#7A767F]/50"
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="parent-hometown">고향</FieldLabel>
                <div className="mt-2 rounded-[10px] border border-[#E0DBE8] bg-white px-4 py-3.5 focus-within:border-[#9485BE]">
                  <input
                    id="parent-hometown"
                    value={hometown}
                    onChange={(event) => setHometown(event.target.value.slice(0, MAX_PARENT_DETAIL_LENGTH))}
                    maxLength={MAX_PARENT_DETAIL_LENGTH}
                    placeholder="예: 강원도 춘천, 경기도 수원"
                    className="h-[23px] w-full bg-transparent text-[14px] font-normal text-[#2A2830] outline-none placeholder:text-[#7A767F]/50"
                  />
                </div>
              </div>

              <div>
                <FieldLabel htmlFor="parent-school-history">출신 학교</FieldLabel>
                <div className="mt-2 rounded-[10px] border border-[#E0DBE8] bg-white px-4 py-3.5 focus-within:border-[#9485BE]">
                  <input
                    id="parent-school-history"
                    value={schoolHistory}
                    onChange={(event) => setSchoolHistory(event.target.value.slice(0, MAX_PARENT_DETAIL_LENGTH))}
                    maxLength={MAX_PARENT_DETAIL_LENGTH}
                    placeholder="초/중/고/대학교 순으로 적어주세요."
                    className="h-[23px] w-full bg-transparent text-[14px] font-normal text-[#2A2830] outline-none placeholder:text-[#7A767F]/50"
                  />
                </div>
                <p className="mt-2 pl-0.5 text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
                  기억과 관련된 학창 시절 질문을 추천하는 데 사용됩니다.
                </p>
              </div>
            </section>
          ) : (
            <section className="mt-5 flex min-h-[470px] flex-col" aria-labelledby="parent-invite-heading">
              <h2 id="parent-invite-heading" className="sr-only">부모님 초대</h2>

              <div className="rounded-[14px] border border-[#E0DBE8] bg-white px-5 py-5">
                <div className="flex min-w-0 items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#EDE8F0] font-serif text-[16px] font-semibold leading-6 text-[#2A2830]">
                    {profilePreview ? (
                      <img src={profilePreview} alt="" className="h-full w-full object-cover" />
                    ) : (
                      invitationInitial
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate font-serif text-[15px] font-semibold leading-[22.5px] text-[#2A2830]">
                      {invitationDisplayName}
                    </p>
                    <p className="mt-0.5 truncate text-[12px] font-normal leading-[18px] text-[#7A767F]">
                      {parentBirthYear ? `${parentBirthYear}년생 · ` : ''}{resolvedRelationship}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-8 space-y-3">
                <button
                  type="button"
                  onClick={() => void handleInviteShare('kakao')}
                  disabled={!invitationReady || invitePreparing || !!sharePending || submitting}
                  className="flex min-h-[51px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#FAE300] px-5 text-[14px] font-bold leading-[21px] tracking-[0.42px] text-[#1A1300] transition active:scale-[0.99] disabled:opacity-60"
                >
                  {sharePending === 'kakao' || (invitePreparing && !invitationReady) ? (
                    <Loader2 className="h-[18px] w-[18px] animate-spin" aria-hidden="true" />
                  ) : (
                    <MessageCircle className="h-[18px] w-[18px] fill-[#1A1300]" aria-hidden="true" />
                  )}
                  {invitePreparing && !invitationReady ? '초대 링크 준비 중...' : '카카오톡으로 초대하기'}
                </button>

                <button
                  type="button"
                  onClick={() => void handleInviteShare('link')}
                  disabled={!invitationReady || invitePreparing || !!sharePending || submitting}
                  className="flex min-h-[51px] w-full items-center justify-center gap-2 rounded-[14px] border border-[#E0DBE8] bg-white px-5 text-[14px] font-medium leading-[21px] tracking-[0.42px] text-[#2A2830] transition active:scale-[0.99] disabled:opacity-60"
                >
                  {sharePending === 'link' ? (
                    <Loader2 className="h-[15px] w-[15px] animate-spin text-[#9485BE]" aria-hidden="true" />
                  ) : (
                    <Link2 className="h-[15px] w-[15px] text-[#9485BE]" aria-hidden="true" />
                  )}
                  링크로 초대하기
                </button>
              </div>

              <button
                type="button"
                onClick={() => void finalizeRecordSpace()}
                disabled={submitting || !!sharePending}
                className="mx-auto mt-auto min-h-11 px-4 text-center text-[12px] font-medium leading-[18px] tracking-[0.3px] text-[#7A767F] underline underline-offset-2 transition active:opacity-60 disabled:opacity-60"
              >
                나중에 하기
              </button>
            </section>
          )}

          {noticeMsg ? (
            <div
              role="status"
              className="mt-4 rounded-[12px] bg-white px-3 py-2 text-[12px] font-medium leading-[18px] text-[#2A2830] shadow-[inset_0_0_0_1px_rgba(224,219,232,0.9)]"
            >
              {noticeMsg}
            </div>
          ) : null}

          {errorMsg ? (
            <div
              role="alert"
              className="mt-4 flex items-start gap-2 rounded-[12px] bg-[#F3EFF5] px-3 py-2 text-[12px] font-medium leading-[18px] text-[#2A2830]"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9485BE]" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          ) : null}
        </main>

        <footer className="shrink-0 border-t border-[#E0DBE8] bg-[#F8F6F9]/95 px-6 pb-[calc(env(safe-area-inset-bottom)+16px)] pt-3">
          <button
            type="submit"
            disabled={!canContinue || submitting || !!sharePending || (step === 4 && invitePreparing)}
            className="flex min-h-[56px] w-full items-center justify-center gap-2 rounded-[14px] bg-[#2A2830] px-5 text-[14px] font-bold leading-[21px] tracking-[0.84px] text-[#F7F5FB] shadow-[0_8px_18px_rgba(42,40,48,0.22)] transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-[#CFC8DA] disabled:shadow-none"
          >
            {submitting ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" /> : null}
            {submitting ? '생성 중...' : step === 4 && invitePreparing ? '초대 링크 준비 중...' : step === 4 ? '기록 공간 생성하기' : '다음'}
          </button>
        </footer>
      </form>

      {showBirthDateSheet ? (
        <div className="fixed inset-0 z-50 mx-auto flex max-w-[390px] items-end bg-[rgba(28,25,32,0.48)]">
          <div className="w-full rounded-t-[28px] bg-white px-6 pb-10 pt-5 shadow-[0_-8px_24px_rgba(42,40,48,0.16)]">
            <div className="flex justify-center">
              <span className="h-1 w-10 rounded-full bg-[#E0DBE8]" />
            </div>
            <h2 className="mt-5 text-[13px] font-bold leading-[19.5px] text-[#2A2830]">생년월일 선택</h2>

            <div className="mt-5 grid grid-cols-[2fr_1fr_1fr] gap-3">
              <DateColumn label="년" values={YEARS} selected={selectedYear} onSelect={handleYearSelect} />
              <DateColumn label="월" values={MONTHS} selected={selectedMonth} onSelect={handleMonthSelect} />
              <DateColumn
                label="일"
                values={Array.from({ length: daysInMonth(selectedYear, selectedMonth) }, (_, index) => index + 1)}
                selected={selectedDay}
                onSelect={setSelectedDay}
              />
            </div>

            <button
              type="button"
              onClick={confirmBirthDate}
              className="mt-6 flex min-h-[50px] w-full items-center justify-center rounded-[14px] bg-[#2A2830] text-[14px] font-bold leading-[21px] tracking-[0.84px] text-[#F7F5FB] transition active:scale-[0.99]"
            >
              선택 완료
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
