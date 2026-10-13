import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { requestLocalPhoneOtp, verifyLocalPhoneOtp } from '../lib/local-server'
import { useAuthStore } from '../store/authStore'
import './ReadOnlyService.css'

export default function ExistingLoginPage() {
  const navigate = useNavigate()
  const { role, userId, authToken, setUserName } = useAuthStore()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [codeSent, setCodeSent] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (role && userId && authToken) return <Navigate to={role === 'parent' ? '/parent' : '/child'} replace />

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const phoneNumber = phone.replace(/[^\d]/g, '')
    if (!name.trim() || !/^01[016789]\d{7,8}$/.test(phoneNumber)) {
      setError('등록한 이름과 올바른 휴대폰 번호를 입력해 주세요.')
      return
    }
    setBusy(true)
    setError(null)
    try {
      // 인증번호는 기존 계정 로그인에만 쓴다. 가입(signup) 목적으로는 요청하지 않는다.
      if (!codeSent) {
        // 로그인 인증번호는 계정에 등록된 이메일로 간다. 서버가 가린 주소를 돌려준다.
        const sent = await requestLocalPhoneOtp(phoneNumber, 'login')
        setSentTo(sent.sentTo ?? null)
        setCodeSent(true)
        return
      }
      const { verificationToken } = await verifyLocalPhoneOtp(phoneNumber, 'login', code.trim())
      await setUserName(name.trim(), phoneNumber, true, undefined, verificationToken)
      const session = useAuthStore.getState()
      if (!session.userId || !session.authToken || !session.role) throw new Error('로그인 정보를 확인하지 못했습니다.')
      navigate(session.role === 'parent' ? '/parent' : '/child', { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '기존 계정을 확인하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return <main className="readonly-service readonly-notice"><Link className="readonly-back" to="/company">← 디어로그 소개로</Link><p className="readonly-eyebrow">Dear Log · 기존 계정</p><h1>기존 계정 로그인</h1><p>등록한 이름과 휴대폰 번호를 확인하고 등록된 이메일로 받은 인증번호로 인증한 뒤 기존 기록을 조회합니다. 현재 신규 가입·초대·기록 입력은 중단되어 있습니다.</p><form onSubmit={submit} aria-label="기존 계정 로그인"><label htmlFor="existing-name">등록한 이름</label><input id="existing-name" name="name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} required maxLength={100} disabled={busy || codeSent} /><label htmlFor="existing-phone">등록한 휴대폰 번호</label><input id="existing-phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="010-0000-0000" value={phone} onChange={event => setPhone(event.target.value)} required maxLength={20} disabled={busy || codeSent} />{codeSent && <><p>{sentTo ? `${sentTo} 메일함으로 보낸` : '등록된 이메일로 보낸'} 6자리 번호를 입력해 주세요.</p><label htmlFor="existing-code">인증번호</label><input id="existing-code" name="code" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={event => setCode(event.target.value)} required maxLength={10} disabled={busy} /></>}{error && <p role="alert">{error}</p>}<button type="submit" disabled={busy}>{busy ? '확인하는 중…' : codeSent ? '기존 기록 조회 로그인' : '인증번호 받기'}</button></form><p className="readonly-note">새 계정을 만드는 화면이 아닙니다. 등록되지 않은 번호는 로그인되지 않습니다.</p><a href="mailto:hello@dear-log.com">계정 이용 문의: hello@dear-log.com</a></main>
}
