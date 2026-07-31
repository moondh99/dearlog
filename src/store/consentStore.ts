import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  updateLocalInterviewRecordConsent,
  bulkUpdateLocalInterviewRecordConsent,
  fetchLocalInterviewRecords
} from '../lib/local-server'
import { useDevModeStore } from './devModeStore'

// 목적 5종. 예전에는 publish/chatbot 2종만 다뤘고 나머지 3종은 운영에서 비어 있는
// Memory 테이블에만 있었다.
export type ConsentPurpose = 'publish' | 'chatbot' | 'familyRead' | 'posthumous' | 'sensitive'

export type ConsentItem = Record<ConsentPurpose, boolean>

export const DEFAULT_CONSENT: ConsentItem = {
  publish: true,
  chatbot: true,
  familyRead: true,
  posthumous: true,
  sensitive: true,
}

interface ConsentState {
  consents: Record<string, ConsentItem>
  fetchConsents: () => Promise<void>
  setConsent: (transcriptId: string, key: ConsentPurpose, value: boolean) => Promise<void>
  setAll: (transcriptIds: string[], publish: boolean, chatbot: boolean) => Promise<void>
  stopAllUse: (transcriptId: string) => Promise<void>
}

export const useConsentStore = create<ConsentState>()(
  persist(
    (set, get) => ({
      consents: {},

      fetchConsents: async () => {
        if (useDevModeStore.getState().isOfflineDemo) return
        try {
          const res = await fetchLocalInterviewRecords()
          const newConsents: Record<string, ConsentItem> = {}
          for (const record of res.records) {
            newConsents[record.id] = {
              publish: record.publish ?? true,
              chatbot: record.chatbot ?? true,
              familyRead: record.familyRead ?? true,
              posthumous: record.posthumous ?? true,
              sensitive: record.sensitive ?? true,
            }
          }
          set({ consents: newConsents })
        } catch (e) {
          console.error('fetchConsents error:', e)
        }
      },

      setConsent: async (id, key, value) => {
        const previous = get().consents[id] ?? DEFAULT_CONSENT
        set((state) => ({
          consents: { ...state.consents, [id]: { ...previous, [key]: value } },
        }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await updateLocalInterviewRecordConsent(id, { [key]: value })
        } catch (e) {
          console.error('setConsent API error:', e)
          // 서버가 거절하면 화면만 바뀌어 동의한 줄 아는 상태가 남는다. 되돌린다.
          set((state) => ({ consents: { ...state.consents, [id]: previous } }))
          throw e
        }
      },

      // 되돌릴 수 있는 전체 활용 중지. 5종을 한 번에 철회한다.
      stopAllUse: async (id) => {
        const previous = get().consents[id] ?? DEFAULT_CONSENT
        const stopped: ConsentItem = {
          publish: false,
          chatbot: false,
          familyRead: false,
          posthumous: false,
          sensitive: false,
        }
        set((state) => ({ consents: { ...state.consents, [id]: stopped } }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await updateLocalInterviewRecordConsent(id, stopped)
        } catch (e) {
          console.error('stopAllUse API error:', e)
          set((state) => ({ consents: { ...state.consents, [id]: previous } }))
          throw e
        }
      },

      setAll: async (ids, publish, chatbot) => {
        // Optimistic update
        set((state) => ({
          consents: ids.reduce(
            (acc, id) => ({ ...acc, [id]: { ...(state.consents[id] ?? DEFAULT_CONSENT), publish, chatbot } }),
            { ...state.consents }
          ),
        }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await bulkUpdateLocalInterviewRecordConsent(ids, publish, chatbot)
        } catch (e) {
          console.error('setAll API error:', e)
        }
      },
    }),
    { name: 'dearlog-consent' }
  )
)
