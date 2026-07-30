import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { updateLocalUserProfile } from '../lib/local-server'
import Button from '../components/Button'

const DECADES = ['1930년대', '1940년대', '1950년대', '1960년대', '1970년대']

export default function ParentWelcomeScreen() {
  const navigate = useNavigate()
  const location = useLocation()
  const { userId, userName } = useAuthStore()

  // Extract child's name from location state
  const guardianName = (location.state as any)?.guardianName || '자녀'

  const [preferredName, setPreferredName] = useState(userName || '')
  const [birthDecade, setBirthDecade] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async () => {
    if (!preferredName.trim()) {
      setError('이름이나 호칭을 입력해 주세요.')
      return
    }
    if (!birthDecade) {
      setError('출생 연대를 선택해 주세요.')
      return
    }

    setLoading(false)
    if (!userId) return

    try {
      setLoading(true)
      const res = await updateLocalUserProfile({
        userId,
        role: 'senior',
        name: preferredName.trim(),
        preferredName: preferredName.trim(),
        birthDecade,
      })

      // Update name locally in Zustand store
      useAuthStore.setState({ userName: preferredName.trim(), authToken: res.authToken })

      // Navigate to Parent Home
      navigate('/parent', { replace: true })
    } catch (e) {
      console.error('Onboarding profile save error:', e)
      setError('정보 저장 중 오류가 발생했습니다. 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col justify-between bg-[#F8F6F9] px-6 py-12">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="absolute left-5 top-12 flex h-10 min-w-10 items-center justify-center rounded-full bg-white/80 text-[#2A2830] shadow-[0_2px_10px_rgba(42,40,48,0.08)] transition active:scale-95"
        aria-label="이전 화면으로"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden="true" />
      </button>

      {/* Top Greeting */}
      <div className="flex flex-col items-center text-center mt-6">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-24 h-24 rounded-full bg-[#2A2830]/10 animate-pulse" />
          <div className="w-16 h-16 rounded-full bg-[#EDE8F0] flex items-center justify-center text-[28px] shadow-sm z-10">
            🌸
          </div>
        </div>

        <h1 className="text-[22px] font-bold text-[#2A2830] leading-snug">
          반갑습니다, 어르신!
        </h1>
        <p className="mt-2 text-[15px] text-[#7A767F] leading-relaxed max-w-[280px]">
          자녀 <span className="font-semibold text-[#2A2830]">{guardianName}</span>님이
          부모님의 소중한 삶의 기억을 담아내기 위해 <strong>디어로그</strong>에 모셨습니다.
        </p>
      </div>

      {/* Inputs Form */}
      <div className="flex flex-col gap-6 my-8 flex-1 justify-center">
        {/* Name Input */}
        <div>
          <label className="block text-[15px] font-bold text-[#2A2830] mb-2">
            1. 뭐라고 불러드리면 좋을까요?
          </label>
          <input
            type="text"
            value={preferredName}
            onChange={(e) => {
              setPreferredName(e.target.value)
              setError(null)
            }}
            placeholder="예: 엄마, 아버지, 김영자 등"
            className="w-full min-h-[52px] px-4 rounded-xl border bg-[#FFFFFF] text-[16px] text-[#2A2830] placeholder:text-[#E0DBE8] outline-none transition-colors"
            style={{ borderColor: '#E0DBE8' }}
            onFocus={(e) => (e.target.style.borderColor = '#2A2830')}
            onBlur={(e) => (e.target.style.borderColor = '#E0DBE8')}
          />
        </div>

        {/* Decade Selector */}
        <div>
          <label className="block text-[15px] font-bold text-[#2A2830] mb-2.5">
            2. 몇 년도 즈음 태어나셨나요?
          </label>
          <p className="text-[12px] text-[#7A767F] -mt-1.5 mb-3">
            어르신의 청춘 시대를 돌아보는 맞춤형 질문을 준비하는 데 사용됩니다.
          </p>
          <div className="flex flex-wrap gap-2">
            {DECADES.map((dec) => {
              const selected = birthDecade === dec
              return (
                <button
                  key={dec}
                  onClick={() => {
                    setBirthDecade(dec)
                    setError(null)
                  }}
                  className="px-4 py-2.5 rounded-full text-[14px] font-medium transition-all active:scale-95 cursor-pointer"
                  style={{
                    backgroundColor: selected ? '#2A2830' : '#FFFFFF',
                    color: selected ? '#FFFFFF' : '#7A767F',
                    border: '1px solid',
                    borderColor: selected ? '#2A2830' : '#E0DBE8',
                  }}
                >
                  {dec}
                </button>
              )
            })}
          </div>
        </div>

        {error && (
          <p className="text-[#FF3B30] text-[13px] text-center font-medium animate-bounce mt-1">
            ⚠️ {error}
          </p>
        )}
      </div>

      {/* CTA Button */}
      <div className="pb-6">
        <Button fullWidth disabled={loading} onClick={handleStart}>
          {loading ? '기억 보관소 준비 중...' : '소중한 이야기 시작하기 📖'}
        </Button>
      </div>
    </div>
  )
}
