import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { useAuthStore } from './store/authStore';

const localServerMocks = vi.hoisted(() => ({
  registerLocalPhoneAccount: vi.fn(),
  requestLocalPhoneOtp: vi.fn(),
  verifyLocalPhoneOtp: vi.fn(),
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
  requestLocalPhoneOtp: localServerMocks.requestLocalPhoneOtp,
  verifyLocalPhoneOtp: localServerMocks.verifyLocalPhoneOtp,
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
    localServerMocks.requestLocalPhoneOtp.mockReset();
    localServerMocks.verifyLocalPhoneOtp.mockReset();
    localServerMocks.registerLocalPhoneAccount.mockReset();
    localServerMocks.requestLocalPhoneOtp.mockResolvedValue({ ok: true, expiresInSeconds: 180, resendAfterSeconds: 60, sentTo: 'gu*****@example.com' });
    localServerMocks.verifyLocalPhoneOtp.mockResolvedValue({ verificationToken: 'otp-token', expiresInSeconds: 600 });
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
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(await screen.findByLabelText('인증번호'), {
      target: { value: '654321' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));

    expect(await screen.findByText('부모님의 이야기를 함께 기록해요')).toBeInTheDocument();
    expect(localServerMocks.requestLocalPhoneOtp).toHaveBeenCalledWith('01012345678', 'login', undefined);
    expect(localServerMocks.verifyLocalPhoneOtp).toHaveBeenCalledWith('01012345678', 'login', '654321');
    expect(localServerMocks.registerLocalPhoneAccount).toHaveBeenCalledWith('01012345678', '김보호', true, undefined, 'otp-token');
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
    fireEvent.change(screen.getByPlaceholderText('example@gmail.com'), {
      target: { value: 'guardian@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(await screen.findByLabelText('인증번호'), {
      target: { value: '123456' },
    });
    expect(screen.getByText(/gu\*+@example\.com 메일함으로 보낸/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));
    fireEvent.change(await screen.findByPlaceholderText('예: 민준, 김민준'), {
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
    expect(localServerMocks.requestLocalPhoneOtp).toHaveBeenCalledWith('01022223333', 'signup', 'guardian@example.com');
    expect(localServerMocks.registerLocalPhoneAccount).toHaveBeenCalledWith('01022223333', '김보호', false, '1997-07-04', 'otp-token');
    expect(useAuthStore.getState()).toMatchObject({
      role: 'child',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });
  });

  it('keeps the user on the code step when the server rejects the code', async () => {
    localServerMocks.verifyLocalPhoneOtp.mockRejectedValueOnce(new Error('인증번호가 맞지 않습니다. 4번 더 입력할 수 있습니다.'));

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
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));
    fireEvent.change(await screen.findByLabelText('인증번호'), {
      target: { value: '000000' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증하기' }));

    expect(await screen.findByText('인증번호가 맞지 않습니다. 4번 더 입력할 수 있습니다.')).toBeInTheDocument();
    expect(screen.getByLabelText('인증번호')).toBeInTheDocument();
    expect(localServerMocks.registerLocalPhoneAccount).not.toHaveBeenCalled();
    expect(useAuthStore.getState().authToken).toBeNull();
  });

  it('stays on the phone step and shows why when the code cannot be sent', async () => {
    localServerMocks.requestLocalPhoneOtp.mockRejectedValueOnce(
      new Error('인증번호를 보낼 수 없어 지금은 로그인과 가입을 할 수 없습니다. 운영자에게 문의해 주세요.'),
    );

    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: '회원가입' }));
    fireEvent.change(await screen.findByPlaceholderText('010-0000-0000'), {
      target: { value: '010-2222-3333' },
    });
    fireEvent.change(screen.getByPlaceholderText('example@gmail.com'), {
      target: { value: 'guardian@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: '인증번호 받기' }));

    expect(await screen.findByText(/인증번호를 보낼 수 없어/)).toBeInTheDocument();
    expect(screen.queryByLabelText('인증번호')).not.toBeInTheDocument();
    expect(localServerMocks.registerLocalPhoneAccount).not.toHaveBeenCalled();
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
