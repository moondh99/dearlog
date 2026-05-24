import { fireEvent, render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function BrokenView(): ReactElement {
  throw new Error('boom');
}

function HealthyView() {
  return <p>정상 화면</p>;
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders children when no error is thrown', () => {
    render(
      <ErrorBoundary>
        <HealthyView />
      </ErrorBoundary>
    );

    expect(screen.getByText('정상 화면')).toBeInTheDocument();
  });

  it('shows an accessible fallback and reports errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = vi.fn();

    render(
      <ErrorBoundary onError={onError}>
        <BrokenView />
      </ErrorBoundary>
    );

    expect(screen.getByRole('alert')).toHaveTextContent('화면을 불러오지 못했습니다');
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('can retry rendering after an error', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let shouldThrow = true;

    function RecoverableView() {
      if (shouldThrow) throw new Error('temporary');
      return <p>복구된 화면</p>;
    }

    render(
      <ErrorBoundary>
        <RecoverableView />
      </ErrorBoundary>
    );

    shouldThrow = false;
    fireEvent.click(screen.getByRole('button', { name: '다시 시도' }));

    expect(screen.getByText('복구된 화면')).toBeInTheDocument();
  });
});
