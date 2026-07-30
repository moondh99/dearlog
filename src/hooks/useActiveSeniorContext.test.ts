import { renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchFamilyMembers } from '../lib/local-server'
import { DEMO_SENIOR_ID, DEMO_SENIOR_NAME } from '../lib/demo/demo-seed-adapter'
import { useAuthStore } from '../store/authStore'
import { useChildStore } from '../store/childStore'
import { useDevModeStore } from '../store/devModeStore'
import { useActiveSeniorContext } from './useActiveSeniorContext'

vi.mock('../lib/local-server', () => ({
  fetchFamilyMembers: vi.fn(),
}))

describe('useActiveSeniorContext', () => {
  beforeEach(() => {
    vi.mocked(fetchFamilyMembers).mockReset()
    useAuthStore.setState({ role: 'child' })
    useChildStore.setState({ activeSeniorId: null })
    useDevModeStore.setState({
      demoSeededAt: null,
      isDemoMode: false,
      isOfflineDemo: false,
    })
  })

  it('uses the seeded demo record space without waiting for the server', async () => {
    useChildStore.setState({ activeSeniorId: DEMO_SENIOR_ID })
    useDevModeStore.setState({
      demoSeededAt: '2026-07-30T14:42:00.000Z',
      isDemoMode: true,
      isOfflineDemo: true,
    })

    const { result } = renderHook(() => useActiveSeniorContext())

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetchFamilyMembers).not.toHaveBeenCalled()
    expect(result.current.activeSeniorId).toBe(DEMO_SENIOR_ID)
    expect(result.current.activeSenior).toMatchObject({
      id: DEMO_SENIOR_ID,
      name: DEMO_SENIOR_NAME,
      displayName: `${DEMO_SENIOR_NAME}님의 기록 공간`,
    })
    expect(result.current.hasSeniors).toBe(true)
  })
})
