import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import ArchivePage from './pages/ArchivePage';
import PersonaPage from './pages/PersonaPage';
import ReviewPage from './pages/ReviewPage';
import SettingsPage from './pages/SettingsPage';
import { useStore } from './store';
import { makeMemory, resetStoreForTest } from './test-utils/store-fixtures';

function renderWithRouter(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe('accessibility smoke checks', () => {
  beforeEach(() => {
    resetStoreForTest();
  });

  it('exposes empty-state CTAs as keyboard-reachable links', () => {
    renderWithRouter(<ArchivePage />);

    expect(screen.getByRole('link', { name: '첫 기억 기록하기' })).toHaveAttribute('href', '/');
  });

  it('uses plain-language settings labels and labelled calendar inputs', () => {
    renderWithRouter(<SettingsPage />);

    expect(screen.getByRole('tab', { name: /기억 검색 연결/ })).toBeInTheDocument();
    expect(screen.queryByText('검색 인덱스')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /가족 일정/ }));

    expect(screen.getByRole('heading', { name: '가족 일정 알림' })).toBeInTheDocument();
    expect(screen.getByLabelText('일정 제목')).toBeInTheDocument();
    expect(screen.getByLabelText('일정 유형')).toBeInTheDocument();
    expect(screen.getByLabelText('일정 날짜')).toBeInTheDocument();
    expect(screen.getByLabelText('관련 인물')).toBeInTheDocument();
    expect(screen.getByLabelText('일정 설명')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '다가오는 일정 확인' })).toBeInTheDocument();
  });

  it('labels family review inputs and privacy actions', () => {
    useStore.setState({ memories: [makeMemory()] });
    renderWithRouter(<ReviewPage />);

    expect(screen.getByLabelText('가족 질문 내용')).toBeInTheDocument();
    expect(screen.getByLabelText('질문 우선순위')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /서울에 처음 올라온 날 공개 범위 나만 보기로 변경/ })
    ).toBeInTheDocument();
  });

  it('prevents persona questions without source memories and labels the input', () => {
    renderWithRouter(<PersonaPage />);

    expect(screen.getByLabelText('분신에게 물어볼 내용')).toBeDisabled();
    expect(screen.getByRole('button', { name: '분신에게 질문 보내기' })).toBeDisabled();
    expect(screen.getByRole('link', { name: '기억 기록하러 가기' })).toHaveAttribute('href', '/');
  });
});
