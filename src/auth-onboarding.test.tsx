import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { useStore } from './store';
import { resetStoreForTest } from './test-utils/store-fixtures';

vi.mock('./lib/rag/index', () => ({
  ragIndex: {
    addMemory: vi.fn(),
  },
}));

function setSignedOutState() {
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
}

describe('auth and onboarding flow', () => {
  beforeEach(() => {
    resetStoreForTest();
    setSignedOutState();
  });

  it('moves from phone login to verification and role selection', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('010 1234 5678'), {
      target: { value: '010 1234 5678' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));

    expect(await screen.findByRole('heading', { name: '인증번호 확인' })).toBeInTheDocument();
    expect(useStore.getState().auth.phoneNumber).toBe('01012345678');

    fireEvent.change(screen.getByPlaceholderText('483920'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인하고 계속' }));

    expect(await screen.findByRole('heading', { name: '누구의 이야기로 시작할까요?' })).toBeInTheDocument();
    expect(useStore.getState().auth.isAuthenticated).toBe(true);
  });

  it('saves senior profile, skips family invite, and enters the main journey', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('010 1234 5678'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(await screen.findByPlaceholderText('483920'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인하고 계속' }));
    fireEvent.click(await screen.findByRole('button', { name: /어르신으로 시작/ }));

    expect(await screen.findByRole('heading', { name: '어르신 기본 프로필' })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('김영자'), {
      target: { value: '박순자' },
    });
    fireEvent.change(screen.getByDisplayValue('1950년대'), {
      target: { value: '1940년대' },
    });
    fireEvent.change(screen.getByPlaceholderText('어르신'), {
      target: { value: '할머니' },
    });
    fireEvent.click(screen.getByRole('button', { name: '초대 건너뛰기' }));
    fireEvent.click(screen.getByRole('button', { name: '시작하기' }));

    await waitFor(() => {
      expect(useStore.getState().auth.onboardingCompleted).toBe(true);
    });
    expect(useStore.getState().auth.familyInviteSkipped).toBe(true);
    expect(useStore.getState().auth.profile).toMatchObject({
      name: '박순자',
      birthDecade: '1940년대',
      preferredName: '할머니',
    });
    expect(await screen.findByRole('navigation', { name: '사용자 여정 단계' })).toBeInTheDocument();
  });

  it('routes family role users to the family space without locking senior features', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('010 1234 5678'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(await screen.findByPlaceholderText('483920'), {
      target: { value: '111111' },
    });
    fireEvent.click(screen.getByRole('button', { name: '확인하고 계속' }));
    fireEvent.click(await screen.findByRole('button', { name: /가족으로 참여/ }));

    const familyLinks = await screen.findAllByRole('link', { name: /가족 공간/ });
    expect(familyLinks.some((link) => link.getAttribute('aria-current') === 'page')).toBe(true);
    expect(useStore.getState().auth).toMatchObject({
      role: 'family',
      onboardingCompleted: true,
    });
  });
});
