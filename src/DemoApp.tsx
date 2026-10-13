import { lazy, Suspense, type ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import ErrorBoundary from './components/ErrorBoundary'
import { AuthGuard, MyPageRedirect, RoleGuard, RouteFallback } from './App'

// 발표 시연 빌드(VITE_DEMO_MODE=true)에서만 쓰는 전체 화면 경로. 운영 빌드는 이 파일을 불러오지 않는다.
// 데모 서버가 접수 제한 없이 뜰 때만 이 화면들의 저장 요청이 통한다.
const DemoEntryPage = lazy(() => import('./pages/DemoEntryPage'))
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
const LegacyReviewScreen = lazy(() => import('./pages/LegacyReviewScreen'))
const CalendarScreen = lazy(() => import('./pages/CalendarScreen'))
const ChatbotScreen = lazy(() => import('./pages/ChatbotScreen'))
const AutobiographyScreen = lazy(() => import('./pages/AutobiographyScreen'))
const PublicationPreviewScreen = lazy(() => import('./pages/PublicationPreviewScreen'))
const DemoSettingsScreen = lazy(() => import('./pages/DemoSettingsScreen'))

const parent = (el: ReactNode) => <RoleGuard allowedRole="parent">{el}</RoleGuard>
const child = (el: ReactNode) => <RoleGuard allowedRole="child">{el}</RoleGuard>

export default function DemoApp() {
  return (
    <div className="mx-auto min-h-[100dvh] max-w-[390px] overflow-hidden bg-[#F8F6F9] shadow-[0_0_0_1px_rgba(224,219,232,0.55)]">
      <ErrorBoundary>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            <Route path="/demo" element={<DemoEntryPage />} />
            {['/', '/splash', '/intro', '/auth', '/parent/autologin'].map(path => <Route key={path} path={path} element={<Navigate to="/demo" replace />} />)}
            <Route path="/parent/welcome" element={parent(<ParentWelcomeScreen />)} />
            <Route path="/parent" element={parent(<ParentHomeScreen />)} />
            <Route path="/parent/interview" element={parent(<ParentInterviewScreen />)} />
            <Route path="/parent/progress" element={parent(<ParentProgressScreen />)} />
            <Route path="/parent/transcript" element={parent(<ParentTranscriptScreen />)} />
            <Route path="/parent/mypage" element={parent(<MyPageScreen />)} />
            <Route path="/parent/consent-settings" element={parent(<ConsentSettingsScreen />)} />
            <Route path="/parent/vault" element={parent(<LegacyVaultScreen />)} />
            <Route path="/parent/autobiography" element={parent(<AutobiographyScreen />)} />
            <Route path="/parent/autobiography/preview" element={parent(<PublicationPreviewScreen />)} />
            <Route path="/child" element={child(<ChildHomeScreen />)} />
            <Route path="/child/questions" element={child(<ChildQuestionsScreen />)} />
            <Route path="/child/photos" element={child(<ChildPhotosScreen />)} />
            <Route path="/child/progress" element={child(<ChildProgressScreen />)} />
            <Route path="/child/chapters" element={child(<ChildChaptersScreen />)} />
            <Route path="/child/record-space/new" element={child(<CreateRecordSpaceScreen />)} />
            <Route path="/child/mypage" element={child(<MyPageScreen />)} />
            <Route path="/child/consent-settings" element={child(<ConsentSettingsScreen />)} />
            <Route path="/child/legacy" element={child(<LegacyReviewScreen />)} />
            <Route path="/child/chatbot" element={child(<ChatbotScreen />)} />
            <Route path="/child/autobiography" element={child(<AutobiographyScreen />)} />
            <Route path="/child/autobiography/preview" element={child(<PublicationPreviewScreen />)} />
            <Route path="/mypage" element={<MyPageRedirect />} />
            <Route path="/calendar" element={<AuthGuard><CalendarScreen /></AuthGuard>} />
            <Route path="/settings" element={<DemoSettingsScreen />} />
            <Route path="*" element={<Navigate to="/demo" replace />} />
          </Routes>
        </Suspense>
      </ErrorBoundary>
    </div>
  )
}
