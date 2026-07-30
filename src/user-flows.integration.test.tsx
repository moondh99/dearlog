import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AppRoutes } from './App';
import { useAuthStore } from './store/authStore';
import { useChildStore } from './store/childStore';
import { useInterviewStore } from './store/interviewStore';

const flowMocks = vi.hoisted(() => ({
  registerLocalPhoneAccount: vi.fn(),
  updateLocalUserProfile: vi.fn(),
  loginWithInvitationToken: vi.fn(),
  createParentInvitation: vi.fn(),
  fetchFamilyMembers: vi.fn(),
  fetchLocalChapters: vi.fn(),
  fetchLocalQuestions: vi.fn(),
  fetchLocalInterviewRecords: vi.fn(),
  fetchLocalCalendarEvents: vi.fn(),
  fetchLocalPhotos: vi.fn(),
  fetchLocalFamilyQuestions: vi.fn(),
  fetchLocalAIProxyAuditSummary: vi.fn(),
  uploadLocalPhoto: vi.fn(),
  updateLocalInterviewRecordReview: vi.fn(),
  updateLocalFamilyQuestion: vi.fn(),
  deleteLocalFamilyQuestion: vi.fn(),
  createLocalQuestion: vi.fn(),
  synthesizeLocalQuestionSpeech: vi.fn(),
}));

