import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ArchivePage from './pages/ArchivePage';
import AutobiographyPage from './pages/AutobiographyPage';
import PersonaPage from './pages/PersonaPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import { useStore } from './store';
import { makeMemory, makePhoto, resetStoreForTest } from './test-utils/store-fixtures';

const flowMocks = vi.hoisted(() => ({
  download: vi.fn(async (_autobiography: unknown) => undefined),
  addMemoryToRag: vi.fn(async () => undefined),
  generateChapters: vi.fn(async () => [
    {
      id: 'chapter-v2-family',
      category: '가족',
      title: '가족과 함께한 시간',
      narrative: '처음 서울에 올라온 날, 어머니의 손을 꼭 잡고 있었습니다.',
      sourceChunks: [{ sentenceRange: [0, 0], memoryId: 'memory-1' }],
      styleRatio: { conversational: 0.6, literary: 0.4 },
    },
  ]),
}));

vi.mock('./lib/pdf/generator', () => ({
  download: flowMocks.download,
}));

vi.mock('./lib/rag/index', () => ({
  ragIndex: {
    addMemory: flowMocks.addMemoryToRag,
  },
}));

vi.mock('./lib/agents/ghostwriter', () => ({
  AUTOBIOGRAPHY_STYLE_LABELS: {
    memoir: '회고문',
    news: '기사체',
    letter: '편지체',
    interview: '인터뷰체',
    diary: '일기체',
  },
  generateAllChaptersV2: flowMocks.generateChapters,
  toPDFReadyAutobiography: vi.fn((chapters, title, style) => ({
    title,
    generatedAt: '2024-01-01T00:00:00.000Z',
    chapters: chapters.map((chapter: any) => ({
      chapterId: chapter.id,
      title: style === 'news' ? `${chapter.title} - 가족 뉴스` : chapter.title,
      body: chapter.narrative,
      citations: [{ sentenceIndex: 0, memoryId: 'memory-1' }],
    })),
  })),
}));

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('core user flows', () => {
  beforeEach(() => {
    resetStoreForTest();
    flowMocks.download.mockClear();
    flowMocks.addMemoryToRag.mockClear();
    flowMocks.generateChapters.mockClear();
    flowMocks.generateChapters.mockResolvedValue([
      {
        id: 'chapter-v2-family',
        category: '가족',
        title: '가족과 함께한 시간',
        narrative: '처음 서울에 올라온 날, 어머니의 손을 꼭 잡고 있었습니다.',
        sourceChunks: [{ sentenceRange: [0, 0], memoryId: 'memory-1' }],
        styleRatio: { conversational: 0.6, literary: 0.4 },
      },
    ]);
  });

  it('lets family submit a question, edit a memory, and change privacy', () => {
    useStore.setState({ memories: [makeMemory()] });
    renderWithRouter(<ReviewPage />);

    fireEvent.change(screen.getByPlaceholderText(/할머니가 처음 서울/), {
      target: { value: '서울에 처음 오셨을 때 가장 기억나는 장면은 무엇인가요?' },
    });
    fireEvent.change(screen.getByDisplayValue('보통 우선순위'), {
      target: { value: 'high' },
    });
    fireEvent.click(screen.getByLabelText('익명 질문'));
    fireEvent.click(screen.getByRole('button', { name: '질문 등록' }));

    expect(screen.getByText('질문 모으기')).toBeInTheDocument();
    expect(screen.getByText('기억 검수하기')).toBeInTheDocument();
    expect(screen.getByText('다시 꺼내기')).toBeInTheDocument();
    expect(screen.getByText('기억의 통제권은 사용자에게 있습니다')).toBeInTheDocument();
    expect(screen.getByText('철회와 삭제 가능')).toBeInTheDocument();
    expect(screen.getAllByText('서울에 처음 오셨을 때 가장 기억나는 장면은 무엇인가요?').length).toBeGreaterThan(0);
    expect(screen.getByText('월 구독 재방문 루프')).toBeInTheDocument();
    expect(screen.getByText('이번 주 가족 퀴즈 보내기')).toBeInTheDocument();
    expect(screen.getByText('가족 질문 이어 묻기')).toBeInTheDocument();
    expect(screen.getByText('다음 인터뷰에 연결')).toBeInTheDocument();
    expect(useStore.getState().familyQuestions.questions[0]).toMatchObject({
      priority: 'high',
      anonymous: true,
      status: 'pending',
    });

    fireEvent.click(screen.getByRole('button', { name: '수정하기' }));
    fireEvent.change(screen.getByDisplayValue('처음 서울에 올라온 날의 기억입니다.'), {
      target: { value: '가족에게 전할 서울 첫날의 기억입니다.' },
    });
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(useStore.getState().memories[0].publishVersion).toBe('가족에게 전할 서울 첫날의 기억입니다.');

    fireEvent.click(screen.getByRole('button', { name: /나만 보기/ }));
    expect(useStore.getState().memories[0].privacy).toBe('private');
  });

  it('lets family revoke all usage and delete a memory with linked data cleanup', () => {
    useStore.setState({
      memories: [makeMemory()],
      photos: { photos: [makePhoto()], lastUpdated: '2024-01-01T00:00:00.000Z' },
      ragIndex: {
        entries: [{ memoryId: 'memory-1', embedding: [0.1, 0.2], text: '서울 기억' }],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      },
      familyQuestions: {
        questions: [{
          id: 'q-linked',
          questionText: '서울 첫날은 어땠나요?',
          submittedBy: 'u',
          anonymous: false,
          priority: 'normal',
          status: 'answered',
          createdAt: '2024-01-01T00:00:00.000Z',
          answeredAt: '2024-01-02T00:00:00.000Z',
          answerMemoryId: 'memory-1',
        }],
        lastUpdated: '2024-01-01T00:00:00.000Z',
      },
      autobiography: {
        currentStructure: null,
        narratives: [{
          chapterId: 'chapter-linked',
          title: '서울 첫날',
          body: '서울 첫날 이야기',
          citations: [{ sentenceIndex: 0, memoryId: 'memory-1' }],
        }],
        lastGenerated: '2024-01-01T00:00:00.000Z',
      },
    });

    renderWithRouter(<ReviewPage />);

    fireEvent.click(screen.getByRole('button', { name: '모든 활용 중지' }));
    const revokedMemory = useStore.getState().memories[0];
    expect(revokedMemory.privacy).toBe('private');
    expect(revokedMemory.consent.status).toBe('revoked');
    expect(Object.values(revokedMemory.consentSettings ?? {})).toEqual([
      'revoked',
      'revoked',
      'revoked',
      'revoked',
      'revoked',
    ]);
    expect(useStore.getState().ragIndex.entries).toEqual([]);

    fireEvent.click(screen.getByRole('button', { name: '기억 삭제' }));
    expect(screen.getByRole('button', { name: '정말 삭제할까요?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '정말 삭제할까요?' }));

    expect(useStore.getState().memories).toEqual([]);
    expect(useStore.getState().photos.photos[0].linkedMemoryIds).toEqual([]);
    expect(useStore.getState().familyQuestions.questions[0].answerMemoryId).toBeNull();
    expect(useStore.getState().autobiography.narratives).toEqual([]);
    expect(screen.getByText('검토할 기억이 없습니다.')).toBeInTheDocument();
  });

  it('shows archive tabs for map, photos, and review alerts from stored memories', () => {
    const memory = makeMemory({
      contradictions: ['memory-2'],
      confidenceLabel: '추가 확인 필요',
      tags: {
        people: ['어머니'],
        places: ['서울'],
        emotions: ['상실'],
        timePeriod: '1970년대',
      },
    });
    useStore.setState({
      memories: [memory],
      photos: { photos: [makePhoto()], lastUpdated: '2024-01-01T00:00:00.000Z' },
    });

    renderWithRouter(<ArchivePage />);

    expect(screen.getAllByText('태그 DB').length).toBeGreaterThan(0);
    expect(screen.getByText('사진 메타데이터 활용')).toBeInTheDocument();
    expect(screen.getByText('원본 메타데이터')).toBeInTheDocument();
    expect(screen.getByText(/Canon EOS 80D/)).toBeInTheDocument();
    expect(screen.getAllByText('공개 전 확인 필요').length).toBeGreaterThan(0);
    expect(screen.queryByText(/37.50000, 127.00000/)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: /기억 지도/ }));
    expect(screen.getByText('서울')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /사진 앨범/ }));
    expect(screen.getByText('사진 회상 앨범')).toBeInTheDocument();
    expect(screen.getByText(/연결 기억: 서울에 처음 올라온 날/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /검증 필요/ }));
    expect(screen.getByText('검증 및 보호 필요 항목')).toBeInTheDocument();
    expect(screen.getByText(/민감정보 동의 확인 필요/)).toBeInTheDocument();
    expect(screen.getByText(/충돌 후보 1건/)).toBeInTheDocument();
  });

  it('lets settings register a calendar event through the calendar tab', () => {
    renderWithRouter(<SettingsPage />);

    expect(screen.getByText('기억의 통제권은 사용자에게 있습니다')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /가족 일정/ }));
    fireEvent.change(screen.getByPlaceholderText('일정 제목'), {
      target: { value: '손녀 졸업식' },
    });
    fireEvent.change(screen.getByDisplayValue('생일'), {
      target: { value: '졸업' },
    });
    fireEvent.change(screen.getByDisplayValue(/\d{4}-\d{2}-\d{2}/), {
      target: { value: '2026-05-20' },
    });
    fireEvent.change(screen.getByPlaceholderText('관련 인물, 쉼표로 구분'), {
      target: { value: '민지' },
    });
    fireEvent.click(screen.getByRole('button', { name: '일정 등록' }));

    expect(useStore.getState().calendar.events[0]).toMatchObject({
      title: '손녀 졸업식',
      eventType: '졸업',
      relatedPeople: ['민지'],
    });
    expect(screen.getByText('등록된 일정')).toBeInTheDocument();
    expect(screen.getByText('손녀 졸업식')).toBeInTheDocument();
  });

  it('generates an autobiography preview and loads PDF download only on action', async () => {
    useStore.setState({ memories: [makeMemory()] });
    renderWithRouter(<AutobiographyPage />);

    expect(screen.getByText('실물 책 제작 흐름')).toBeInTheDocument();
    expect(screen.getByText('PDF 교정본 확인')).toBeInTheDocument();
    expect(screen.getByText('실물 책 주문 준비')).toBeInTheDocument();
    expect(screen.getByText('책 사양 예시')).toBeInTheDocument();
    expect(screen.getByText('무선 제본 기준')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('자서전 문체'), {
      target: { value: 'news' },
    });
    fireEvent.click(screen.getByRole('button', { name: '자서전 생성' }));

    expect(await screen.findByRole('heading', { name: '나의 이야기' })).toBeInTheDocument();
    expect(screen.getByLabelText('출판 전 점검')).toBeInTheDocument();
    expect(screen.getByText('문장별 원문 확인')).toBeInTheDocument();
    expect(screen.getByText('A5 교정본 준비')).toBeInTheDocument();
    expect(screen.getAllByText('가족과 함께한 시간 - 가족 뉴스').length).toBeGreaterThan(0);
    expect(flowMocks.generateChapters).toHaveBeenCalledWith(expect.any(Array), null, 'news');

    fireEvent.click(screen.getByLabelText('출처 기억 memory-1 원문 확인'));
    expect(screen.getByText('자서전 문장 출처')).toBeInTheDocument();
    expect(screen.getByText('STT 원문')).toBeInTheDocument();
    expect(screen.getByText('처음 서울에 왔을 때 참 낯설었지.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'PDF 다운로드' }));

    await waitFor(() => {
      expect(flowMocks.download).toHaveBeenCalledTimes(1);
    });
    const [downloadedAutobiography] = flowMocks.download.mock.calls[0];
    expect(downloadedAutobiography).toMatchObject({
      title: '나의 이야기',
    });
  });

  it('guides users from empty archive, family review, persona, and autobiography states', () => {
    renderWithRouter(<ArchivePage />);
    expect(screen.getByRole('link', { name: '첫 기억 기록하기' })).toHaveAttribute('href', '/');

    renderWithRouter(<ReviewPage />);
    expect(screen.getByRole('link', { name: '기억 기록하러 가기' })).toHaveAttribute('href', '/');

    renderWithRouter(<PersonaPage />);
    expect(screen.getByText('아직 근거로 삼을 기억이 없습니다')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '분신에게 질문 보내기' })).toBeDisabled();

    renderWithRouter(<AutobiographyPage />);
    expect(screen.getByText('공개 가능한 기억이 필요합니다')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '기억 기록하기' })).toHaveAttribute('href', '/');
    expect(screen.getByRole('link', { name: '공개 범위 확인하기' })).toHaveAttribute('href', '/review');
  });

  it('opens persona evidence with original transcript and reviewed text', async () => {
    useStore.setState({
      demo: { enabled: true, offlineMode: true, seededAt: '2024-01-01T00:00:00.000Z' },
      memories: [
        makeMemory({
          id: 'demo_memory_seoul',
          topic: '서울에 처음 올라온 날',
          publishVersion: '서울역에 도착했을 때 낯설었지만 어머니 손을 떠올리며 버텼습니다.',
        }),
      ],
    });
    renderWithRouter(<PersonaPage />);

    fireEvent.change(screen.getByLabelText('분신에게 물어볼 내용'), {
      target: { value: '서울에 처음 올라온 날 이야기를 들려주세요' },
    });
    fireEvent.click(screen.getByRole('button', { name: '분신에게 질문 보내기' }));

    const sourceButton = await screen.findByRole('button', { name: /서울에 처음 올라온 날 원문 근거 열기/ });
    fireEvent.click(sourceButton);

    expect(screen.getByText('챗봇 답변 근거')).toBeInTheDocument();
    expect(screen.getByText('음성 조각')).toBeInTheDocument();
    expect(screen.getAllByText('서울역에 도착했을 때 낯설었지만 어머니 손을 떠올리며 버텼습니다.').length).toBeGreaterThan(0);
  });

  it('shows recoverable failure messages for memory search linking and autobiography generation', async () => {
    useStore.setState({ memories: [makeMemory()] });
    flowMocks.addMemoryToRag.mockRejectedValueOnce(new Error('index failed'));

    const settingsRender = renderWithRouter(<SettingsPage />);
    fireEvent.click(screen.getByRole('tab', { name: /기억 검색 연결/ }));
    fireEvent.click(screen.getByRole('button', { name: /기억 검색 연결하기/ }));

    expect(await screen.findByRole('alert')).toHaveTextContent('기억 검색 연결에 실패했습니다');
    settingsRender.unmount();

    flowMocks.generateChapters.mockRejectedValueOnce(new Error('생성 실패'));
    renderWithRouter(<AutobiographyPage />);
    fireEvent.click(screen.getByRole('button', { name: '자서전 생성' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('작업을 완료하지 못했습니다');
    expect(screen.getByText('생성 실패')).toBeInTheDocument();
  });
});
