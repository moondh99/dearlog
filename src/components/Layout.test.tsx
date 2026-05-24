import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Layout from './Layout';
import { routePreloads } from '../routes/pageLoaders';
import { makeMemory, resetStoreForTest } from '../test-utils/store-fixtures';
import { createAuthenticatedAuthState, useStore } from '../store';

describe('Layout', () => {
  const originalArchivePreload = routePreloads['/archive'];

  afterEach(() => {
    routePreloads['/archive'] = originalArchivePreload;
    resetStoreForTest();
  });

  it('prefetches route chunks when navigation is focused or hovered', () => {
    const preload = vi.fn(async () => undefined);
    routePreloads['/archive'] = preload;
    useStore.setState({ auth: createAuthenticatedAuthState({ role: 'guardian' }) });

    render(
      <MemoryRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<p>홈</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    const archiveLink = screen.getAllByRole('link', { name: /추억 보관함/ })[0];
    act(() => {
      fireEvent.focus(archiveLink);
      fireEvent.mouseEnter(archiveLink);
    });

    expect(preload).toHaveBeenCalledTimes(2);
  });

  it('surfaces the user journey and next action from service state', () => {
    act(() => {
      useStore.setState({
        auth: createAuthenticatedAuthState({ role: 'guardian' }),
        memories: [makeMemory({ privacy: 'private' })],
      });
    });

    render(
      <MemoryRouter initialEntries={['/archive']}>
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route path="archive" element={<p>보관함</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByRole('navigation', { name: '사용자 여정 단계' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /2\. 기억 정리/ })).toHaveAttribute('aria-current', 'step');
    expect(screen.getByRole('link', { name: /다음 단계 공개 범위 확인/ })).toHaveAttribute('href', '/review');
  });
});
