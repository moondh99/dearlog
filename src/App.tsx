/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import { pageLoaders } from './routes/pageLoaders';
import { useStore } from './store';

const AuthPage = lazy(pageLoaders.auth);
const VerifyPage = lazy(pageLoaders.verify);
const OnboardingPage = lazy(pageLoaders.onboarding);
const InterviewPage = lazy(pageLoaders.interview);
const ArchivePage = lazy(pageLoaders.archive);
const PersonaPage = lazy(pageLoaders.persona);
const ReviewPage = lazy(pageLoaders.review);
const AutobiographyPage = lazy(pageLoaders.autobiography);
const SettingsPage = lazy(pageLoaders.settings);

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
  return role === 'senior' ? '/onboarding/senior-profile' : '/onboarding/role';
}

function RequireAuth() {
  const location = useLocation();
  const auth = useStore((state) => state.auth);

  if (!auth.isAuthenticated) {
    return <Navigate to="/auth" replace state={{ from: location.pathname }} />;
  }

  if (!auth.onboardingCompleted) {
    return <Navigate to={getOnboardingRoute(auth.role)} replace />;
  }

  return <Outlet />;
}

function PublicOnly() {
  const auth = useStore((state) => state.auth);

  if (auth.isAuthenticated && auth.onboardingCompleted) {
    return <Navigate to={auth.role === 'family' ? '/review' : '/'} replace />;
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
    return <Navigate to={auth.role === 'family' ? '/review' : '/'} replace />;
  }

  return <Outlet />;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<PublicOnly />}>
        <Route path="/auth" element={<LazyRoute><AuthPage /></LazyRoute>} />
        <Route path="/auth/verify" element={<LazyRoute><VerifyPage /></LazyRoute>} />
      </Route>

      <Route element={<RequireVerified />}>
        <Route path="/onboarding/role" element={<LazyRoute><OnboardingPage /></LazyRoute>} />
        <Route path="/onboarding/senior-profile" element={<LazyRoute><OnboardingPage /></LazyRoute>} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/" element={<Layout />}>
          <Route index element={<LazyRoute><InterviewPage /></LazyRoute>} />
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
