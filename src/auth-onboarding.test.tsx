import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { useAuthStore } from './store/authStore';

const localServerMocks = vi.hoisted(() => ({
  registerLocalPhoneAccount: vi.fn(),
  updateLocalUserProfile: vi.fn(),
  updateLocalUserRole: vi.fn(),
  loginWithInvitationToken: vi.fn(),
  fetchFamilyMembers: vi.fn(),
  fetchLocalChapters: vi.fn(),
  fetchLocalQuestions: vi.fn(),
  fetchLocalInterviewRecords: vi.fn(),
  fetchLocalCalendarEvents: vi.fn(),
  fetchLocalPhotos: vi.fn(),
  fetchLocalFamilyQuestions: vi.fn(),
  uploadLocalPhoto: vi.fn(async () => ({ photo: {}, questions: [] })),
  updateLocalInterviewRecordReview: vi.fn(async () => ({ record: {} })),
}));

vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: localServerMocks.registerLocalPhoneAccount,
  updateLocalUserProfile: localServerMocks.updateLocalUserProfile,
  updateLocalUserRole: localServerMocks.updateLocalUserRole,
  loginWithInvitationToken: localServerMocks.loginWithInvitationToken,
  fetchFamilyMembers: localServerMocks.fetchFamilyMembers,
  fetchLocalChapters: localServerMocks.fetchLocalChapters,
  fetchLocalQuestions: localServerMocks.fetchLocalQuestions,
  fetchLocalInterviewRecords: localServerMocks.fetchLocalInterviewRecords,
  fetchLocalCalendarEvents: localServerMocks.fetchLocalCalendarEvents,
  fetchLocalPhotos: localServerMocks.fetchLocalPhotos,
  fetchLocalFamilyQuestions: localServerMocks.fetchLocalFamilyQuestions,
  uploadLocalPhoto: localServerMocks.uploadLocalPhoto,
  updateLocalInterviewRecordReview: localServerMocks.updateLocalInterviewRecordReview,
  updateLocalPhoto: vi.fn(async () => ({ photo: {} })),
  deleteLocalPhoto: vi.fn(async () => ({ ok: true })),
  updateLocalFamilyQuestion: vi.fn(async () => ({ question: {} })),
  deleteLocalFamilyQuestion: vi.fn(async () => ({ ok: true })),
  createLocalQuestion: vi.fn(async () => ({ question: {} })),
  saveLocalInterviewRecord: vi.fn(async () => ({ record: {} })),
  updateLocalInterviewRecordConsent: vi.fn(async () => ({ record: {} })),
  bulkUpdateLocalInterviewRecordConsent: vi.fn(async () => ({ ok: true })),
  saveLocalCalendarEvent: vi.fn(async () => ({ event: {} })),
  deleteLocalCalendarEvent: vi.fn(async () => ({ ok: true })),
}));

function guardianUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'guardian-1',
    name: '김보호',
    phoneNumber: '01012345678',
    role: 'guardian',
    birthDate: null,
    birthDecade: null,
    preferredName: '보호자',
    seniorName: null,
    seniorBirthDecade: null,
    seniorPreferredName: null,
    guardianName: '김보호',
    guardianRelationship: '자녀',
    guardianPreferredName: '보호자',
    ...overrides,
  };
}

function seniorUser(overrides: Record<string, unknown> = {}) {
  return {
    id: 'senior-1',
    name: '김영자',
    phoneNumber: null,
    role: 'senior',
    birthDate: null,
    birthDecade: null,
    preferredName: '어르신',
    seniorName: '김영자',
    seniorBirthDecade: null,
    seniorPreferredName: '어르신',
    guardianName: '김보호',
    guardianRelationship: null,
    guardianPreferredName: null,
    ...overrides,
  };
}

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
}

