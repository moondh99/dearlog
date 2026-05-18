import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import InterviewPage from './InterviewPage';
import { resetStoreForTest } from '../test-utils/store-fixtures';

const interviewMocks = vi.hoisted(() => ({
  handleInterviewMessage: vi.fn(async () => ({
    text: '어르신, 오늘은 저장된 기억을 이어서 여쭤볼게요.',
    emotionState: {
      current: 'neutral',
      trajectory: [],
      confidence: 0,
    },
  })),
  injectFamilyQuestion: vi.fn(async () => '가족이 남긴 질문입니다.'),
  processEndOfSession: vi.fn(),
  processPhotoUpload: vi.fn(),
  getNextQuestion: vi.fn(),
  isInjectionAppropriate: vi.fn(() => false),
  markAnswered: vi.fn(),
  notifyQuestioner: vi.fn(),
  linkMemoryToPhoto: vi.fn(),
}));

vi.mock('../lib/agents/router', () => ({
  handleInterviewMessage: interviewMocks.handleInterviewMessage,
  injectFamilyQuestion: interviewMocks.injectFamilyQuestion,
  processEndOfSession: interviewMocks.processEndOfSession,
  processPhotoUpload: interviewMocks.processPhotoUpload,
}));

vi.mock('../lib/agents/family-question-queue', () => ({
  getNextQuestion: interviewMocks.getNextQuestion,
  isInjectionAppropriate: interviewMocks.isInjectionAppropriate,
  markAnswered: interviewMocks.markAnswered,
  notifyQuestioner: interviewMocks.notifyQuestioner,
}));

vi.mock('../lib/agents/photo-recall', () => ({
  linkMemoryToPhoto: interviewMocks.linkMemoryToPhoto,
}));

describe('InterviewPage layout', () => {
  beforeEach(() => {
    resetStoreForTest();
    vi.clearAllMocks();
    Object.defineProperty(URL, 'createObjectURL', {
      writable: true,
      value: vi.fn(() => 'blob:preview-photo'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      writable: true,
      value: vi.fn(),
    });
  });

  it('keeps the chat area shrinkable so the input controls remain visible', async () => {
    render(<InterviewPage />);

    expect(await screen.findByText('어르신, 오늘은 저장된 기억을 이어서 여쭤볼게요.')).toBeInTheDocument();
    expect(screen.getByTestId('interview-shell')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.getByTestId('interview-messages')).toHaveClass('min-h-0', 'overflow-y-auto');
    expect(screen.getByTestId('interview-input-panel')).toHaveClass('shrink-0');
    expect(screen.getByRole('button', { name: '녹음 시작' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '말씀 보내기' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '오늘의 이야기 마치기' })).toBeInTheDocument();
  });

  it('shows the selected photo immediately and enriches it with analysis results', async () => {
    interviewMocks.processPhotoUpload.mockResolvedValueOnce({
      analysis: {
        photoId: 'photo-1',
        people: ['아이'],
        places: ['욕실'],
        objects: ['욕조'],
        estimatedEra: '1990년대',
        description: '아이가 욕실에서 목욕을 거부하는 장면입니다.',
      },
      interviewQuestions: ['이때 주변에 누가 계셨나요?'],
      linkedMemoryId: null,
    });

    render(<InterviewPage />);

    await screen.findByText('어르신, 오늘은 저장된 기억을 이어서 여쭤볼게요.');

    const fileInput = screen.getByLabelText('사진으로 회상');
    const file = new File(['preview'], 'bath-time.png', { type: 'image/png' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    expect(screen.getByRole('img', { name: 'bath-time.png 미리보기' })).toHaveAttribute('src', 'blob:preview-photo');
    expect(screen.getByText('사진 속 장면을 살펴보고 있어요...')).toBeInTheDocument();

    expect(await screen.findByText('아이가 욕실에서 목욕을 거부하는 장면입니다.')).toBeInTheDocument();
    expect(screen.getByText('1990년대')).toBeInTheDocument();
    expect(screen.getByText('인물: 아이')).toBeInTheDocument();
    expect(screen.getByText('장소: 욕실')).toBeInTheDocument();
    expect(screen.getByText('사물: 욕조')).toBeInTheDocument();
    expect(screen.getByText(/이때 주변에 누가 계셨나요/)).toBeInTheDocument();
  });
});
