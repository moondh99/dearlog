import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types/user'

// 발표용 데모 시작 화면. 데모 서버가 발급한 토큰으로 가상 가족의 부모님/보호자로 바로 들어간다.
export default function DemoEntryPage() {
  const navigate = useNavigate()
  const [busy, setBusy] = useState<UserRole | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function start(role: UserRole) {
    setBusy(role)
    setError(null)
    try {
      const response = await fetch('/api/demo/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      })
      if (!response.ok) throw new Error('데모 서버에 연결하지 못했습니다. npm run demo:server 가 켜져 있는지 확인하세요.')
      const { user, authToken } = await response.json()
      // 이전 사용자의 가족 데이터 캐시가 남지 않게 먼저 비운다.
      useAuthStore.getState().reset()
      useAuthStore.setState({ role, userId: user.id, userName: user.name, phoneNumber: '', authToken })
      navigate(role === 'parent' ? '/parent' : '/child', { replace: true })
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : '데모를 시작하지 못했습니다.')
      setBusy(null)
    }
  }

  return (
    <main className="flex min-h-[100dvh] flex-col justify-center gap-4 px-6 text-[#2A2830]">
      <p className="text-[12px] tracking-[0.2em] text-[#9485BE]">DEAR LOG · DEMO</p>
      <h1 className="font-serif text-[26px] leading-tight">디어로그 시연</h1>
      <p className="text-[14px] leading-relaxed text-[#7A767F]">가상의 가족(김영자 어르신과 딸 이지은)으로 시작합니다. 실제 계정이나 데이터와 연결되지 않습니다.</p>
      <button type="button" disabled={busy !== null} onClick={() => start('parent')} className="h-[52px] rounded-[14px] bg-[#2A2830] text-[15px] font-medium text-[#F7F5FB] disabled:opacity-40">
        {busy === 'parent' ? '여는 중…' : '부모님(김영자)으로 시작'}
      </button>
      <button type="button" disabled={busy !== null} onClick={() => start('child')} className="h-[52px] rounded-[14px] border border-[#2A2830] text-[15px] font-medium disabled:opacity-40">
        {busy === 'child' ? '여는 중…' : '보호자(이지은)로 시작'}
      </button>
      {error && <p role="alert" className="text-[13px] text-[#FF3B30]">{error}</p>}
    </main>
  )
}
