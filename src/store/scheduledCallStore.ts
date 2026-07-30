import { create } from 'zustand'
import { persist } from 'zustand/middleware'

function nextMinuteTime(): string {
  const d = new Date(Date.now() + 60 * 1000)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

interface ScheduledCallState {
  scheduledTime: string
  scheduledDays: number[]
  isEnabled: boolean
  lastCallDate: string | null
  setScheduledTime: (time: string) => void
  setScheduledDays: (days: number[]) => void
  setEnabled: (enabled: boolean) => void
  markCallMade: () => void
  resetForDemo: () => void
}

export const useScheduledCallStore = create<ScheduledCallState>()(
  persist(
    (set) => ({
      scheduledTime: nextMinuteTime(),
      scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      // 기본값은 꺼짐입니다. 예전에는 켜짐 + "1분 뒤"가 기본이라, 앱을 처음 연 사람이
      // 약 1분 뒤 인터뷰 화면으로 끌려가 회원가입 입력이 통째로 날아갔습니다.
      isEnabled: false,
      lastCallDate: null,
      setScheduledTime: (scheduledTime) => set({ scheduledTime }),
      setScheduledDays: (scheduledDays) => set({ scheduledDays }),
      setEnabled: (isEnabled) => set({ isEnabled }),
      markCallMade: () =>
        set({ lastCallDate: new Date().toISOString().split('T')[0] }),
      resetForDemo: () =>
        set({ scheduledTime: nextMinuteTime(), lastCallDate: null, isEnabled: true }),
    }),
    { name: 'dearlog-scheduled-call' }
  )
)
