import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { App as CapacitorApp } from '@capacitor/app'
import { useScheduledCall } from './hooks/useScheduledCall'
import ErrorBoundary from './components/ErrorBoundary'
import { useAuthStore } from './store/authStore'
import type { UserRole } from './types/user'

const SplashScreen = lazy(() => import('./pages/SplashScreen'))
const IntroScreen = lazy(() => import('./pages/IntroScreen'))
const AuthScreen = lazy(() => import('./pages/AuthScreen'))
const VerifyPage = lazy(() => import('./pages/VerifyPage'))
const AutoLoginScreen = lazy(() => import('./pages/AutoLoginScreen'))
const ParentWelcomeScreen = lazy(() => import('./pages/ParentWelcomeScreen'))
const ParentHomeScreen = lazy(() => import('./pages/ParentHomeScreen'))
const ParentInterviewScreen = lazy(() => import('./pages/ParentInterviewScreen'))
const ParentProgressScreen = lazy(() => import('./pages/ParentProgressScreen'))
const ParentTranscriptScreen = lazy(() => import('./pages/ParentTranscriptScreen'))
const ChildHomeScreen = lazy(() => import('./pages/ChildHomeScreen'))
const ChildQuestionsScreen = lazy(() => import('./pages/ChildQuestionsScreen'))
const ChildPhotosScreen = lazy(() => import('./pages/ChildPhotosScreen'))
const ChildProgressScreen = lazy(() => import('./pages/ChildProgressScreen'))
const ChildChaptersScreen = lazy(() => import('./pages/ChildChaptersScreen'))
const CreateRecordSpaceScreen = lazy(() => import('./pages/CreateRecordSpaceScreen'))
const MyPageScreen = lazy(() => import('./pages/MyPageScreen'))
const ConsentSettingsScreen = lazy(() => import('./pages/ConsentSettingsScreen'))
const LegacyVaultScreen = lazy(() => import('./pages/LegacyVaultScreen'))
const CalendarScreen = lazy(() => import('./pages/CalendarScreen'))
const ChatbotScreen = lazy(() => import('./pages/ChatbotScreen'))
const AutobiographyScreen = lazy(() => import('./pages/AutobiographyScreen'))
const PublicationPreviewScreen = lazy(() => import('./pages/PublicationPreviewScreen'))
const DemoSettingsScreen = lazy(() => import('./pages/DemoSettingsScreen'))

function ScheduledCallMonitor() {
  useScheduledCall()
  return null
}

function DeepLinkListener() {
  const navigate = useNavigate()

  useEffect(() => {
    const listenerPromise = CapacitorApp.addListener('appUrlOpen', (event) => {
      try {
        const url = new URL(event.url)
        const isCustomScheme = url.protocol === 'dearlog:'
        const path = isCustomScheme
          ? `/${url.hostname}${url.pathname}${url.search}`
          : `${url.pathname}${url.search}`
        if (path) {
          navigate(path, { replace: true })
        }
      } catch (e) {
        console.error('Failed to parse deep link URL:', event.url, e)
      }
    })

    return () => {
      listenerPromise.then((handle) => handle.remove())
    }
  }, [navigate])

  return null
}

function MyPageRedirect() {
  const { role } = useAuthStore()
  if (!role) return <Navigate to="/auth" replace />
  return <Navigate to={role === 'parent' ? '/parent/mypage' : '/child/mypage'} replace />
}

const ROLE_HOME: Record<UserRole, string> = {
  parent: '/parent',
  child: '/child',
}

function RoleGuard({ allowedRole, children }: { allowedRole: UserRole; children: ReactNode }) {
  const { role } = useAuthStore()

  if (!role) {
    return <Navigate to="/auth" replace />
  }

  if (role !== allowedRole) {
    return <Navigate to={ROLE_HOME[role]} replace />
  }

  return <>{children}</>
}

// 역할은 가리지 않고 로그인 여부만 확인합니다. 보호자와 부모가 모두 들어오는 화면용입니다.
function AuthGuard({ children }: { children: ReactNode }) {
  const { role } = useAuthStore()

  if (!role) {
    return <Navigate to="/auth" replace />
  }

  return <>{children}</>
}

