import { Outlet, NavLink } from 'react-router-dom';
import { Mic, Archive, Bot, Users, BookOpen, Settings, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { routePreloads } from '../routes/pageLoaders';
import JourneyRail from './JourneyRail';
import { useStore } from '../store';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const navItems = [
  { to: '/',              label: '말씀 나누기', icon: Mic },
  { to: '/archive',       label: '추억 보관함', icon: Archive },
  { to: '/review',        label: '가족 공간',   icon: Users },
  { to: '/persona',       label: '나의 분신',   icon: Bot },
  { to: '/autobiography', label: '자서전',      icon: BookOpen },
  { to: '/settings',      label: '설정',        icon: Settings },
];

export default function Layout() {
  const profile = useStore((state) => state.auth.profile);
  const role = useStore((state) => state.auth.role);
  const demo = useStore((state) => state.demo);
  const userLabel = profile
    ? `${profile.name} (${profile.birthDecade})`
    : role === 'family'
      ? '가족 사용자'
      : '어르신';

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] bg-bg text-text font-sans">
      <aside className="hidden w-[284px] shrink-0 border-r border-border bg-[#2A2027] px-4 py-5 text-white lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-white/12 ring-1 ring-white/15">
            <BookOpen className="h-5 w-5 text-white" strokeWidth={2.4} />
          </div>
          <div>
            <span className="block text-[23px] font-black leading-none tracking-tight">Dearlog</span>
            <span className="mt-1 block text-[12px] font-semibold text-white/55">Memory to book</span>
          </div>
        </div>

        <nav className="mt-8 flex flex-col gap-1" aria-label="주요 메뉴">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onMouseEnter={() => routePreloads[to]?.()}
              onFocus={() => routePreloads[to]?.()}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] font-bold transition-all duration-150',
                  isActive
                    ? 'bg-white text-[#2A2027] shadow-[0_14px_34px_rgba(0,0,0,0.22)]'
                    : 'text-white/68 hover:bg-white/8 hover:text-white'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2.1} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-[24px] border border-white/10 bg-white/8 p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-primary">
              <User className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black text-white">{userLabel}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-white/55">
                {demo.enabled ? '발표 데모 준비됨' : '개인 보관함'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[64px] shrink-0 items-center justify-between border-b border-border bg-surface/92 px-4 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-primary text-white">
              <BookOpen className="h-4.5 w-4.5" strokeWidth={2.5} />
            </div>
            <div>
              <span className="block text-[20px] font-black leading-none text-primary">Dearlog</span>
              <span className="mt-0.5 block text-[11px] font-bold text-text-subtle">내 기억의 정원</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border bg-surface-alt px-3 py-1.5">
            <User className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="max-w-[120px] truncate text-[12px] font-black text-text-muted">{userLabel}</span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pb-28 md:px-6 lg:px-8 lg:py-7 lg:pb-8">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5">
            <JourneyRail />
            <Outlet />
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-16px_40px_rgba(42,32,39,0.1)] backdrop-blur lg:hidden" aria-label="모바일 주요 메뉴">
          <div className="mx-auto grid max-w-md grid-cols-6 gap-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[10.5px] font-black transition-colors',
                    isActive
                      ? 'bg-primary-pale text-primary'
                      : 'text-text-subtle hover:bg-surface-alt hover:text-text-muted'
                  )
                }
              >
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={2.2} />
                <span className="max-w-full truncate">{label}</span>
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}
