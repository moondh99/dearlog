import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DevModeState {
  /** AI 에이전트가 네트워크 호출 없이 사전 응답을 쓰는 모드 (src/lib/agents/config.ts 에서 사용) */
  isDemoMode: boolean
  /** 발표 데모 화면의 "네트워크 없이 시연" 토글 상태 */
  isOfflineDemo: boolean
  /** 발표용 데모 데이터를 주입한 시각 (ISO) */
  demoSeededAt: string | null
  toggleDemoMode: () => void
  setOfflineDemo: (value: boolean) => void
  setDemoSeededAt: (value: string | null) => void
}

const INITIAL_STATE = {
  isDemoMode: false,
  isOfflineDemo: false,
  demoSeededAt: null,
}

export const useDevModeStore = create<DevModeState>()(
  persist(
    (set) => ({
      ...INITIAL_STATE,
      toggleDemoMode: () => set((state) => ({ isDemoMode: !state.isDemoMode })),
      // 오프라인 시연은 AI 에이전트 사전 응답과 같은 스위치로 동작해야 하므로 함께 켜고 끈다.
      setOfflineDemo: (value) => set({ isOfflineDemo: value, isDemoMode: value }),
      setDemoSeededAt: (value) => set({ demoSeededAt: value }),
    }),
    {
      name: 'dearlog-dev-mode',
      version: 3,
      migrate: () => ({ ...INITIAL_STATE }),
    }
  )
)
