import { render, screen } from '@testing-library/react';
import { act } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, RouteFallback } from './App';
import SplashScreen from './pages/SplashScreen';
import { useAuthStore } from './store/authStore';
import { useChildStore } from './store/childStore';

vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: vi.fn(),
  updateLocalUserRole: vi.fn(),
  updateLocalUserProfile: vi.fn(),
  updateLocalInterviewRecordReview: vi.fn(async () => ({ record: {} })),
  synthesizeLocalQuestionSpeech: vi.fn(async () => new Blob(['audio'], { type: 'audio/mpeg' })),
  fetchFamilyMembers: vi.fn(async () => ({ members: [] })),
  fetchLocalCalendarEvents: vi.fn(async () => ({ events: [] })),
  fetchLocalChapters: vi.fn(async () => ({ chapters: [] })),
  fetchLocalFamilyQuestions: vi.fn(async () => ({ questions: [] })),
  fetchLocalInterviewRecords: vi.fn(async () => ({ records: [] })),
  fetchLocalPhotos: vi.fn(async () => ({ photos: [] })),
  fetchLocalQuestions: vi.fn(async () => ({ questions: [] })),
  uploadLocalPhoto: vi.fn(async () => ({ photo: {}, questions: [] })),
  fetchLocalAIProxyAuditSummary: vi.fn(async () => ({
    window: { from: '2026-05-31T00:00:00.000Z', to: '2026-05-31T01:00:00.000Z', minutes: 60 },
    totals: {
      requests: 3,
      success: 2,
      invalidRequest: 0,
      rateLimited: 1,
      configError: 0,
      providerError: 0,
      estimatedUnits: 120,
      avgLatencyMs: 90,
      errorRatePercent: 0,
    },
    byEndpoint: [{
      endpoint: 'chat_completions',
      requests: 3,
      success: 2,
      errors: 0,
      rateLimited: 1,
      estimatedUnits: 120,
      avgLatencyMs: 90,
    }],
    byUser: [],
    recentErrors: [],
    alerts: [],
    alertThresholds: { errorRatePercent: 25, rateLimitedCount: 10, minRequests: 5 },
    retention: { days: 30, cutoff: '2026-05-01T00:00:00.000Z', deletedOldLogs: 0 },
  })),
}));

function resetAuthStore() {
  window.localStorage.clear();
  window.sessionStorage.clear();
  useAuthStore.setState({
    role: null,
    userName: '',
    userId: null,
    phoneNumber: '',
    authToken: null,
  });
  useChildStore.setState({
    questions: [],
    photos: [],
    activeSeniorId: null,
  });
}

describe('App routing', () => {
  beforeEach(() => {
    resetAuthStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('renders a shared loading state for lazy routes', () => {
    render(<RouteFallback />);

    expect(screen.getByRole('status')).toHaveTextContent('불러오는 중...');
  });

  it('redirects the root route to the splash screen', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('DEARLOG')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '시작하기' })).toBeInTheDocument();
  });

  it('automatically moves from splash to intro after a short delay', async () => {
    vi.useFakeTimers();

    render(
      <MemoryRouter initialEntries={['/splash']}>
        <Routes>
          <Route path="/splash" element={<SplashScreen />} />
          <Route path="/intro" element={<div>intro-ready</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('DEARLOG')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2500);
    });

    expect(screen.getByText('intro-ready')).toBeInTheDocument();
  });

  it('loads the auth route through the lazy route boundary', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Dearlog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '회원가입' })).toBeInTheDocument();
  });

  it('redirects the shared mypage route by selected role', async () => {
    useAuthStore.setState({
      role: 'parent',
      userName: '김영자',
      userId: 'senior-1',
      phoneNumber: '01012345678',
      authToken: 'token',
    });

    render(
      <MemoryRouter initialEntries={['/mypage']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '마이페이지' })).toBeInTheDocument();
    expect(screen.getByText('김영자')).toBeInTheDocument();
  });

  it('redirects parent users away from child routes', async () => {
    useAuthStore.setState({
      role: 'parent',
      userName: '김영자',
      userId: 'senior-1',
      phoneNumber: '01012345678',
      authToken: 'token',
    });

    render(
      <MemoryRouter initialEntries={['/child/questions']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText(/가족이 이야기를/)).toBeInTheDocument();
    expect(screen.getByText('지금 시작하기')).toBeInTheDocument();
  });

  it('redirects child users away from parent routes', async () => {
    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01012345678',
      authToken: 'token',
    });

    render(
      <MemoryRouter initialEntries={['/parent/interview']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('기록 공간 선택하기')).toBeInTheDocument();
    expect(screen.getByText('안녕하세요, 김보호님')).toBeInTheDocument();
  });

  it('redirects unauthenticated protected routes to auth', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/interview']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Dearlog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument();
  });

  it('shows the AI proxy operations panel for guardian mypage', async () => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      const body = url.includes('/api/ai/audit-summary')
        ? {
            window: { from: '2026-05-31T00:00:00.000Z', to: '2026-05-31T01:00:00.000Z', minutes: 60 },
            totals: {
              requests: 3,
              success: 2,
              invalidRequest: 0,
              rateLimited: 1,
              configError: 0,
              providerError: 0,
              estimatedUnits: 120,
              avgLatencyMs: 90,
              errorRatePercent: 0,
            },
            byEndpoint: [{
              endpoint: 'chat_completions',
              requests: 3,
              success: 2,
              errors: 0,
              rateLimited: 1,
              estimatedUnits: 120,
              avgLatencyMs: 90,
            }],
            byUser: [],
            recentErrors: [],
            alerts: [],
            alertThresholds: { errorRatePercent: 25, rateLimitedCount: 10, minRequests: 5 },
            retention: { days: 30, cutoff: '2026-05-01T00:00:00.000Z', deletedOldLogs: 0 },
          }
        : { members: [] };
      return new Response(JSON.stringify(body), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }));

    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01012345678',
      authToken: 'token',
    });

    render(
      <MemoryRouter initialEntries={['/child/mypage']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('AI 운영 점검')).toBeInTheDocument();
    expect(await screen.findByText('대화 생성')).toBeInTheDocument();
    expect(screen.getByText('현재 임계값을 넘은 항목이 없습니다.')).toBeInTheDocument();
  });
});
