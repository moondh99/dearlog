import { BookOpen, Home, Layers, MessageCircle, PencilLine } from 'lucide-react'
import { useLocation, useNavigate } from 'react-router-dom'

const TABS = [
  { path: '/child', label: '홈', Icon: Home },
  { path: '/child/questions', label: '질문', Icon: PencilLine },
  { path: '/child/chapters', label: '챕터', Icon: Layers },
  { path: '/child/progress', label: '기록집', Icon: BookOpen },
  { path: '/child/chatbot', label: '대화방', Icon: MessageCircle },
]

export default function ChildBottomNav() {
  const location = useLocation()
  const navigate = useNavigate()

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-50 w-full max-w-[390px] -translate-x-1/2 border-t border-[#E8E6E1] bg-[rgba(252,250,248,0.96)]"
      style={{ paddingBottom: 'max(10px, env(safe-area-inset-bottom))' }}
    >
      <div className="flex min-h-[66px] pt-1">
        {TABS.map(({ path, label, Icon }) => {
          const active = path === '/child'
            ? location.pathname === '/child'
            : location.pathname.startsWith(path)

          return (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="flex min-h-[62px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1 py-2 transition active:opacity-60"
              aria-current={active ? 'page' : undefined}
            >
              <Icon
                className="h-6 w-6"
                strokeWidth={active ? 2.2 : 1.8}
                color={active ? '#4E5B73' : '#C2C5CC'}
                aria-hidden="true"
              />
              <span
                className="max-w-full truncate text-center text-[10.5px] font-medium leading-[15px]"
                style={{ color: active ? '#4E5B73' : '#C2C5CC' }}
              >
                {label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