// 발표용 데모 화면은 로그인 없이 역할을 바꿀 수 있어 기본적으로 막습니다.
// 시연 빌드에서만 VITE_ENABLE_DEMO_SETTINGS=true 로 켭니다.
const demoSettingsEnabled = import.meta.env.DEV
  || import.meta.env.VITE_ENABLE_DEMO_SETTINGS === 'true'

export function RouteFallback() {
  return (
    <div role="status" aria-live="polite" className="min-h-[100dvh] bg-[#F8F6F9] flex items-center justify-center text-[#7A767F]">
      불러오는 중...
    </div>
  )
}

export function AppRoutes() {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[390px] overflow-hidden bg-[#F8F6F9] shadow-[0_0_0_1px_rgba(224,219,232,0.55)]">
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/" element={<Navigate to="/splash" replace />} />
            <Route path="/splash" element={<SplashScreen />} />
            <Route path="/intro" element={<IntroScreen />} />
            <Route path="/auth" element={<AuthScreen />} />
            <Route path="/auth/verify" element={<VerifyPage />} />
            <Route path="/parent/autologin" element={<AutoLoginScreen />} />
            <Route path="/parent/welcome" element={<RoleGuard allowedRole="parent"><ParentWelcomeScreen /></RoleGuard>} />
            <Route path="/parent" element={<RoleGuard allowedRole="parent"><ParentHomeScreen /></RoleGuard>} />
            <Route path="/parent/interview" element={<RoleGuard allowedRole="parent"><ParentInterviewScreen /></RoleGuard>} />
            <Route path="/parent/progress" element={<RoleGuard allowedRole="parent"><ParentProgressScreen /></RoleGuard>} />
            <Route path="/parent/transcript" element={<RoleGuard allowedRole="parent"><ParentTranscriptScreen /></RoleGuard>} />
            <Route path="/child" element={<RoleGuard allowedRole="child"><ChildHomeScreen /></RoleGuard>} />
            <Route path="/child/questions" element={<RoleGuard allowedRole="child"><ChildQuestionsScreen /></RoleGuard>} />
            <Route path="/child/photos" element={<RoleGuard allowedRole="child"><ChildPhotosScreen /></RoleGuard>} />
            <Route path="/child/progress" element={<RoleGuard allowedRole="child"><ChildProgressScreen /></RoleGuard>} />
            <Route path="/child/chapters" element={<RoleGuard allowedRole="child"><ChildChaptersScreen /></RoleGuard>} />
            <Route path="/child/record-space/new" element={<RoleGuard allowedRole="child"><CreateRecordSpaceScreen /></RoleGuard>} />
            <Route path="/child/mypage" element={<RoleGuard allowedRole="child"><MyPageScreen /></RoleGuard>} />
            <Route path="/child/consent-settings" element={<RoleGuard allowedRole="child"><ConsentSettingsScreen /></RoleGuard>} />
            <Route path="/parent/mypage" element={<RoleGuard allowedRole="parent"><MyPageScreen /></RoleGuard>} />
            <Route path="/parent/consent-settings" element={<RoleGuard allowedRole="parent"><ConsentSettingsScreen /></RoleGuard>} />
            {/* 금고는 기록의 주인만 엽니다. 보호자가 대신 열면 부모님 기록의 열쇠를 보호자가 쥐게 됩니다. */}
            <Route path="/parent/vault" element={<RoleGuard allowedRole="parent"><LegacyVaultScreen /></RoleGuard>} />
            <Route path="/mypage" element={<MyPageRedirect />} />
            {demoSettingsEnabled && <Route path="/settings" element={<DemoSettingsScreen />} />}
            <Route path="/calendar" element={<AuthGuard><CalendarScreen /></AuthGuard>} />
            <Route path="/child/chatbot" element={<RoleGuard allowedRole="child"><ChatbotScreen /></RoleGuard>} />
            <Route path="/child/autobiography" element={<RoleGuard allowedRole="child"><AutobiographyScreen /></RoleGuard>} />
            <Route path="/child/autobiography/preview" element={<RoleGuard allowedRole="child"><PublicationPreviewScreen /></RoleGuard>} />
            <Route path="/parent/autobiography" element={<RoleGuard allowedRole="parent"><AutobiographyScreen /></RoleGuard>} />
            <Route path="/parent/autobiography/preview" element={<RoleGuard allowedRole="parent"><PublicationPreviewScreen /></RoleGuard>} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScheduledCallMonitor />
      <DeepLinkListener />
      <AppRoutes />
    </BrowserRouter>
  )
}
