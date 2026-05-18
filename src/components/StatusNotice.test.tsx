import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import StatusNotice from './StatusNotice';

describe('StatusNotice', () => {
  it('renders status messages with polite live region for success', () => {
    render(<StatusNotice tone="success" title="저장 완료" message="기억 카드가 저장되었습니다." />);

    expect(screen.getByRole('status')).toHaveTextContent('저장 완료');
    expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
  });

  it('renders errors as alerts', () => {
    render(<StatusNotice tone="error" title="저장 실패" />);

    expect(screen.getByRole('alert')).toHaveTextContent('저장 실패');
    expect(screen.getByRole('alert')).toHaveAttribute('aria-live', 'assertive');
  });

  it('supports dismiss action', async () => {
    const onDismiss = vi.fn();
    render(<StatusNotice tone="info" title="안내" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button', { name: '상태 메시지 닫기' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