describe('auth and onboarding flow', () => {
  beforeEach(() => {
    resetAuthStore();
    vi.useRealTimers();
    localServerMocks.registerLocalPhoneAccount.mockResolvedValue({
      user: guardianUser(),
      authToken: 'login-token',
      isNew: false,
    });
    localServerMocks.updateLocalUserProfile.mockResolvedValue({
      user: guardianUser(),
      authToken: 'profile-token',
    });
    localServerMocks.updateLocalUserRole.mockResolvedValue({
      user: guardianUser(),
      authToken: 'role-token',
    });
    localServerMocks.loginWithInvitationToken.mockResolvedValue({
      user: seniorUser(),
      authToken: 'invite-token',
    });
    localServerMocks.fetchFamilyMembers.mockResolvedValue({
      members: [{ id: 'senior-1', name: '김영자', role: 'parent', relationship: '부모님', isMe: false }],
    });
    localServerMocks.fetchLocalChapters.mockResolvedValue({ chapters: [] });
    localServerMocks.fetchLocalQuestions.mockResolvedValue({ questions: [] });
    localServerMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] });
    localServerMocks.fetchLocalCalendarEvents.mockResolvedValue({ events: [] });
    localServerMocks.fetchLocalPhotos.mockResolvedValue({ photos: [] });
    localServerMocks.fetchLocalFamilyQuestions.mockResolvedValue({ questions: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('logs in an existing guardian and stores the issued auth token', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: '로그인' }));
    fireEvent.change(await screen.findByPlaceholderText('이름을 입력해주세요'), {
      target: { value: '김보호' },
    });
    fireEvent.change(screen.getByPlaceholderText('010-0000-0000'), {
      target: { value: '010-1234-5678' },
    });
    fireEvent.click(screen.getAllByRole('button', { name: '로그인' }).at(-1)!);

    expect(await screen.findByText('부모님의 이야기를 함께 기록해요')).toBeInTheDocument();
    expect(localServerMocks.registerLocalPhoneAccount).toHaveBeenCalledWith('01012345678', '김보호', true, undefined);
    expect(useAuthStore.getState()).toMatchObject({
      role: 'child',
      userId: 'guardian-1',
      authToken: 'login-token',
    });
  });

  it('signs up a guardian, saves the default profile, and refreshes the auth token', async () => {
    localServerMocks.registerLocalPhoneAccount.mockResolvedValueOnce({
      user: guardianUser({ guardianName: null, guardianRelationship: null, guardianPreferredName: null }),
      authToken: 'signup-token',
      isNew: true,
    });

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    fireEvent.change(await screen.findByPlaceholderText('010-0000-0000'), {
      target: { value: '010-2222-3333' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(screen.getByLabelText('인증번호'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));
    fireEvent.change(screen.getByPlaceholderText('예: 민준, 김민준'), {
      target: { value: '김보호' },
    });
    fireEvent.change(screen.getByPlaceholderText('예: 1997-07-04'), {
      target: { value: '1997-07-04' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByText('동의 안내')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('checkbox', { name: /서비스 이용약관 동의/ }));
    fireEvent.click(screen.getByRole('checkbox', { name: /개인정보 처리방침 동의/ }));
    fireEvent.click(screen.getByRole('button', { name: /기록 시작하기/ }));

    await waitFor(() => {
      expect(localServerMocks.updateLocalUserProfile).toHaveBeenCalledWith({
        userId: 'guardian-1',
        role: 'guardian',
        name: '김보호',
        birthDate: '1997-07-04',
        preferredName: '보호자',
        relationship: '자녀',
      });
    });
    expect(await screen.findByText('부모님의 이야기를 함께 기록해요')).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({
      role: 'child',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });
  });

  it('auto logs in from an invitation token and opens the parent welcome step', async () => {
    render(
      <MemoryRouter initialEntries={['/parent/autologin?token=invite-123']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('반갑습니다, 어르신!', {}, { timeout: 3000 })).toBeInTheDocument();
    expect(localServerMocks.loginWithInvitationToken).toHaveBeenCalledWith('invite-123');
    expect(useAuthStore.getState()).toMatchObject({
      role: 'parent',
      userId: 'senior-1',
      authToken: 'invite-token',
    });
  });
});
