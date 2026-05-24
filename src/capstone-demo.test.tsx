import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutobiographyPage from './pages/AutobiographyPage';
import ArchivePage from './pages/ArchivePage';
import SettingsPage from './pages/SettingsPage';
import { generatePersonaResponse } from './lib/agents/persona';
import { buildDemoAutobiography, createDemoPersonaResponse } from './lib/demo/capstone-demo-data';
import { useStore } from './store';
import { resetStoreForTest } from './test-utils/store-fixtures';

const demoPdfMocks = vi.hoisted(() => ({
  downloadPrintReady: vi.fn(async () => undefined),
}));

vi.mock('./lib/pdf/generator', () => ({
  download: vi.fn(async () => undefined),
  downloadPrintReady: demoPdfMocks.downloadPrintReady,
}));

describe('capstone demo mode', () => {
  beforeEach(() => {
    resetStoreForTest();
    demoPdfMocks.downloadPrintReady.mockClear();
  });

  it('seeds and clears presentation data without duplication', () => {
    useStore.getState().seedDemoData();
    useStore.getState().seedDemoData();

    const state = useStore.getState();
    expect(state.demo).toMatchObject({ enabled: true, offlineMode: true });
    expect(state.memories.filter((memory) => memory.id.startsWith('demo_'))).toHaveLength(24);
    expect(state.photos.photos.filter((photo) => photo.id.startsWith('demo_'))).toHaveLength(17);
    expect(state.familyQuestions.questions.filter((question) => question.id.startsWith('demo_'))).toHaveLength(8);
    expect(state.autobiography.narratives.filter((chapter) => chapter.chapterId.startsWith('demo_'))).toHaveLength(24);
    expect(state.ragIndex.entries.filter((entry) => entry.memoryId.startsWith('demo_'))).toHaveLength(24);

    useStore.getState().clearDemoData();
    const cleared = useStore.getState();
    expect(cleared.demo.enabled).toBe(false);
    expect(cleared.memories.some((memory) => memory.id.startsWith('demo_'))).toBe(false);
  });

  it('answers from seeded memories in offline persona mode', async () => {
    useStore.getState().seedDemoData();
    const response = await generatePersonaResponse('처음 서울에 올라왔을 때 이야기를 들려주세요', []);

    expect(response.text).toContain('서울');
    expect(response.evidenceBadges.length).toBeGreaterThan(0);
    expect(response.linkedMemoryCards[0]).toMatch(/^demo_/);
  });

  it('does not invent answers when demo memories do not support the question', () => {
    const response = createDemoPersonaResponse('화성 여행은 어땠나요?', []);

    expect(response.text).toContain('기록된 기억이 없어서');
    expect(response.evidenceBadges).toHaveLength(0);
  });

  it('loads the prebuilt autobiography and downloads print-ready PDF', async () => {
    useStore.getState().seedDemoData();
    render(
      <MemoryRouter>
        <AutobiographyPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: /사전 자서전 불러오기/ }));

    expect(screen.getByRole('heading', { name: '김영자의 이야기' })).toBeInTheDocument();
    expect(screen.getAllByText('1장. 시장 골목에서 배운 마음').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: '인쇄용 PDF 다운로드' }));

    await waitFor(() => {
      expect(demoPdfMocks.downloadPrintReady).toHaveBeenCalledWith(
        buildDemoAutobiography(),
        expect.objectContaining({
          authorName: '김영자',
          familyReviewed: true,
        })
      );
    });
  });

  it('masks GPS coordinates in archive metadata', () => {
    useStore.getState().seedDemoData();
    render(
      <MemoryRouter>
        <ArchivePage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: /요약/ }));

    expect(screen.getAllByText('공개 전 확인 필요').length).toBeGreaterThan(0);
    expect(screen.queryByText(/35\\.17955/)).not.toBeInTheDocument();
    expect(screen.queryByText(/129\\.07564/)).not.toBeInTheDocument();
  });

  it('shows the presentation runbook and readiness checks in settings', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('tab', { name: /발표 데모/ }));
    fireEvent.click(screen.getByRole('button', { name: '발표용 데이터 불러오기' }));

    expect(screen.getByText(/발표 준비가 완료되었습니다/)).toBeInTheDocument();
    expect(screen.getByText('3~5분 시연 순서')).toBeInTheDocument();
    expect(screen.getByText('인쇄물 점검표')).toBeInTheDocument();
    expect(screen.getByText('제출 자료 구성')).toBeInTheDocument();
    expect(screen.getByText('3~5분 발표 대본')).toBeInTheDocument();
    expect(screen.getByText('심사위원 예상 질문')).toBeInTheDocument();
    expect(screen.getByText('PPT/포스터 핵심 문장')).toBeInTheDocument();
    expect(screen.getByText(/기억이 가족에게 남기 어려운 문제/)).toBeInTheDocument();
    expect(screen.getByText('실제 개인정보와 사후 데이터는 어떻게 보호하나요?')).toBeInTheDocument();
    expect(screen.getByText('처음 서울에 올라왔을 때 이야기를 들려주세요')).toBeInTheDocument();
  });
});
