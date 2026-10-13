import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuthStore } from './store/authStore'
import type { UserRole } from './types/user'

const ExistingLoginPage = lazy(() => import('./pages/ExistingLoginPage'))
const ReadOnlyArchivePage = lazy(() => import('./pages/ReadOnlyArchivePage'))
const RestrictedAccessPage = lazy(() => import('./pages/RestrictedAccessPage'))
const CompanyPage = lazy(() => import('./pages/CompanyPage'))

function MyPageRedirect() {
  const { role, userId, authToken } = useAuthStore()
  if (!role || !userId || !authToken) return <Navigate to="/auth" replace />
  return <Navigate to={ROLE_HOME[role]} replace />
}

const ROLE_HOME: Record<UserRole, string> = {
  parent: '/parent',
  child: '/child',
}

function LogoutRedirect() {
  const reset = useAuthStore(state => state.reset)
  useEffect(() => { reset() }, [reset])
  return <Navigate to="/company" replace />
}

function RoleGuard({ allowedRole, children }: { allowedRole: UserRole; children: ReactNode }) {
  const { role, userId, authToken } = useAuthStore()

  if (!role || !userId || !authToken) {
    return <Navigate to="/auth" replace />
  }

  if (role !== allowedRole) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  return <>{children}</>
}

// 역할은 가리지 않고 로그인 여부만 확인합니다. 보호자와 부모가 모두 들어오는 화면용입니다.
function AuthGuard({ children }: { children: ReactNode }) {
  const { role, userId, authToken } = useAuthStore()

  if (!role || !userId || !authToken) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="min-h-[100dvh] bg-[#F8F6F9] flex items-center justify-center text-[#7A767F]">
      불러오는 중...
    </div>
  )
}

function ServiceRoutes() {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[390px] overflow-hidden bg-[#F8F6F9] shadow-[0_0_0_1px_rgba(224,219,232,0.55)]">
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/auth" element={<ExistingLoginPage />} />
            <Route path="/auth/verify" element={<RestrictedAccessPage />} />
            <Route path="/parent/autologin" element={<RestrictedAccessPage />} />
            {['/parent', '/parent/progress', '/parent/transcript', '/parent/mypage', '/parent/autobiography', '/parent/autobiography/preview'].map(path => <Route key={path} path={path} element={<RoleGuard allowedRole="parent"><ReadOnlyArchivePage /></RoleGuard>} />)}
            {['/child', '/child/photos', '/child/progress', '/child/chapters', '/child/mypage', '/child/autobiography', '/child/autobiography/preview'].map(path => <Route key={path} path={path} element={<RoleGuard allowedRole="child"><ReadOnlyArchivePage /></RoleGuard>} />)}
            {['/parent/welcome', '/parent/interview', '/parent/consent-settings', '/parent/vault'].map(path => <Route key={path} path={path} element={<RoleGuard allowedRole="parent"><RestrictedAccessPage /></RoleGuard>} />)}
            {['/child/questions', '/child/record-space/new', '/child/consent-settings', '/child/legacy', '/child/chatbot'].map(path => <Route key={path} path={path} element={<RoleGuard allowedRole="child"><RestrictedAccessPage /></RoleGuard>} />)}
            <Route path="/mypage" element={<MyPageRedirect />} />
            <Route path="/calendar" element={<AuthGuard><RestrictedAccessPage /></AuthGuard>} />
            <Route path="*" element={<RestrictedAccessPage />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/company" element={<ErrorBoundary><Suspense fallback={<RouteFallback />}><CompanyPage /></Suspense></ErrorBoundary>} />
      <Route path="/logout" element={<LogoutRedirect />} />
      {['/', '/splash', '/intro'].map(path => <Route key={path} path={path} element={<Navigate to="/company" replace />} />)}
      <Route path="*" element={<ServiceRoutes />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      {/* No scheduled interview monitor or token deep-link action during the restricted operation. */}
      <AppRoutes />
    </BrowserRouter>
  )
}
