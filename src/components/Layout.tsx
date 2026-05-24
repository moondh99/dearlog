import { Outlet, NavLink } from 'react-router-dom';
import { Mic, Archive, Bot, Users, BookOpen, Settings, User } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { routePreloads } from '../routes/pageLoaders';
import JourneyRail from './JourneyRail';
import { useStore } from '../store';
import { isGuardianRole } from '../lib/roles';

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
  const guardianProfile = useStore((state) => state.auth.guardianProfile);
  const role = useStore((state) => state.auth.role);
  const demo = useStore((state) => state.demo);
  const isGuardian = isGuardianRole(role);
  const visibleNavItems = isGuardian ? navItems : navItems.filter((item) => item.to === '/');
  const userLabel = isGuardian && guardianProfile
    ? `${guardianProfile.name} (${guardianProfile.relationship})`
    : profile
    ? `${profile.name} (${profile.birthDecade})`
    : isGuardian
      ? '보호자'
      : '어르신';

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] bg-bg text-text font-serif">
      <aside className="hidden w-[292px] shrink-0 border-r border-border bg-primary px-4 py-5 text-primary-pale shadow-[inset_-1px_0_0_rgba(255,255,255,0.06)] lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-2.5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] border border-white/10 bg-white/[0.07] shadow-sm ring-1 ring-white/10">
            <BookOpen className="h-5 w-5 text-primary-pale" strokeWidth={2.4} />
          </div>
          <div>
            <span className="block text-[23px] font-black leading-none tracking-tight text-primary-pale">Dearlog</span>
            <span className="mt-1 block text-[11px] font-bold uppercase tracking-[0.18em] text-primary-pale/45">Memory to book</span>
          </div>
        </div>

        <nav className="mt-9 flex flex-col gap-1.5" aria-label="주요 메뉴">
          {visibleNavItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onMouseEnter={() => routePreloads[to]?.()}
              onFocus={() => routePreloads[to]?.()}
              className={({ isActive }) =>
                cn(
                  'group flex items-center gap-3 rounded-[18px] px-4 py-3 text-[15px] font-bold transition-all duration-300 ease-out hover:-translate-y-0.5',
                  isActive
                    ? 'border border-primary-light bg-surface text-primary shadow-[0_18px_46px_rgba(92,52,32,0.15)]'
                    : 'border border-transparent text-primary-pale/75 hover:border-white/10 hover:bg-primary-light hover:text-primary-pale'
                )
              }
            >
              <Icon className="h-5 w-5 shrink-0" strokeWidth={2.1} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mt-auto rounded-[24px] border border-white/10 bg-primary-light/50 p-4 shadow-[0_18px_50px_rgba(92,52,32,0.15)] backdrop-blur">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-primary-pale text-primary shadow-sm">
              <User className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-black text-primary-pale">{userLabel}</p>
              <p className="mt-0.5 text-[12px] font-semibold text-primary-pale/55">
                {demo.enabled ? '발표 데모 준비됨' : '개인 보관함'}
              </p>
            </div>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-[68px] shrink-0 items-center justify-between border-b border-border bg-surface/80 px-4 shadow-sm backdrop-blur-xl lg:hidden">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-[13px] bg-primary text-primary-pale shadow-sm">
              <BookOpen className="h-4.5 w-4.5" strokeWidth={2.5} />
            </div>
            <div>
              <span className="block text-[20px] font-black leading-none text-primary">Dearlog</span>
              <span className="mt-0.5 block text-[11px] font-bold text-text-subtle">Memory archive</span>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-surface/80 px-3 py-1.5 shadow-sm">
            <User className="h-4 w-4 text-primary" aria-hidden="true" />
            <span className="max-w-[120px] truncate text-[12px] font-black text-text-muted">{userLabel}</span>
          </div>
        </header>

        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5 pb-28 md:px-7 lg:px-10 lg:py-9 lg:pb-10">
          <div className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-6">
            {isGuardian && <JourneyRail />}
            <Outlet />
          </div>
        </main>

        <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 px-2 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-2.5 shadow-[0_-18px_46px_rgba(92,52,32,0.06)] backdrop-blur-xl lg:hidden" aria-label="모바일 주요 메뉴">
          <div className={cn('mx-auto grid max-w-md gap-1', isGuardian ? 'grid-cols-6' : 'grid-cols-1')}>
            {visibleNavItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                end={to === '/'}
                className={({ isActive }) =>
                  cn(
                    'flex min-w-0 flex-col items-center justify-center gap-1 rounded-2xl px-1.5 py-2 text-[10.5px] font-black transition-all duration-300 ease-out hover:-translate-y-0.5',
                    isActive
                      ? 'bg-primary text-primary-pale shadow-sm'
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
