import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertCircle, ArrowLeft, ArrowRight, Camera, Check } from 'lucide-react'
import Button from '../components/Button'
import parentAuthMascot from '../assets/figma/parent-auth-mascot.png'
import { useAuthStore } from '../store/authStore'

type Tab = 'login' | 'signup'
type SignupStep = 'phone' | 'code' | 'details' | 'consent'

const PHONE_ERROR_MESSAGE = '휴대폰 번호를 010-0000-0000 형식으로 입력해 주세요.'
const BIRTH_DATE_ERROR_MESSAGE = '생년월일을 1999-02-04 형식으로 입력해 주세요.'

function phoneDigits(value: string) {
  return value.replace(/[^\d]/g, '').slice(0, 11)
}

function formatKoreanPhoneNumber(value: string) {
  const digits = phoneDigits(value)
  if (digits.length <= 3) return digits
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`
}

function isCompletePhoneNumber(value: string) {
  return /^01[016789]\d{7,8}$/.test(phoneDigits(value))
}

function formatBirthDate(value: string) {
  const digits = value.replace(/[^\d]/g, '').slice(0, 8)
  if (digits.length <= 4) return digits
  if (digits.length <= 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`
  return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}`
}

function isValidBirthDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(year, month - 1, day)
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day
}

export default function AuthScreen() {
  const navigate = useNavigate()
  const { setUserName } = useAuthStore()
  const [tab, setTab] = useState<Tab | null>(null)
  const [signupStep, setSignupStep] = useState<SignupStep>('phone')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [verificationCode, setVerificationCode] = useState('')
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyAgreed, setPrivacyAgreed] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [inviteHint, setInviteHint] = useState(false)
  const verificationInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (tab === 'signup' && signupStep === 'code') {
      requestAnimationFrame(() => verificationInputRef.current?.focus())
    }
  }, [tab, signupStep])

  const startAuthFlow = (t: Tab) => {
    setTab(t)
    setSignupStep(t === 'signup' ? 'phone' : 'details')
    setErrorMsg(null)
    setInviteHint(false)
  }

  const handleTabChange = (t: Tab) => {
    setTab(t)
    if (t === 'login') {
      setSignupStep('details')
    } else {
      setSignupStep('phone')
    }
    setErrorMsg(null)
    setInviteHint(false)
  }

  const handleSignupPhoneSubmit = () => {
    if (!isCompletePhoneNumber(phone)) {
      setErrorMsg(PHONE_ERROR_MESSAGE)
      return
    }
    setVerificationCode('')
    setSignupStep('code')
    setErrorMsg(null)
  }

  const handleVerificationSubmit = () => {
    if (verificationCode.length !== 6) return
    setSignupStep('details')
    setErrorMsg(null)
  }

  const handleProfileSubmit = () => {
    if (!name.trim()) return
    if (!isValidBirthDate(birthDate)) {
      setErrorMsg(BIRTH_DATE_ERROR_MESSAGE)
      return
    }
    setSignupStep('consent')
    setErrorMsg(null)
  }

  const handleSubmit = async () => {
    if (!tab || !name.trim() || !phone.trim()) return
    if (tab === 'signup' && (!termsAgreed || !privacyAgreed)) return
    if (!isCompletePhoneNumber(phone)) {
      setErrorMsg(PHONE_ERROR_MESSAGE)
      return
    }
    if (tab === 'signup' && !isValidBirthDate(birthDate)) {
      setSignupStep('details')
      setErrorMsg(BIRTH_DATE_ERROR_MESSAGE)
      return
    }
    setErrorMsg(null)
    try {
      await setUserName(name.trim(), phone.trim(), tab === 'login', tab === 'signup' ? birthDate.trim() : undefined)
      const updatedRole = useAuthStore.getState().role
      if (updatedRole === 'parent') {
        navigate('/parent')
      } else {
        navigate('/child')
      }
    } catch (e: any) {
      setErrorMsg(e.message || '인증에 실패했습니다. 다시 시도해 주세요.')
    }
  }

  const isSubmitDisabled = !name.trim() || !isCompletePhoneNumber(phone)
  const isSignupProfileDisabled = !name.trim() || !isValidBirthDate(birthDate)
  const isConsentSubmitDisabled = !termsAgreed || !privacyAgreed
  const activeTab = tab ?? 'login'
  const eyebrow = activeTab === 'login' ? '로그인' : '회원가입'
  const helperText =
    activeTab === 'login'
      ? '등록된 이름과 휴대폰 번호로 이어서 기록을 확인하세요.'
      : '이름과 휴대폰 번호를 입력하면 가족 기록을 시작할 수 있어요.'

  if (!tab) {
    return (
      <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2A2830]">
        <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
          <main className="relative min-h-[807.5px] shrink-0">
            <p className="absolute left-[96.75px] top-[178.5px] h-[19.683px] w-[173.864px] text-[12.028px] font-medium uppercase leading-[16.402px] tracking-[3.8272px] text-[#2A2830]">
              FAMILY ARCHIVE
            </p>
            <h1 className="absolute left-1/2 top-[198.98px] -translate-x-1/2 font-serif text-[58px] font-semibold leading-[68.093px] text-[#183025]">
              Dearlog
            </h1>

            <img
              src={parentAuthMascot}
              alt=""
              className="absolute left-[95px] top-[370.5px] h-[139px] w-[198px] object-cover object-[center_43%]"
            />

            {inviteHint ? (
              <p className="absolute left-6 top-[552px] w-[340px] rounded-[14px] border border-[#E0DBE8] bg-white/75 px-4 py-3 text-center text-[12px] font-normal leading-[18px] text-[#7A767F]">
                보호자가 보낸 초대 링크를 그대로 열어주세요.
                <br />
                주소에 token이 포함되어야 합니다.
              </p>
            ) : null}

            <div className="absolute left-6 top-[620px] flex w-[340px] flex-col gap-[14px]">
              <button
                type="button"
                onClick={() => startAuthFlow('signup')}
                className="h-[51px] rounded-[14px] bg-[#2A2830] text-center text-[14px] font-medium leading-[21px] tracking-[0.06em] text-[#F7F5FB] transition-transform active:scale-[0.99]"
              >
                회원가입
              </button>
              <button
                type="button"
                onClick={() => startAuthFlow('login')}
                className="h-[51px] rounded-[14px] border border-[#2A2830] bg-[#F8F6F9] text-center text-[14px] font-medium leading-[21px] tracking-[0.06em] text-[#2A2830] transition-transform active:scale-[0.99]"
              >
                로그인
              </button>
            </div>

            <button
              type="button"
              onClick={() => setInviteHint((visible) => !visible)}
              className="absolute left-1/2 top-[752px] -translate-x-1/2 whitespace-nowrap text-center text-[12px] font-medium leading-[18px] tracking-[0.025em] text-[#7A767F] underline underline-offset-2"
            >
              부모님 초대 링크로 들어왔어요
            </button>
          </main>
        </div>
      </div>
    )
  }

  if (tab === 'signup' && signupStep === 'phone') {
    return (
      <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2A2830]">
        <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
          <main className="relative min-h-[807.5px] shrink-0">
            <div className="absolute left-6 top-0 flex h-16 w-[340px] items-center pb-10 pt-2">
              <button
                type="button"
                onClick={() => {
                  setTab(null)
                  setErrorMsg(null)
                }}
                className="-ml-1 flex h-10 w-10 items-center justify-start text-[#7A767F] transition active:opacity-70"
                aria-label="이전 화면으로"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="absolute left-6 top-16 w-[340px] text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
              회원가입
            </p>
            <h1 className="absolute left-6 top-[91px] font-serif text-[26px] font-normal leading-[35.1px] text-[#2A2830]">
              휴대폰 번호로
              <br />
              계정을 만들어주세요
            </h1>
            <p className="absolute left-6 top-[169.19px] w-[340px] text-[12px] font-normal leading-[18px] text-[#7A767F]">
              번호로 인증 후 바로 시작할 수 있어요.
            </p>

            <label className="absolute left-6 top-[227.19px] w-[340px]">
              <span className="block text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]">
                휴대폰 번호
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={13}
                value={phone}
                onChange={(e) => {
                  setPhone(formatKoreanPhoneNumber(e.target.value))
                  setErrorMsg(null)
                }}
                placeholder="010-0000-0000"
                className="mt-[9.81px] h-11 w-full rounded-[14px] border border-[#E0DBE8] bg-white px-4 text-[16px] font-normal tracking-[1.6px] text-[#2A2830] outline-none transition placeholder:text-[#7A767F]/50 focus:border-[#9485BE] focus:ring-4 focus:ring-[#9485BE]/10"
              />
            </label>

            {errorMsg && (
              <div className="absolute left-6 top-[360px] flex w-[340px] items-start gap-3 rounded-[14px] border border-[#FF3B30]/20 bg-[#FF3B30]/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF3B30]" aria-hidden="true" />
                <p className="text-[13px] font-medium leading-relaxed text-[#FF3B30]">
                  {errorMsg}
                </p>
              </div>
            )}

            <p className="absolute left-6 top-[319.69px] w-[340px] text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
              인증번호가 문자로 전송됩니다.
            </p>

            <button
              type="button"
              onClick={handleSignupPhoneSubmit}
              disabled={!phone.trim()}
              className="absolute left-6 top-[716.5px] h-[51px] w-[340px] rounded-[14px] bg-[#2A2830] text-center text-[14px] font-medium leading-[21px] tracking-[0.06em] text-[#F7F5FB] transition-transform active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
            >
              인증번호 받기
            </button>
          </main>
        </div>
      </div>
    )
  }

  if (tab === 'signup' && signupStep === 'code') {
    return (
      <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2A2830]">
        <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
          <main className="relative min-h-[807.5px] shrink-0">
            <div className="absolute left-6 top-0 flex h-16 w-[340px] items-center pb-10 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSignupStep('phone')
                  setVerificationCode('')
                  setErrorMsg(null)
                }}
                className="-ml-1 flex h-10 w-10 items-center justify-start text-[#7A767F] transition active:opacity-70"
                aria-label="이전 화면으로"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="absolute left-6 top-16 w-[340px] text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
              회원가입
            </p>
            <h1 className="absolute left-6 top-[91px] font-serif text-[26px] font-normal leading-[35.1px] text-[#2A2830]">
              인증번호를
              <br />
              입력해주세요
            </h1>
            <p className="absolute left-6 top-[169.19px] w-[340px] text-[12px] font-normal leading-[18px] text-[#7A767F]">
              {phone ? `${phone}로 전송된` : '문자로 전송된'} 6자리 번호를 입력해주세요.
            </p>

            <label className="absolute left-6 top-[227.19px] w-[340px]">
              <span className="block text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]">
                인증번호
              </span>
              <input
                aria-label="인증번호"
                ref={verificationInputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={verificationCode}
                onChange={(e) => {
                  setVerificationCode(e.target.value.replace(/[^\d]/g, '').slice(0, 6))
                  setErrorMsg(null)
                }}
                className="absolute inset-x-0 top-[26.31px] z-10 h-11 w-full cursor-text opacity-0"
              />
              <div className="mt-[9.81px] grid h-11 grid-cols-6 gap-2" aria-hidden="true">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-center rounded-[14px] border border-[#E0DBE8] bg-white font-serif text-[18px] text-[#2A2830]"
                  >
                    {verificationCode[index] ?? <span className="text-[#7A767F]/35">·</span>}
                  </div>
                ))}
              </div>
            </label>

            <p className="absolute left-6 top-[319.69px] w-[340px] text-[11px] font-normal leading-[16.5px] text-[#7A767F]">
              인증번호가 오지 않으면 휴대폰 번호를 다시 확인해주세요.
            </p>

            <button
              type="button"
              onClick={handleVerificationSubmit}
              disabled={verificationCode.length !== 6}
              className="absolute left-6 top-[716.5px] h-[51px] w-[340px] rounded-[14px] bg-[#2A2830] text-center text-[14px] font-medium leading-[21px] tracking-[0.06em] text-[#F7F5FB] transition-transform active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
            >
              인증하기
            </button>
          </main>
        </div>
      </div>
    )
  }

  if (tab === 'signup' && signupStep === 'details') {
    return (
      <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2A2830]">
        <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
          <main className="relative min-h-[807.5px] shrink-0">
            <div className="absolute left-6 top-0 flex h-8 w-[340px] items-center py-2">
              <button
                type="button"
                onClick={() => {
                  setSignupStep('code')
                  setErrorMsg(null)
                }}
                className="-ml-1 flex h-10 w-10 items-center justify-start text-[#7A767F] transition active:opacity-70"
                aria-label="이전 화면으로"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="absolute left-6 top-16 w-[340px] text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
              프로필 설정
            </p>
            <h1 className="absolute left-6 top-[94.5px] font-serif text-[26px] font-normal leading-[35.1px] text-[#2A2830]">
              프로필을 설정해주세요
            </h1>
            <p className="absolute left-6 top-[137.5px] w-[340px] text-[12px] font-normal leading-[18px] text-[#7A767F]">
              기록을 시작하기 전에 이름이나 닉네임을 알려주세요.
            </p>

            <div className="absolute left-[152px] top-[193.5px] flex h-[84px] w-[84px] items-center justify-center rounded-full bg-[#EDE8F0]">
              <Camera className="h-5 w-5 text-[#7A767F]" aria-hidden="true" />
            </div>

            <label className="absolute left-6 top-[308.19px] w-[340px]">
              <span className="block text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]">
                이름 또는 닉네임
              </span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="예: 민준, 김민준"
                className="mt-[10.81px] h-11 w-full rounded-[14px] border border-[#E0DBE8] bg-white px-4 font-serif text-[16px] font-normal text-[#2A2830] outline-none transition placeholder:text-[#7A767F]/50 focus:border-[#9485BE] focus:ring-4 focus:ring-[#9485BE]/10"
              />
            </label>

            <label className="absolute left-6 top-[390.5px] w-[340px]">
              <span className="block text-[11px] font-medium uppercase leading-[16.5px] tracking-[1.65px] text-[#7A767F]">
                생년월일
              </span>
              <input
                type="text"
                inputMode="numeric"
                maxLength={10}
                value={birthDate}
                onChange={(e) => {
                  setBirthDate(formatBirthDate(e.target.value))
                  setErrorMsg(null)
                }}
                placeholder="예: 1997-07-04"
                className="mt-[10.81px] h-11 w-full rounded-[14px] border border-[#E0DBE8] bg-white px-4 font-serif text-[16px] font-normal text-[#2A2830] outline-none transition placeholder:text-[#7A767F]/50 focus:border-[#9485BE] focus:ring-4 focus:ring-[#9485BE]/10"
              />
            </label>

            {errorMsg && (
              <div className="absolute left-6 top-[488px] flex w-[340px] items-start gap-3 rounded-[14px] border border-[#FF3B30]/20 bg-[#FF3B30]/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF3B30]" aria-hidden="true" />
                <p className="text-[13px] font-medium leading-relaxed text-[#FF3B30]">
                  {errorMsg}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleProfileSubmit}
              disabled={isSignupProfileDisabled}
              className="absolute left-6 top-[716.5px] h-[51px] w-[340px] rounded-[14px] bg-[#2A2830] text-center text-[14px] font-medium leading-[21px] tracking-[0.06em] text-[#F7F5FB] transition-transform active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
            >
              다음
            </button>
          </main>
        </div>
      </div>
    )
  }

  if (tab === 'signup' && signupStep === 'consent') {
    return (
      <div className="h-[100dvh] min-h-[100dvh] overflow-y-auto bg-[#F8F6F9] text-[#2A2830]">
        <div className="mx-auto flex min-h-[844px] w-full max-w-[388px] flex-col bg-[#F8F6F9]">
          <main className="relative min-h-[807.5px] shrink-0">
            <div className="absolute left-6 top-0 flex h-8 w-[340px] items-center py-2">
              <button
                type="button"
                onClick={() => {
                  setSignupStep('details')
                  setErrorMsg(null)
                }}
                className="-ml-1 flex h-10 w-10 items-center justify-start text-[#7A767F] transition active:opacity-70"
                aria-label="이전 화면으로"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <p className="absolute left-6 top-16 w-[340px] text-[10px] font-medium uppercase leading-[15px] tracking-[2.2px] text-[#7A767F]">
              동의 안내
            </p>
            <h1 className="absolute left-6 top-[91px] font-serif text-[26px] font-normal leading-[35.1px] text-[#2A2830]">
              기록은 동의 후
              <br />
              시작됩니다
            </h1>
            <div className="absolute left-6 top-[174.19px] flex h-[22.75px] w-[340px] items-start border-l-2 border-[#9485BE] pl-[18px]">
              <p className="font-serif text-[13px] font-normal leading-[22.75px] text-[#2A2830]">
                부모님의 동의 없이 기록을 시작하지 않습니다.
              </p>
            </div>
            <div className="absolute left-6 top-[210.94px] h-px w-[340px] bg-[#E0DBE8]" />

            <div className="absolute left-6 top-[230.94px] flex w-[340px] flex-col gap-5">
              <div className="relative min-h-[49.13px] pl-8">
                <input
                  id="terms-consent"
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(event) => setTermsAgreed(event.target.checked)}
                  className="peer sr-only"
                />
                <label
                  htmlFor="terms-consent"
                  className="absolute left-0 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-[8px] border border-[#E0DBE8] bg-white text-white peer-checked:border-[#2A2830] peer-checked:bg-[#2A2830]"
                  aria-hidden="true"
                >
                  <Check className={`h-3.5 w-3.5 ${termsAgreed ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                </label>
                <label
                  htmlFor="terms-consent"
                  className="block cursor-pointer text-[13px] font-medium leading-[21.125px] text-[#2A2830]"
                >
                  <span className="text-[10px] leading-[16.25px] text-[#9485BE]">[필수] </span>
                  서비스 이용약관 동의
                </label>
                <button
                  type="button"
                  className="mt-1 text-[11px] font-medium leading-[16.5px] text-[#7A767F] underline underline-offset-2"
                >
                  약관 전문 보기 →
                </button>
              </div>

              <div className="relative min-h-[49.13px] pl-8">
                <input
                  id="privacy-consent"
                  type="checkbox"
                  checked={privacyAgreed}
                  onChange={(event) => setPrivacyAgreed(event.target.checked)}
                  className="peer sr-only"
                />
                <label
                  htmlFor="privacy-consent"
                  className="absolute left-0 top-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-[8px] border border-[#E0DBE8] bg-white text-white peer-checked:border-[#2A2830] peer-checked:bg-[#2A2830]"
                  aria-hidden="true"
                >
                  <Check className={`h-3.5 w-3.5 ${privacyAgreed ? 'opacity-100' : 'opacity-0'}`} aria-hidden="true" />
                </label>
                <label
                  htmlFor="privacy-consent"
                  className="block cursor-pointer text-[13px] font-medium leading-[21.125px] text-[#2A2830]"
                >
                  <span className="text-[10px] leading-[16.25px] text-[#9485BE]">[필수] </span>
                  개인정보 처리방침 동의
                </label>
                <button
                  type="button"
                  className="mt-1 text-[11px] font-medium leading-[16.5px] text-[#7A767F] underline underline-offset-2"
                >
                  방침 전문 보기 →
                </button>
              </div>
            </div>

            {errorMsg && (
              <div className="absolute left-6 top-[606px] flex w-[340px] items-start gap-3 rounded-[14px] border border-[#FF3B30]/20 bg-[#FF3B30]/10 p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF3B30]" aria-hidden="true" />
                <p className="text-[13px] font-medium leading-relaxed text-[#FF3B30]">
                  {errorMsg}
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              disabled={isConsentSubmitDisabled}
              className="absolute left-6 top-[716.5px] flex h-[51px] w-[340px] items-center justify-center gap-3 rounded-[14px] bg-[#2A2830] text-center text-[14px] font-medium leading-[21px] tracking-[0.06em] text-[#F7F5FB] transition-transform active:scale-[0.99] disabled:opacity-40 disabled:active:scale-100"
            >
              <span>기록 시작하기</span>
              <ArrowRight className="h-[15px] w-[15px]" aria-hidden="true" />
            </button>
          </main>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] px-6 text-[#2A2830]">
      <div className="flex h-16 shrink-0 items-center">
        <button
          type="button"
          onClick={() => navigate('/intro')}
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[#7A767F] transition active:bg-[#EDE8F0]"
          aria-label="이전 화면으로"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>

      <header className="shrink-0 pb-7">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#7A767F]">
          {eyebrow}
        </p>
        <h1 className="mt-4 font-serif text-[30px] font-normal leading-[1.35] text-[#2A2830]">
          환영합니다
        </h1>
        <p className="mt-3 text-[13px] leading-[1.65] text-[#7A767F]">
          {helperText}
        </p>
      </header>

      <div className="mb-7 flex shrink-0 rounded-[14px] border border-[#E0DBE8] bg-white p-1">
        {(['login', 'signup'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => handleTabChange(t)}
            type="button"
            className="min-h-[44px] flex-1 rounded-[11px] text-[14px] font-medium transition-all"
            style={{
              backgroundColor: tab === t ? '#2A2830' : 'transparent',
              color: tab === t ? '#F7F5FB' : '#7A767F',
              boxShadow: tab === t ? '0 8px 18px rgba(42,40,48,0.12)' : 'none',
            }}
          >
            {t === 'login' ? '로그인' : '회원가입'}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        <div>
          <label className="mb-2 block text-[12px] font-medium text-[#7A767F]">이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="이름을 입력해주세요"
            className="h-[54px] w-full rounded-[14px] border border-[#E0DBE8] bg-white px-4 text-[15px] text-[#2A2830] outline-none transition placeholder:text-[rgba(122,118,127,0.42)] focus:border-[#9485BE] focus:ring-4 focus:ring-[#9485BE]/10"
          />
        </div>

        <div>
          <label className="mb-2 block text-[12px] font-medium text-[#7A767F]">전화번호</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={13}
            value={phone}
            onChange={(e) => {
              setPhone(formatKoreanPhoneNumber(e.target.value))
              setErrorMsg(null)
            }}
            placeholder="010-0000-0000"
            className="h-[54px] w-full rounded-[14px] border border-[#E0DBE8] bg-white px-4 text-[15px] text-[#2A2830] outline-none transition placeholder:text-[rgba(122,118,127,0.42)] focus:border-[#9485BE] focus:ring-4 focus:ring-[#9485BE]/10"
          />
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between border-t border-[#E0DBE8] pt-5">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-[#9485BE]" />
          <span className="text-[12px] text-[#7A767F]">휴대폰 본인 확인</span>
        </div>
        <span className="font-serif text-[13px] text-[#9485BE]">안전하게 보호됨</span>
      </div>

      <div className="mt-5 rounded-[14px] bg-[rgba(237,232,240,0.68)] px-4 py-4">
        <p className="text-[12px] leading-[1.7] text-[#7A767F]">
          입력하신 번호는 로그인 확인과 가족 계정 연결에만 사용됩니다.
        </p>
      </div>

      {errorMsg && (
        <div className="mt-5 flex items-start gap-3 rounded-[14px] border border-[#FF3B30]/20 bg-[#FF3B30]/10 p-4">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#FF3B30]" aria-hidden="true" />
          <p className="text-[13px] font-medium leading-relaxed text-[#FF3B30]">
            {errorMsg}
          </p>
        </div>
      )}

      <div className="mt-auto flex flex-col gap-3 pb-10 pt-8">
        <Button fullWidth disabled={isSubmitDisabled} onClick={handleSubmit}>
          {activeTab === 'login' ? '로그인' : '가입하기'}
        </Button>
        {activeTab === 'signup' && (
          <Button fullWidth variant="secondary" onClick={() => handleTabChange('login')}>
            이미 계정이 있어요
          </Button>
        )}
      </div>
    </div>
  )
}
