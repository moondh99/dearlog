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
      isEnabled: true,
      lastCallDate: null,
      setScheduledTime: (scheduledTime) => set({ scheduledTime }),
      setScheduledDays: (scheduledDays) => set({ scheduledDays }),
      setEnabled: (isEnabled) => set({ isEnabled }),
      markCallMade: () =>
        set({ lastCallDate: new Date().toISOString().split('T')[0] }),
      resetForDemo: () =>
        set({ scheduledTime: nextMinuteTime(), lastCallDate: null }),
    }),
    { name: 'dearlog-scheduled-call' }
  )
)
