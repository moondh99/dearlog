import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { loginWithInvitationToken } from '../lib/local-server'
import { useAuthStore } from '../store/authStore'

export default function AutoLoginScreen() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { setTokenLoginState } = useAuthStore()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const token = searchParams.get('token')
    if (!token) {
      setError('초대 링크가 올바르지 않습니다. 다시 확인해 주세요.')
      return
    }

    const runLogin = async () => {
      try {
        const res = await loginWithInvitationToken(token)
        if (res && res.user) {
          const user = res.user
          setTokenLoginState(user.id, user.name, user.phoneNumber || '', res.authToken)
          if (!user.birthDecade) {
            navigate('/parent/welcome', { state: { guardianName: user.guardianName }, replace: true })
          } else {
            navigate('/parent', { replace: true })
          }
        } else {
          setError('초대 유효성 검증에 실패했습니다. 다시 요청해 주세요.')
        }
      } catch (e) {
        console.error('Token login error:', e)
        setError(e instanceof Error ? e.message : '서버 연결 중 오류가 발생했습니다. 나중에 다시 시도해 주세요.')
      }
    }

    // 약간의 딜레이를 주어 부드러운 전환 효과를 연출합니다.
    const timer = setTimeout(runLogin, 1200)
    return () => clearTimeout(timer)
  }, [searchParams, setTokenLoginState, navigate])

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#F8F6F9] px-6 text-center">
      {error ? (
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#FF3B30]/10 flex items-center justify-center text-[28px]">
            ⚠️
          </div>
          <h2 className="text-[20px] font-bold text-[#2A2830]">접속 오류</h2>
          <p className="text-[15px] text-[#7A767F] leading-relaxed max-w-[280px]">
            {error}
          </p>
          <button
            onClick={() => navigate('/auth', { replace: true })}
            className="mt-4 px-5 py-2.5 rounded-xl bg-[#2A2830] text-white text-[14px] font-medium active:opacity-80"
          >
            로그인 화면으로 이동
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-5">
          {/* Pulse animation icon */}
          <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full animate-ping opacity-15" style={{ backgroundColor: '#9485BE' }} />
            <div className="absolute w-20 h-20 rounded-full animate-pulse opacity-20" style={{ backgroundColor: '#9485BE' }} />
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center text-[28px] shadow-sm z-10">
              ✉️
            </div>
          </div>

          <div className="flex flex-col gap-1.5 mt-2">
            <h2 className="text-[18px] font-bold text-[#2A2830]">초대장을 확인하고 있어요</h2>
            <p className="text-[14px] text-[#7A767F]">부모님 이야기를 모실 준비 중입니다...</p>
          </div>

          {/* Bouncing loading dots */}
          <div className="flex gap-1.5 items-center justify-center mt-3 h-5">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="w-2.5 h-2.5 rounded-full bg-[#9485BE] animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
