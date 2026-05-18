import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes, RouteLoading } from './App';
import { createAuthenticatedAuthState, useStore } from './store';
import { resetStoreForTest } from './test-utils/store-fixtures';

vi.mock('./lib/rag/index', () => ({
  ragIndex: {
    addMemory: vi.fn(),
  },
}));

describe('App routing', () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  it('renders a shared loading state for lazy routes', () => {
    render(<RouteLoading />);

    expect(screen.getByRole('status')).toHaveTextContent('화면을 불러오는 중입니다');
  });

  it('loads the settings route through the lazy route boundary', async () => {
    useStore.setState({ auth: createAuthenticatedAuthState() });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '설정' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /사후 정책/ })).toHaveAttribute('aria-selected', 'true');
  });

  it('redirects unauthenticated users to phone login before protected routes', async () => {
    useStore.setState({
      auth: {
        phoneNumber: '',
        isAuthenticated: false,
        role: null,
        profile: null,
        onboardingCompleted: false,
        familyInviteSkipped: false,
        lastSignedInAt: null,
      },
    });

    render(
      <MemoryRouter initialEntries={['/settings']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Dearlog' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '인증번호 받기' })).toBeInTheDocument();
  });

  it('redirects authenticated users without onboarding to role selection', async () => {
    useStore.setState({
      auth: createAuthenticatedAuthState({
        role: null,
        profile: null,
        onboardingCompleted: false,
      }),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '누구의 이야기로 시작할까요?' })).toBeInTheDocument();
  });
});
