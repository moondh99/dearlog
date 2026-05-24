import { useLocation, useNavigate } from 'react-router-dom'

function HomeIcon({ active }: { active: boolean }) {
  const c = active ? '#8B5E3C' : '#7A6A5C'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M3 10.5L12 3L21 10.5V20C21 20.55 20.55 21 20 21H15V15H9V21H4C3.45 21 3 20.55 3 20V10.5Z"
        fill={active ? '#C8956C' : 'none'}
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function QuestionIcon({ active }: { active: boolean }) {
  const c = active ? '#8B5E3C' : '#7A6A5C'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M21 15C21 15.53 20.79 16.04 20.41 16.41C20.04 16.79 19.53 17 19 17H7L3 21V5C3 4.47 3.21 3.96 3.59 3.59C3.96 3.21 4.47 3 5 3H19C19.53 3 20.04 3.21 20.41 3.59C20.79 3.96 21 4.47 21 5V15Z"
        fill={active ? '#F4DDD0' : 'none'}
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M9 9C9 7.9 9.9 7 11 7H13C14.1 7 15 7.9 15 9C15 10.1 14.1 11 13 11H12V13" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="12" cy="15.5" r="0.75" fill={c} />
    </svg>
  )
}

function PhotoIcon({ active }: { active: boolean }) {
  const c = active ? '#8B5E3C' : '#7A6A5C'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="5" width="20" height="15" rx="2" fill={active ? '#F4DDD0' : 'none'} stroke={c} strokeWidth="1.8" />
      <circle cx="8.5" cy="10.5" r="1.5" stroke={c} strokeWidth="1.8" />
      <path d="M2 17L7 11L11 15L15 10L22 17" stroke={c} strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M15 3L17 5H19" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function ChartIcon({ active }: { active: boolean }) {
  const c = active ? '#8B5E3C' : '#7A6A5C'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="13" width="4" height="8" rx="1" fill={active ? '#C8956C' : 'none'} stroke={c} strokeWidth="1.8" />
      <rect x="10" y="8" width="4" height="13" rx="1" fill={active ? '#C8956C' : 'none'} stroke={c} strokeWidth="1.8" />
      <rect x="17" y="3" width="4" height="18" rx="1" fill={active ? '#C8956C' : 'none'} stroke={c} strokeWidth="1.8" />
    </svg>
  )
}

function BookIcon({ active }: { active: boolean }) {
  const c = active ? '#8B5E3C' : '#7A6A5C'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path
        d="M4 19.5C4 18.1 5.1 17 6.5 17H20"
        stroke={c}
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 2H20V22H6.5C5.1 22 4 20.9 4 19.5V4.5C4 3.1 5.1 2 6.5 2Z"
        fill={active ? '#F2D9B8' : 'none'}
        stroke={c}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <line x1="9" y1="7" x2="16" y2="7" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
      <line x1="9" y1="11" x2="14" y2="11" stroke={c} strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

const TABS = [
  { path: '/child', label: '홈', Icon: HomeIcon },
  { path: '/child/questions', label: '질문등록', Icon: QuestionIcon },
  { path: '/child/photos', label: '사진', Icon: PhotoIcon },
  { path: '/child/progress', label: '진척도', Icon: ChartIcon },
  { path: '/child/chapters', label: '챕터', Icon: BookIcon },
]

export default function ChildBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[390px] bg-[#FFFDF8] border-t border-[#E7DED2] z-50">
      <div className="flex">
        {TABS.map(({ path, label, Icon }) => {
          const active =
            path === '/child'
              ? location.pathname === '/child'
              : location.pathname.startsWith(path)
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex-1 flex flex-col items-center gap-0.5 py-2.5 min-h-[52px] transition-opacity active:opacity-60"
            >
              <Icon active={active} />
              <span
                className="text-[10px] font-medium"
                style={{ color: active ? '#8B5E3C' : '#7A6A5C' }}
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
