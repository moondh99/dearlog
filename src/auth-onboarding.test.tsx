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

vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: vi.fn(async (phoneNumber: string) => {
    const existingSenior = phoneNumber === '01099998888';
    return {
      user: {
        id: `test-user-${phoneNumber.slice(-4)}`,
        name: existingSenior ? '기존 시니어' : `사용자 ${phoneNumber.slice(-4)}`,
        phoneNumber,
        role: existingSenior ? 'senior' : 'pending',
        birthDecade: existingSenior ? '1950년대' : null,
        preferredName: existingSenior ? '어르신' : null,
        seniorName: existingSenior ? '기존 시니어' : null,
        seniorBirthDecade: existingSenior ? '1950년대' : null,
        seniorPreferredName: existingSenior ? '어르신' : null,
        guardianName: null,
        guardianRelationship: null,
        guardianPreferredName: null,
      },
      isNew: !existingSenior,
    };
  }),
  updateLocalUserRole: vi.fn(async (userId: string, role: 'senior' | 'guardian') => ({
    user: {
      id: userId,
      name: role === 'guardian' ? '보호자' : '어르신',
      phoneNumber: '01012345678',
      role,
      birthDecade: null,
      preferredName: role === 'guardian' ? '보호자' : '어르신',
      seniorName: role === 'senior' ? '어르신' : null,
      seniorBirthDecade: null,
      seniorPreferredName: role === 'senior' ? '어르신' : null,
      guardianName: null,
      guardianRelationship: null,
      guardianPreferredName: role === 'guardian' ? '보호자' : null,
    },
  })),
  updateLocalUserProfile: vi.fn(async (input: { userId: string; role: 'senior' | 'guardian'; name: string; birthDecade?: string; preferredName: string; relationship?: string }) => ({
    user: input.role === 'guardian'
      ? {
          id: input.userId,
          name: input.name,
          phoneNumber: '01012345678',
          role: 'guardian',
          birthDecade: null,
          preferredName: input.preferredName,
          seniorName: null,
          seniorBirthDecade: null,
          seniorPreferredName: null,
          guardianName: input.name,
          guardianRelationship: input.relationship ?? '자녀',
          guardianPreferredName: input.preferredName,
        }
      : {
          id: input.userId,
          name: input.name,
          phoneNumber: '01012345678',
          role: 'senior',
          birthDecade: input.birthDecade,
          preferredName: input.preferredName,
          seniorName: input.name,
          seniorBirthDecade: input.birthDecade,
          seniorPreferredName: input.preferredName,
          guardianName: null,
          guardianRelationship: null,
          guardianPreferredName: null,
        },
  })),
  acceptLocalInterviewSession: vi.fn(async () => ({ session: { id: 'test-session', status: 'active' } })),
  createLocalInterviewSession: vi.fn(async () => ({ session: { id: 'test-session' } })),
  endLocalInterviewSession: vi.fn(async () => ({ session: { id: 'test-session', status: 'ended' } })),
  fetchLocalNotifications: vi.fn(async () => ({ notifications: [], unreadCount: 0 })),
  fetchLocalProgress: vi.fn(async () => ({ character: '🌰', totalRecords: 0, progress: [] })),
  fetchLocalVapidPublicKey: vi.fn(async () => ({ publicKey: '' })),
  fetchLocalInterviewRecords: vi.fn(async () => ({ records: [] })),
  fetchLocalChapters: vi.fn(async () => ({ chapters: [] })),
  markLocalNotificationRead: vi.fn(async (id: string) => ({
    notification: { id, type: 'nudge', title: '확인됨', body: '', status: 'read', createdAt: new Date().toISOString(), readAt: new Date().toISOString(), metadata: {} },
  })),
  pauseLocalInterviewSession: vi.fn(async () => ({ session: { id: 'test-session', status: 'paused' } })),
  registerLocalPushSubscription: vi.fn(async () => ({ subscription: {} })),
  saveLocalInterviewRecord: vi.fn(async () => ({ record: {} })),
  uploadLocalAudio: vi.fn(async () => ({ fileKey: 'audio/test.webm', mimeType: 'audio/webm', size: 1 })),
}));

function setSignedOutState() {
  useStore.setState({
    auth: {
      userId: null,
      phoneNumber: '',
      isAuthenticated: false,
      role: null,
      profile: null,
      guardianProfile: null,
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

  it('stores phone login and moves directly to role selection', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('010 1234 5678'), {
      target: { value: '010 1234 5678' },
    });
    fireEvent.click(screen.getByRole('button', { name: '휴대폰 번호로 시작' }));

    expect(await screen.findByRole('heading', { name: '누가 사용하실 건가요?' })).toBeInTheDocument();
    expect(useStore.getState().auth.phoneNumber).toBe('01012345678');
    expect(useStore.getState().auth.userId).toBe('test-user-5678');
    expect(useStore.getState().auth.isAuthenticated).toBe(true);
  });

  it('always shows profile role selection even for an existing phone account', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('010 1234 5678'), {
      target: { value: '01099998888' },
    });
    fireEvent.click(screen.getByRole('button', { name: '휴대폰 번호로 시작' }));

    expect(await screen.findByRole('heading', { name: '누가 사용하실 건가요?' })).toBeInTheDocument();
    expect(useStore.getState().auth).toMatchObject({
      userId: 'test-user-8888',
      role: null,
      onboardingCompleted: false,
    });
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
    fireEvent.click(screen.getByRole('button', { name: '휴대폰 번호로 시작' }));
    
    // Select senior role on SelectModeScreen
    fireEvent.click(await screen.findByTestId('role-senior'));
    fireEvent.click(screen.getByTestId('confirm-role'));

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
    
    // Expect to land on ParentHomeScreen
    expect(await screen.findByText('오늘의 인터뷰')).toBeInTheDocument();
  });

  it('routes guardian role users to the guardian space without locking senior features', async () => {
    render(
      <MemoryRouter initialEntries={['/auth']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('010 1234 5678'), {
      target: { value: '01012345678' },
    });
    fireEvent.click(screen.getByRole('button', { name: '휴대폰 번호로 시작' }));
    
    // Select guardian role on SelectModeScreen
    fireEvent.click(await screen.findByTestId('role-guardian'));
    fireEvent.click(screen.getByTestId('confirm-role'));

    expect(await screen.findByRole('heading', { name: '보호자 기본 정보' })).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('김민수'), {
      target: { value: '김보호' },
    });
    fireEvent.change(screen.getByPlaceholderText('보호자'), {
      target: { value: '딸' },
    });
    fireEvent.click(screen.getByRole('button', { name: '가족 공간 시작' }));

    // Expect to land on ChildHomeScreen
    expect(await screen.findByText('등록한 질문')).toBeInTheDocument();
    expect(useStore.getState().auth).toMatchObject({
      role: 'guardian',
      onboardingCompleted: true,
      guardianProfile: {
        name: '김보호',
        relationship: '자녀',
        preferredName: '딸',
      },
    });
  });
});
