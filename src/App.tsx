/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { pageLoaders } from './routes/pageLoaders';
import { useStore } from './store';
import { isGuardianRole } from './lib/roles';
import BottomNav from './components/BottomNav';

const AuthPage = lazy(pageLoaders.auth);
const VerifyPage = lazy(pageLoaders.verify);
const OnboardingPage = lazy(pageLoaders.onboarding);
const InterviewPage = lazy(pageLoaders.interview);
const ArchivePage = lazy(pageLoaders.archive);
const PersonaPage = lazy(pageLoaders.persona);
const ReviewPage = lazy(pageLoaders.review);
const AutobiographyPage = lazy(pageLoaders.autobiography);
const SettingsPage = lazy(pageLoaders.settings);

// New mobile-optimized screens
const SplashScreen = lazy(() => import('./pages/SplashScreen'));
const IntroScreen = lazy(() => import('./pages/IntroScreen'));
const SelectModeScreen = lazy(() => import('./pages/SelectModeScreen'));
const ParentHomeScreen = lazy(() => import('./pages/ParentHomeScreen'));
const ParentProgressScreen = lazy(() => import('./pages/ParentProgressScreen'));
const ParentTranscriptScreen = lazy(() => import('./pages/ParentTranscriptScreen'));
const ChildHomeScreen = lazy(() => import('./pages/ChildHomeScreen'));
const ChildQuestionsScreen = lazy(() => import('./pages/ChildQuestionsScreen'));
const ChildPhotosScreen = lazy(() => import('./pages/ChildPhotosScreen'));
const ChildProgressScreen = lazy(() => import('./pages/ChildProgressScreen'));
const ChildChaptersScreen = lazy(() => import('./pages/ChildChaptersScreen'));

export function RouteLoading() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-[320px] items-center justify-center text-[16px] font-bold text-text-muted"
    >
      화면을 불러오는 중입니다...
    </div>
  );
}

function LazyRoute({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary>
      <Suspense fallback={<RouteLoading />}>{children}</Suspense>
    </ErrorBoundary>
  );
}

function getOnboardingRoute(role: string | null) {
  if (role === 'senior') return '/onboarding/senior-profile';
  if (role === 'guardian') return '/onboarding/guardian-profile';
  return '/select-mode';
}

function RequireAuth() {
  const location = useLocation();
  const auth = useStore((state) => state.auth);
  const fetchMemories = useStore((state) => state.fetchMemories);
  const fetchPhotos = useStore((state) => state.fetchPhotos);
  const fetchFamilyQuestions = useStore((state) => state.fetchFamilyQuestions);
  const fetchAutobiographyDraft = useStore((state) => state.fetchAutobiographyDraft);

  useEffect(() => {
    if (auth.isAuthenticated) {
      fetchMemories().catch((err) => console.error("fetchMemories error in RequireAuth:", err));
      fetchPhotos().catch((err) => console.error("fetchPhotos error in RequireAuth:", err));
      fetchFamilyQuestions().catch((err) => console.error("fetchFamilyQuestions error in RequireAuth:", err));
      fetchAutobiographyDraft().catch((err) => console.error("fetchAutobiographyDraft error in RequireAuth:", err));
    }
  }, [auth.isAuthenticated, fetchMemories, fetchPhotos, fetchFamilyQuestions, fetchAutobiographyDraft]);

  if (!auth.isAuthenticated) {
    return <Navigate to="/splash" replace state={{ from: location.pathname }} />;
  }

  if (!auth.onboardingCompleted) {
    return <Navigate to={getOnboardingRoute(auth.role)} replace />;
  }

  // Prevent cross-role access to mobile routes
  if (auth.role === 'senior' && location.pathname.startsWith('/child')) {
    return <Navigate to="/parent" replace />;
  }

  if (auth.role === 'guardian' && location.pathname.startsWith('/parent')) {
    return <Navigate to="/child" replace />;
  }

  return <Outlet />;
}

