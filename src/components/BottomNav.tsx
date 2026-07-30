import { useLocation, useNavigate } from 'react-router-dom'

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#2A2830' : '#7A767F'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
        fill={active ? '#9485BE' : 'none'}
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function MicIcon({ active }: { active: boolean }) {
  const c = active ? '#2A2830' : '#7A767F'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <rect x="9" y="2" width="6" height="11" rx="3" fill={active ? '#9485BE' : 'none'} stroke={c} strokeWidth="1.8" />
      <path d="M5 11V12C5 15.87 8.13 19 12 19C15.87 19 19 15.87 19 12V11" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="12" y1="19" x2="12" y2="22" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="8" y1="22" x2="16" y2="22" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

function DocIcon({ active }: { active: boolean }) {
  const c = active ? '#2A2830' : '#7A767F'
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path
        d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z"
        fill={active ? '#EDE8F0' : 'none'}
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polyline points="14 2 14 8 20 8" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <line x1="9" y1="13" x2="15" y2="13" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="17" x2="13" y2="17" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const TABS = [
  { path: '/parent', label: '홈', Icon: HomeIcon },
  { path: '/parent/interview', label: '기록하기', Icon: MicIcon },
  { path: '/parent/transcript', label: '내 기록', Icon: DocIcon },
]

export default function BottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-[#FFFFFF] border-t border-[#E0DBE8] z-50">
      <div className="flex">
        {TABS.map(({ path, label, Icon }) => {
          const active = path === '/parent'
            ? location.pathname === '/parent'
            : path === '/mypage'
            ? location.pathname === '/mypage'
            : location.pathname.startsWith(path)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex-1 flex flex-col items-center gap-1 py-3 min-h-[56px] transition-opacity active:opacity-60"
            >
              <Icon active={active} />
              <span
                className="text-[11px] font-medium"
                style={{ color: active ? '#2A2830' : '#7A767F' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