vi.mock('./lib/local-server', () => ({
  registerLocalPhoneAccount: flowMocks.registerLocalPhoneAccount,
  updateLocalUserProfile: flowMocks.updateLocalUserProfile,
  loginWithInvitationToken: flowMocks.loginWithInvitationToken,
  createParentInvitation: flowMocks.createParentInvitation,
  fetchFamilyMembers: flowMocks.fetchFamilyMembers,
  fetchLocalChapters: flowMocks.fetchLocalChapters,
  fetchLocalQuestions: flowMocks.fetchLocalQuestions,
  fetchLocalInterviewRecords: flowMocks.fetchLocalInterviewRecords,
  fetchLocalCalendarEvents: flowMocks.fetchLocalCalendarEvents,
  fetchLocalPhotos: flowMocks.fetchLocalPhotos,
  fetchLocalFamilyQuestions: flowMocks.fetchLocalFamilyQuestions,
  fetchLocalAIProxyAuditSummary: flowMocks.fetchLocalAIProxyAuditSummary,
  uploadLocalPhoto: flowMocks.uploadLocalPhoto,
  updateLocalInterviewRecordReview: flowMocks.updateLocalInterviewRecordReview,
  updateLocalUserRole: vi.fn(async () => ({ user: {}, authToken: 'role-token' })),
  updateLocalPhoto: vi.fn(async () => ({ photo: {} })),
  deleteLocalPhoto: vi.fn(async () => ({ ok: true })),
  updateLocalFamilyQuestion: flowMocks.updateLocalFamilyQuestion,
  deleteLocalFamilyQuestion: flowMocks.deleteLocalFamilyQuestion,
  createLocalQuestion: flowMocks.createLocalQuestion,
  synthesizeLocalQuestionSpeech: flowMocks.synthesizeLocalQuestionSpeech,
  saveLocalInterviewRecord: vi.fn(async () => ({ record: {} })),
  updateLocalInterviewRecordConsent: vi.fn(async () => ({ record: {} })),
  bulkUpdateLocalInterviewRecordConsent: vi.fn(async () => ({ ok: true })),
  saveLocalCalendarEvent: vi.fn(async () => ({ event: {} })),
  deleteLocalCalendarEvent: vi.fn(async () => ({ ok: true })),
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
  useInterviewStore.setState({
    chapters: [],
    transcripts: [],
  });
  useChildStore.setState({
    questions: [],
    photos: [],
    activeSeniorId: null,
  });
}

describe('core route flows', () => {
  beforeEach(() => {
    resetAuthStore();
    vi.useRealTimers();
    flowMocks.registerLocalPhoneAccount.mockResolvedValue({
      user: {
        id: 'guardian-1',
        name: '김보호',
        phoneNumber: '01022223333',
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
      },
      authToken: 'signup-token',
      isNew: true,
    });
    flowMocks.updateLocalUserProfile.mockResolvedValue({
      user: {
        id: 'guardian-1',
        name: '김보호',
        phoneNumber: '01022223333',
        role: 'guardian',
        birthDate: '1997-07-04',
        birthDecade: null,
        preferredName: '보호자',
        seniorName: null,
        seniorBirthDecade: null,
        seniorPreferredName: null,
        guardianName: '김보호',
        guardianRelationship: '자녀',
        guardianPreferredName: '보호자',
      },
      authToken: 'profile-token',
    });
    flowMocks.loginWithInvitationToken.mockResolvedValue({
      user: {
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
      },
      authToken: 'invite-token',
    });
    flowMocks.fetchFamilyMembers.mockResolvedValue({
      members: [{ id: 'senior-1', name: '김영자', role: 'parent', relationship: '부모님', isMe: false }],
    });
    flowMocks.fetchLocalChapters.mockResolvedValue({ chapters: [] });
    flowMocks.fetchLocalQuestions.mockResolvedValue({ questions: [] });
    flowMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] });
    flowMocks.fetchLocalCalendarEvents.mockResolvedValue({ events: [] });
    flowMocks.fetchLocalPhotos.mockResolvedValue({ photos: [] });
    flowMocks.fetchLocalFamilyQuestions.mockResolvedValue({ questions: [] });
    flowMocks.uploadLocalPhoto.mockResolvedValue({
      photo: {
        id: 'photo-1',
        fileName: 'family.png',
        url: '/api/files/photos/family.png',
        metadata: {
          capturedDate: '1985년 봄',
          location: '외할머니 댁 마당',
          memo: '가족 봄나들이',
          linkedQuestion: '이 사진은 언제 찍은 사진인가요?',
        },
      },
      questions: [{ questionText: '이 사진은 언제 찍은 사진인가요?' }],
    });
    flowMocks.updateLocalInterviewRecordReview.mockResolvedValue({ record: {} });
    flowMocks.updateLocalFamilyQuestion.mockResolvedValue({ question: {} });
    flowMocks.deleteLocalFamilyQuestion.mockResolvedValue({ ok: true });
    flowMocks.createLocalQuestion.mockResolvedValue({ question: {} });
    flowMocks.synthesizeLocalQuestionSpeech.mockResolvedValue(new Blob(['audio'], { type: 'audio/mpeg' }));
    flowMocks.fetchLocalAIProxyAuditSummary.mockResolvedValue({
      window: { from: '2026-05-31T00:00:00.000Z', to: '2026-05-31T01:00:00.000Z', minutes: 60 },
      totals: {
        requests: 0,
        success: 0,
        invalidRequest: 0,
        rateLimited: 0,
        configError: 0,
        providerError: 0,
        estimatedUnits: 0,
        avgLatencyMs: 0,
        errorRatePercent: 0,
      },
      byEndpoint: [],
      byUser: [],
      recentErrors: [],
      alerts: [],
      alertThresholds: { errorRatePercent: 25, rateLimitedCount: 10, minRequests: 5 },
      retention: { days: 30, cutoff: '2026-05-01T00:00:00.000Z', deletedOldLogs: 0 },
    });
    flowMocks.createParentInvitation.mockResolvedValue({
      invitation: {
        id: 'invitation-1',
        token: 'invite-token',
        guardianId: 'guardian-1',
        seniorId: 'senior-new',
        status: 'active',
        expiresAt: '2026-06-30T00:00:00.000Z',
        revokedAt: null,
        usedAt: null,
        createdAt: '2026-05-31T00:00:00.000Z',
        updatedAt: '2026-05-31T00:00:00.000Z',
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('moves from splash through intro and signup into the guardian home route', async () => {
    flowMocks.fetchFamilyMembers.mockResolvedValueOnce({
      members: [
        { id: 'senior-1', name: '김영자', role: 'parent', relationship: '부모님', isMe: false },
        { id: 'senior-2', name: '박순자어머니긴이름', role: 'parent', relationship: '부모님', isMe: false },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/splash']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: '시작하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '디어로그 시작하기' }));
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));
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

    expect(await screen.findByText('부모님의 이야기를 함께 기록해요')).toBeInTheDocument();
    expect(await screen.findByText('김영자')).toBeInTheDocument();
    expect(await screen.findByText('박순자어머니긴이름')).toBeInTheDocument();
    expect(screen.getByText('2명')).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({
      role: 'child',
      userId: 'guardian-1',
      authToken: 'profile-token',
    });
  });

  it('accepts an invitation, completes parent welcome, and enters the parent home route', async () => {
    flowMocks.updateLocalUserProfile.mockResolvedValueOnce({
      user: {
        id: 'senior-1',
        name: '영자 엄마',
        phoneNumber: null,
        role: 'senior',
        birthDate: null,
        birthDecade: '1950년대',
        preferredName: '영자 엄마',
        seniorName: '영자 엄마',
        seniorBirthDecade: '1950년대',
        seniorPreferredName: '영자 엄마',
        guardianName: '김보호',
        guardianRelationship: null,
        guardianPreferredName: null,
      },
      authToken: 'senior-profile-token',
    });

    render(
      <MemoryRouter initialEntries={['/parent/autologin?token=invite-123']}>
        <AppRoutes />
      </MemoryRouter>
    );

    fireEvent.change(await screen.findByPlaceholderText('예: 엄마, 아버지, 김영자 등', {}, { timeout: 3000 }), {
      target: { value: '영자 엄마' },
    });
    fireEvent.click(screen.getByRole('button', { name: '1950년대' }));
    fireEvent.click(screen.getByRole('button', { name: /소중한 이야기 시작하기/ }));

    await waitFor(() => {
      expect(flowMocks.updateLocalUserProfile).toHaveBeenCalledWith({
        userId: 'senior-1',
        role: 'senior',
        name: '영자 엄마',
        preferredName: '영자 엄마',
        birthDecade: '1950년대',
      });
    });
    expect(await screen.findByText(/가족이 이야기를/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '지금 시작하기' })).toBeInTheDocument();
    expect(useAuthStore.getState()).toMatchObject({
      role: 'parent',
      userId: 'senior-1',
      userName: '영자 엄마',
      authToken: 'senior-profile-token',
    });
  });

  it('creates a new parent record space from the optimized setup screen', async () => {
    flowMocks.fetchFamilyMembers.mockResolvedValue({
      members: [{
        id: 'senior-new',
        name: '아버지',
        role: 'parent',
        relationship: '아버지',
        recordSpaceName: '아버지 기록 공간',
        isMe: false,
      }],
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
    Object.defineProperty(window, 'isSecureContext', {
      configurable: true,
      value: true,
    });
    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });

    render(
      <MemoryRouter initialEntries={['/child/record-space/new']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('기록 공간 생성하기')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('예: 김영숙씨 생애일기'), {
      target: { value: '아버지 기록 공간' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByLabelText('부모님 이름 또는 호칭')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('예: 엄마, 김영숙'), {
      target: { value: '아버지' },
    });
    expect(screen.queryByPlaceholderText('예: 어머니, 외할머니')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '생년월일 선택' }));
    fireEvent.click(await screen.findByRole('button', { name: '선택 완료' }));
    fireEvent.click(screen.getByRole('button', { name: '아버지' }));
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByLabelText('직업명')).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText('예: 교사, 건축가'), {
      target: { value: '교사' },
    });
    fireEvent.change(screen.getByPlaceholderText('예: 강원도 춘천, 경기도 수원'), {
      target: { value: '강원도 춘천' },
    });
    fireEvent.change(screen.getByPlaceholderText('초/중/고/대학교 순으로 적어주세요.'), {
      target: { value: '춘천고등학교' },
    });
    fireEvent.click(screen.getByRole('button', { name: '다음' }));
    expect(await screen.findByRole('heading', { name: /부모님을\s*초대해보세요/ })).toBeInTheDocument();
    expect(screen.getByText('1952년생 · 아버지')).toBeInTheDocument();

    const createButton = await screen.findByRole('button', { name: '기록 공간 생성하기' });
    await waitFor(() => expect(createButton).toBeEnabled());

    fireEvent.click(screen.getByRole('button', { name: '링크로 초대하기' }));
    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/parent/autologin?token=invite-token'));
    });
    expect(await screen.findByRole('status')).toHaveTextContent('초대 링크를 복사했어요.');

    fireEvent.click(createButton);

    await waitFor(() => {
      expect(flowMocks.createParentInvitation).toHaveBeenCalledWith(expect.objectContaining({
        seniorName: '아버지',
        recordSpaceName: '아버지 기록 공간',
        birthDate: '1952-03-12',
        relationship: '아버지',
        hasCurrentJob: false,
        occupation: '교사',
        hometown: '강원도 춘천',
        schoolHistory: '춘천고등학교',
      }));
    });
    expect(flowMocks.createParentInvitation).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole('heading', { name: '기록 공간이 열렸어요' })).toBeInTheDocument();
    expect(screen.getByText('아버지 기록 공간')).toBeInTheDocument();
    expect(screen.getByText('아버지')).toBeInTheDocument();
    expect(screen.getByText('응답 대기 중')).toBeInTheDocument();
    expect(useChildStore.getState().activeSeniorId).toBe('senior-new');
    fireEvent.click(screen.getByRole('button', { name: '질문 준비하기' }));
    expect(await screen.findByText('부모님께 남길 질문')).toBeInTheDocument();
    expect(await screen.findByText('현재 기록 공간')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '질문 추가' }));
    expect(await screen.findByText('어떤 방식으로 질문을 만들까요?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /텍스트로 질문 만들기/ }));
    expect(await screen.findByRole('heading', { name: '질문 만들기' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('부모님께 묻고 싶은 이야기를 적어보세요.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '일과 삶' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '질문 저장하기' })).toBeDisabled();
  });

  it('prevents duplicate recommended questions and exposes question deletion', async () => {
    const repeatedQuestion = '처음으로 일을 시작했을 때 어떤 기분이었나요?';
    flowMocks.fetchLocalFamilyQuestions
      .mockResolvedValueOnce({
        questions: [{
          id: 'question-1',
          questionText: repeatedQuestion,
          chapterId: 'youth',
          category: 'guardian_questions',
          photoId: null,
          anonymous: false,
          submittedBy: '자녀',
          priority: 'normal',
          status: 'pending',
          createdAt: '2026-06-03T00:00:00.000Z',
        }],
      })
      .mockResolvedValue({ questions: [] });

    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });

    render(
      <MemoryRouter initialEntries={['/child/questions']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('부모님께 남길 질문')).toBeInTheDocument();
    const registeredRecommendation = await screen.findByRole('button', {
      name: /처음으로 일을 시작했을 때 어떤 기분이었나요\?.*등록됨/,
    });
    expect(registeredRecommendation).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: `${repeatedQuestion} 삭제` }));

    await waitFor(() => {
      expect(flowMocks.deleteLocalFamilyQuestion).toHaveBeenCalledWith('question-1');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('질문을 삭제했어요.');
  });

  it('shows feedback when switching the active parent record space', async () => {
    flowMocks.fetchFamilyMembers.mockResolvedValue({
      members: [
        {
          id: 'senior-1',
          name: '김영자',
          role: 'parent',
          relationship: '어머니',
          recordSpaceName: '영자 생애일기',
          isMe: false,
        },
        {
          id: 'senior-2',
          name: '박순자',
          role: 'parent',
          relationship: '이모',
          recordSpaceName: '순자 생애일기',
          isMe: false,
        },
      ],
    });

    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });
    useChildStore.setState({ activeSeniorId: 'senior-1' });

    render(
      <MemoryRouter initialEntries={['/child']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('기록 공간 선택하기')).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button', { name: /순자 생애일기/ }));

    await waitFor(() => {
      expect(useChildStore.getState().activeSeniorId).toBe('senior-2');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('기록 공간을 전환했어요. 순자 생애일기');
  });

  it('shows all parent-facing questions beyond the first six', async () => {
    const textQuestions = Array.from({ length: 8 }, (_, index) => ({
      id: `text-question-${index + 1}`,
      text: `${index + 1}번째 부모님 질문입니다`,
      chapterId: 'messages',
      category: 'guardian_questions',
      status: 'pending',
      createdAt: `2026-06-03T00:0${index}:00.000Z`,
    }));
    const photoQuestions = Array.from({ length: 2 }, (_, index) => ({
      id: `photo-question-${index + 1}`,
      text: `${index + 1}번째 사진 질문입니다`,
      chapterId: 'messages',
      category: 'photo_questions',
      photoId: `photo-${index + 1}`,
      photoUrl: `/api/files/photos/photo-${index + 1}.png`,
      status: 'pending',
      createdAt: `2026-06-03T00:1${index}:00.000Z`,
    }));
    flowMocks.fetchLocalChapters.mockResolvedValueOnce({
      chapters: [{ id: 'messages', order: 1, title: '자녀에게 남기는 말' }],
    });
    flowMocks.fetchLocalQuestions.mockResolvedValueOnce({
      questions: [...textQuestions, ...photoQuestions],
    });
    flowMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] });

    useAuthStore.setState({
      role: 'parent',
      userName: '김영자',
      userId: 'senior-1',
      phoneNumber: '01022223333',
      authToken: 'parent-token',
    });

    render(
      <MemoryRouter initialEntries={['/parent/interview']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('기록할 이야기를 골라주세요')).toBeInTheDocument();
    expect(await screen.findByText('1번째 부모님 질문입니다')).toBeInTheDocument();
    expect(screen.getByText('8번째 부모님 질문입니다')).toBeInTheDocument();
    expect(screen.getByText('1번째 사진 질문입니다')).toBeInTheDocument();
    expect(screen.getByText('2번째 사진 질문입니다')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '답하기' })).toHaveLength(8);
    expect(screen.getAllByRole('button', { name: '이야기하기' })).toHaveLength(2);
  });

  it('puts newly added child questions first on the parent answer picker', async () => {
    flowMocks.fetchLocalChapters.mockResolvedValueOnce({
      chapters: [
        { id: 'childhood', order: 1, title: '어린 시절' },
        { id: 'messages', order: 2, title: '자녀에게 남기는 말' },
      ],
    });
    flowMocks.fetchLocalQuestions.mockResolvedValueOnce({
      questions: [
        {
          id: 'common-old',
          text: '기존 공통 질문입니다',
          chapterId: 'childhood',
          category: 'common_questions',
          status: 'pending',
          createdAt: '2026-06-03T00:00:00.000Z',
        },
        {
          id: 'guardian-old',
          text: '예전에 자녀가 추가한 질문입니다',
          chapterId: 'messages',
          category: 'guardian_questions',
          status: 'pending',
          createdAt: '2026-06-04T00:00:00.000Z',
        },
        {
          id: 'guardian-new',
          text: '방금 자녀가 추가한 질문입니다',
          chapterId: 'messages',
          category: 'guardian_questions',
          status: 'pending',
          createdAt: '2026-06-08T12:00:00.000Z',
        },
      ],
    });
    flowMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: [] });

    useAuthStore.setState({
      role: 'parent',
      userName: '김영자',
      userId: 'senior-1',
      phoneNumber: '01022223333',
      authToken: 'parent-token',
    });

    render(
      <MemoryRouter initialEntries={['/parent/interview']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('기록할 이야기를 골라주세요')).toBeInTheDocument();
    const questionHeadings = await screen.findAllByRole('heading', { level: 3 });
    expect(questionHeadings.map((heading) => heading.textContent)).toEqual([
      '방금 자녀가 추가한 질문입니다',
      '예전에 자녀가 추가한 질문입니다',
      '기존 공통 질문입니다',
    ]);
    const firstQuestionCard = screen.getByText('방금 자녀가 추가한 질문입니다').closest('article');
    expect(firstQuestionCard).toHaveTextContent('새 질문');
    fireEvent.click(within(firstQuestionCard as HTMLElement).getByRole('button', { name: '답하기' }));
    expect(await screen.findByRole('heading', { name: '방금 자녀가 추가한 질문입니다' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '질문 목록으로 돌아가기' }));
    expect(await screen.findByText('기록할 이야기를 골라주세요')).toBeInTheDocument();
    const reopenedQuestionCard = screen.getByText('방금 자녀가 추가한 질문입니다').closest('article');
    expect(reopenedQuestionCard).not.toHaveTextContent('새 질문');
  });

  it('counts saved interview records in child progress even when question status is not synced', async () => {
    const pendingQuestions = Array.from({ length: 6 }, (_, index) => ({
      id: `pending-question-${index + 1}`,
      questionText: `${index + 1}번째 대기 질문`,
      text: `${index + 1}번째 대기 질문`,
      chapterId: 'childhood',
      category: 'guardian_questions',
      status: 'pending',
      createdAt: '2026-06-04T00:00:00.000Z',
    }));
    const savedRecords = Array.from({ length: 11 }, (_, index) => ({
      id: `record-${index + 1}`,
      questionId: '',
      chapterId: 'childhood',
      chapter: { title: '어린 시절' },
      transcriptText: `${index + 1}번째 저장된 답변입니다`,
      aiSummary: `${index + 1}번째 저장된 답변입니다`,
      mode: 'text',
      reviewStatus: 'pending',
      recordedAt: `2026-06-04T00:${String(index).padStart(2, '0')}:00.000Z`,
    }));
    flowMocks.fetchLocalChapters.mockResolvedValue({ chapters: [{ id: 'childhood', order: 1, title: '어린 시절' }] });
    flowMocks.fetchLocalQuestions.mockResolvedValue({ questions: [] });
    flowMocks.fetchLocalFamilyQuestions.mockResolvedValue({ questions: pendingQuestions });
    flowMocks.fetchLocalInterviewRecords.mockResolvedValue({ records: savedRecords });

    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });

    render(
      <MemoryRouter initialEntries={['/child/progress']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByText('기록공간이 진행중이에요')).toBeInTheDocument();
    expect(await screen.findByText('답변 11개 · 대기 6개')).toBeInTheDocument();
  });

  it('opens the Figma photo upload form from the question creation flow and saves metadata', async () => {
    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });

    render(
      <MemoryRouter initialEntries={[{ pathname: '/child/photos', state: { fromQuestions: true } }]}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: /사진으로 기억을\s*열어보세요/ })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: 1985년 봄')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: 외할머니 댁 마당')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('이 사진에 대해 기억하는 것을 적어보세요')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('예: "이 사진은 언제 찍은 사진인가요?"')).toBeInTheDocument();

    const file = new File(['photo'], 'family.png', { type: 'image/png' });
    fireEvent.change(screen.getByLabelText('사진 파일 선택'), {
      target: { files: [file] },
    });
    fireEvent.change(screen.getByPlaceholderText('예: 1985년 봄'), {
      target: { value: '1985년 봄' },
    });
    fireEvent.change(screen.getByPlaceholderText('예: 외할머니 댁 마당'), {
      target: { value: '외할머니 댁 마당' },
    });
    fireEvent.change(screen.getByPlaceholderText('이 사진에 대해 기억하는 것을 적어보세요'), {
      target: { value: '가족 봄나들이' },
    });
    fireEvent.change(screen.getByPlaceholderText('예: "이 사진은 언제 찍은 사진인가요?"'), {
      target: { value: '이 사진은 언제 찍은 사진인가요?' },
    });
    fireEvent.click(screen.getByRole('button', { name: '사진 올리기' }));

    await waitFor(() => {
      expect(flowMocks.uploadLocalPhoto).toHaveBeenCalledWith(file, 'childhood', {
        capturedDate: '1985년 봄',
        location: '외할머니 댁 마당',
        memo: '가족 봄나들이',
        linkedQuestion: '이 사진은 언제 찍은 사진인가요?',
      });
    });
  });

  it('opens the chapter review list and expands a story for review', async () => {
    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });
    flowMocks.fetchLocalChapters.mockResolvedValueOnce({
      chapters: [{ id: 'childhood', order: 1, title: '유년기' }],
    });
    flowMocks.fetchLocalQuestions.mockResolvedValueOnce({
      questions: [
        { id: 'q-1', text: '어릴 때 가장 좋아했던 음식은 무엇인가요?', chapterId: 'childhood', status: 'answered' },
        { id: 'q-2', text: '어린 시절 집 주변 풍경은 어땠나요?', chapterId: 'childhood', status: 'pending' },
      ],
    });
    flowMocks.fetchLocalInterviewRecords.mockResolvedValueOnce({
      records: [{
        id: 'record-1',
        questionId: 'q-1',
        question: { text: '어릴 때 가장 좋아했던 음식은 무엇인가요?' },
        chapterId: 'childhood',
        transcriptText: '어릴 때는 된장찌개를 제일 좋아했어요.',
        aiSummary: '어린 시절 가장 좋아한 음식은 된장찌개였다고 회상했다.',
        mode: 'app_call',
        audioFileKey: 'audio/record-1.webm',
        audioUrl: '/api/files/audio/record-1.webm?token=test',
        reviewStatus: 'pending',
        recordedAt: '2024-12-18T00:00:00.000Z',
      }],
    });
    const interviewRecordCallOffset = flowMocks.fetchLocalInterviewRecords.mock.calls.length;

    render(
      <MemoryRouter initialEntries={['/child/chapters']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '챕터를 정리해보세요' })).toBeInTheDocument();
    await waitFor(() => {
      const calls = flowMocks.fetchLocalInterviewRecords.mock.calls.slice(interviewRecordCallOffset);
      expect(calls).toEqual(expect.arrayContaining([['senior-1']]));
    });
    fireEvent.click(screen.getByRole('button', { name: '검수하러 가기' }));
    expect(await screen.findByRole('heading', { name: '검수가 필요한 이야기' })).toBeInTheDocument();
    expect(screen.getByText('어릴 때 가장 좋아했던 음식은 무엇인가요')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /확인하기/ }));
    expect(await screen.findByRole('heading', { name: '어릴 때 가장 좋아했던 음식은 무엇인가요' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '정리본' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '원문' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '수정 요청' })).toBeInTheDocument();
    expect(screen.getByText('어린 시절 가장 좋아한 음식은 된장찌개였다고 회상했다.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '챕터에 반영하기' }));
    await waitFor(() => {
      expect(flowMocks.updateLocalInterviewRecordReview).toHaveBeenCalledWith('record-1', { reviewStatus: 'applied' });
    });
    expect(await screen.findByRole('button', { name: '챕터에 반영됨' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '원문' }));
    expect(screen.getByText('원문 질문')).toBeInTheDocument();
    expect(screen.getByText('원본 음성')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '원문 듣기' })).toBeInTheDocument();
    expect(screen.getByText(/된장찌개를 제일 좋아했어요/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '수정 요청' }));
    expect(screen.getByText('정리본에 수정이 필요한 부분을 알려주세요.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '내용이 달라요' }));
    fireEvent.change(screen.getByPlaceholderText('수정하고 싶은 내용을 적어주세요.'), {
      target: { value: '된장찌개가 아니라 청국장에 가까웠다고 정정하고 싶어요.' },
    });
    expect(screen.getByRole('button', { name: '수정 요청 보내기' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '수정 요청 보내기' }));
    await waitFor(() => {
      expect(flowMocks.updateLocalInterviewRecordReview).toHaveBeenLastCalledWith('record-1', {
        reviewStatus: 'revision_requested',
        reviewRequestText: '사유: 내용이 달라요\n요청 내용: 된장찌개가 아니라 청국장에 가까웠다고 정정하고 싶어요.',
      });
    });
  });

  it('shows clear disabled audio states for text records and missing audio files', async () => {
    useAuthStore.setState({
      role: 'child',
      userName: '김보호',
      userId: 'guardian-1',
      phoneNumber: '01022223333',
      authToken: 'profile-token',
    });
    flowMocks.fetchLocalChapters.mockResolvedValue({
      chapters: [{ id: 'childhood', order: 1, title: '유년기' }],
    });
    flowMocks.fetchLocalQuestions.mockResolvedValue({
      questions: [
        { id: 'q-text', text: '텍스트 기록 질문', chapterId: 'childhood', status: 'answered' },
        { id: 'q-missing', text: '음성 누락 질문', chapterId: 'childhood', status: 'answered' },
      ],
    });
    flowMocks.fetchLocalInterviewRecords.mockResolvedValue({
      records: [
        {
          id: 'record-text',
          questionId: 'q-text',
          question: { text: '텍스트 기록 질문' },
          chapterId: 'childhood',
          transcriptText: '직접 입력한 텍스트 기록입니다.',
          aiSummary: '직접 입력한 텍스트 기록입니다.',
          mode: 'text',
          audioFileKey: 'audio/manual-entry.txt',
          audioUrl: null,
          reviewStatus: 'pending',
          recordedAt: '2024-12-19T00:00:00.000Z',
        },
        {
          id: 'record-missing',
          questionId: 'q-missing',
          question: { text: '음성 누락 질문' },
          chapterId: 'childhood',
          transcriptText: '음성 파일이 누락된 기록입니다.',
          aiSummary: '음성 파일이 누락된 기록입니다.',
          mode: 'app_call',
          audioFileKey: 'audio/missing-record.webm',
          audioUrl: null,
          reviewStatus: 'pending',
          recordedAt: '2024-12-18T00:00:00.000Z',
        },
      ],
    });

    render(
      <MemoryRouter initialEntries={['/child/chapters']}>
        <AppRoutes />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: '챕터를 정리해보세요' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '검수하러 가기' }));
    expect(await screen.findByRole('heading', { name: '검수가 필요한 이야기' })).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: '확인하기' })[0]);
    fireEvent.click(await screen.findByRole('button', { name: '원문' }));
    expect(screen.getByRole('button', { name: '텍스트 기록' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: '검수 목록으로 돌아가기' }));
    fireEvent.click(screen.getAllByRole('button', { name: '확인하기' })[1]);
    fireEvent.click(await screen.findByRole('button', { name: '원문' }));
    expect(screen.getByRole('button', { name: '음성 파일 없음' })).toBeDisabled();
  });
});