function PublicOnly() {
  const auth = useStore((state) => state.auth);

  if (auth.isAuthenticated && auth.onboardingCompleted) {
    if (auth.role === 'senior') return <Navigate to="/parent" replace />;
    if (auth.role === 'guardian') return <Navigate to="/child" replace />;
    return <Navigate to="/select-mode" replace />;
  }

  if (auth.isAuthenticated) {
    return <Navigate to={getOnboardingRoute(auth.role)} replace />;
  }

  return <Outlet />;
}

function RequireVerified() {
  const auth = useStore((state) => state.auth);

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (auth.onboardingCompleted) {
    if (auth.role === 'senior') return <Navigate to="/parent" replace />;
    if (auth.role === 'guardian') return <Navigate to="/child" replace />;
    return <Navigate to="/select-mode" replace />;
  }

  return <Outlet />;
}

function RootRedirect() {
  const auth = useStore((state) => state.auth);

  if (!auth.isAuthenticated) {
    return <Navigate to="/splash" replace />;
  }

  if (!auth.role) {
    return <Navigate to="/select-mode" replace />;
  }

  return <Navigate to={auth.role === 'guardian' ? '/child' : '/parent'} replace />;
}

function ParentInterviewWrapper() {
  return (
    <div className="flex flex-col min-h-screen bg-[#F8F3EA]">
      <div className="flex-1 pb-24">
        <LazyRoute>
          <InterviewPage />
        </LazyRoute>
      </div>
      <BottomNav />
    </div>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/splash" element={<LazyRoute><SplashScreen /></LazyRoute>} />
        <Route path="/intro" element={<LazyRoute><IntroScreen /></LazyRoute>} />
        <Route path="/auth" element={<LazyRoute><AuthPage /></LazyRoute>} />
        <Route path="/auth/verify" element={<LazyRoute><VerifyPage /></LazyRoute>} />
      </Route>

      <Route element={<RequireVerified />}>
        <Route path="/select-mode" element={<LazyRoute><SelectModeScreen /></LazyRoute>} />
        <Route path="/onboarding/role" element={<Navigate to="/select-mode" replace />} />
        <Route path="/onboarding/senior-profile" element={<LazyRoute><OnboardingPage /></LazyRoute>} />
        <Route path="/onboarding/guardian-profile" element={<LazyRoute><OnboardingPage /></LazyRoute>} />
      </Route>

      <Route element={<RequireAuth />}>
        {/* Parent / Senior routes */}
        <Route path="/parent" element={<LazyRoute><ParentHomeScreen /></LazyRoute>} />
        <Route path="/parent/interview" element={<ParentInterviewWrapper />} />
        <Route path="/parent/progress" element={<LazyRoute><ParentProgressScreen /></LazyRoute>} />
        <Route path="/parent/transcript" element={<LazyRoute><ParentTranscriptScreen /></LazyRoute>} />

        {/* Child / Guardian routes */}
        <Route path="/child" element={<LazyRoute><ChildHomeScreen /></LazyRoute>} />
        <Route path="/child/questions" element={<LazyRoute><ChildQuestionsScreen /></LazyRoute>} />
        <Route path="/child/photos" element={<LazyRoute><ChildPhotosScreen /></LazyRoute>} />
        <Route path="/child/progress" element={<LazyRoute><ChildProgressScreen /></LazyRoute>} />
        <Route path="/child/chapters" element={<LazyRoute><ChildChaptersScreen /></LazyRoute>} />

        {/* Existing layout-wrapped routes */}
        <Route path="/" element={<Layout />}>
          <Route index element={<RootRedirect />} />
          <Route path="archive" element={<LazyRoute><ArchivePage /></LazyRoute>} />
          <Route path="persona" element={<LazyRoute><PersonaPage /></LazyRoute>} />
          <Route path="review" element={<LazyRoute><ReviewPage /></LazyRoute>} />
          <Route path="autobiography" element={<LazyRoute><AutobiographyPage /></LazyRoute>} />
          <Route path="settings" element={<LazyRoute><SettingsPage /></LazyRoute>} />
        </Route>
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
