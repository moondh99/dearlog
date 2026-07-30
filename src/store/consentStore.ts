import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  updateLocalInterviewRecordConsent,
  bulkUpdateLocalInterviewRecordConsent,
  fetchLocalInterviewRecords
} from '../lib/local-server'
import { useDevModeStore } from './devModeStore'

interface ConsentItem {
  publish: boolean
  chatbot: boolean
}

interface ConsentState {
  consents: Record<string, ConsentItem>
  fetchConsents: () => Promise<void>
  setConsent: (transcriptId: string, key: 'publish' | 'chatbot', value: boolean) => Promise<void>
  setAll: (transcriptIds: string[], publish: boolean, chatbot: boolean) => Promise<void>
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
              chatbot: record.chatbot ?? true
            }
          }
          set({ consents: newConsents })
        } catch (e) {
          console.error('fetchConsents error:', e)
        }
      },

      setConsent: async (id, key, value) => {
        // Optimistic update
        set((state) => {
          const currentItem = state.consents[id] ?? { publish: true, chatbot: true }
          const newItem = { ...currentItem, [key]: value }
          return {
            consents: {
              ...state.consents,
              [id]: newItem
            }
          }
        })

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          const current = get().consents[id]
          await updateLocalInterviewRecordConsent(id, current.publish, current.chatbot)
        } catch (e) {
          console.error('setConsent API error:', e)
        }
      },

      setAll: async (ids, publish, chatbot) => {
        // Optimistic update
        set((state) => ({
          consents: ids.reduce(
            (acc, id) => ({ ...acc, [id]: { publish, chatbot } }),
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
