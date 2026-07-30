import { type ReactElement, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Button from '../components/Button'
import { useAuthStore } from '../store/authStore'
import type { UserRole } from '../types/user'

function ParentIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Silver hair */}
      <path d="M15 26C15 17 20 12 30 12C40 12 45 17 45 26" fill="#E0DBE8" />
      {/* Head */}
      <circle cx="30" cy="26" r="13" fill="#EDE8F0" />
      {/* Eyes */}
      <circle cx="25" cy="25" r="1.8" fill="#2A2830" />
      <circle cx="35" cy="25" r="1.8" fill="#2A2830" />
      {/* Warm smile */}
      <path d="M24 31C24 31 27 34 30 34C33 34 36 31 36 31" stroke="#2A2830" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Body */}
      <path d="M14 54C14 44 46 44 46 54" fill="#EEE9F2" />
    </svg>
  )
}

function ChildIcon() {
  return (
    <svg width="60" height="60" viewBox="0 0 60 60" fill="none">
      {/* Hair */}
      <path d="M17 27C17 18 22 13 30 13C38 13 43 18 43 27" fill="#2A2830" opacity="0.75" />
      {/* Head */}
      <circle cx="30" cy="27" r="12" fill="#F3EFF5" />
      {/* Eyes */}
      <circle cx="25" cy="26" r="1.8" fill="#2A2830" />
      <circle cx="35" cy="26" r="1.8" fill="#2A2830" />
      {/* Big smile */}
      <path d="M23 31C23 31 26 35 30 35C34 35 37 31 37 31" stroke="#2A2830" strokeWidth="1.8" strokeLinecap="round" fill="none" />
      {/* Body */}
      <path d="M15 54C15 44 45 44 45 54" fill="#EDE8F0" />
    </svg>
  )
}

const roles: { role: UserRole; label: string; sub: string; Icon: () => ReactElement; bg: string }[] = [
  {
    role: 'parent',
    label: '부모님',
    sub: '이야기를 들려주세요',
    Icon: ParentIcon,
    bg: '#EDE8F0',
  },
  {
    role: 'child',
    label: '자녀',
    sub: '이야기를 기록해요',
    Icon: ChildIcon,
    bg: '#EEE9F2',
  },
]

export default function SelectModeScreen() {
  const navigate = useNavigate()
  const { setRole } = useAuthStore()
  const [selected, setSelected] = useState<UserRole | null>(null)

  const handleConfirm = () => {
    if (!selected) return
    setRole(selected)
    navigate(selected === 'parent' ? '/parent' : '/child')
  }

  return (
    <div className="flex flex-col h-screen px-6">
      <div className="pt-14 pb-10 shrink-0">
        <h1 className="text-[24px] font-bold text-[#2A2830]">누가 사용하실 건가요?</h1>
        <p className="mt-1 text-[16px] text-[#7A767F]">역할에 맞는 화면으로 안내해드려요</p>
      </div>

      {/* Profile cards */}
      <div className="flex gap-4">
        {roles.map(({ role, label, sub, Icon, bg }) => (
          <button
            key={role}
            onClick={() => setSelected(role)}
            className="flex-1 flex flex-col items-center gap-4 py-10 rounded-2xl transition-all duration-200"
            style={{
              backgroundColor: bg,
              border: `2.5px solid ${selected === role ? '#9485BE' : 'transparent'}`,
              boxShadow: selected === role ? '0 0 0 3px rgba(200,149,108,0.2)' : 'none',
            }}
          >
            <div className="w-[88px] h-[88px] rounded-full bg-white/60 flex items-center justify-center">
              <Icon />
            </div>
            <div className="text-center">
              <p className="text-[18px] font-bold text-[#2A2830]">{label}</p>
              <p className="mt-1 text-[14px] text-[#7A767F]">{sub}</p>
            </div>
          </button>
        ))}
      </div>

      <div className="mt-auto pb-12">
        <Button fullWidth disabled={!selected} onClick={handleConfirm}>
          선택 완료
        </Button>
      </div>
    </div>
  )
}
