import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CalendarEvent } from '../types/agents'
import {
  fetchLocalCalendarEvents,
  saveLocalCalendarEvent,
  deleteLocalCalendarEvent
} from '../lib/local-server'
import { useDevModeStore } from './devModeStore'

interface CalendarState {
  events: CalendarEvent[]
  fetchEvents: () => Promise<void>
  addEvent: (event: CalendarEvent) => Promise<void>
  removeEvent: (eventId: string) => Promise<void>
  getUpcomingEvents: (daysAhead: number) => CalendarEvent[]
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set, get) => ({
      events: [] as CalendarEvent[],

      fetchEvents: async () => {
        if (useDevModeStore.getState().isOfflineDemo) return
        try {
          const res = await fetchLocalCalendarEvents()
          set({ events: res.events })
        } catch (e) {
          console.error('fetchEvents error:', e)
        }
      },

      addEvent: async (event: CalendarEvent) => {
        // Optimistic update
        set((state) => ({ events: [...state.events.filter(e => e.eventId !== event.eventId), event] }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await saveLocalCalendarEvent({
            eventType: event.eventType,
            eventDate: event.eventDate,
            relatedPersons: event.relatedPersons,
            recipientId: event.recipientId
          })
          await get().fetchEvents() // Re-fetch to get database ID
        } catch (e) {
          console.error('addEvent API error:', e)
        }
      },

      removeEvent: async (eventId: string) => {
        // Optimistic update
        set((state) => ({ events: state.events.filter((e) => e.eventId !== eventId) }))

        if (useDevModeStore.getState().isOfflineDemo) return

        try {
          await deleteLocalCalendarEvent(eventId)
        } catch (e) {
          console.error('removeEvent API error:', e)
        }
      },

      getUpcomingEvents: (daysAhead: number): CalendarEvent[] => {
        const target = new Date()
        target.setDate(target.getDate() + daysAhead)
        const targetStr = target.toISOString().split('T')[0]
        return get().events.filter((e) => e.eventDate === targetStr)
      },
    }),
    { name: 'dearlog-calendar' }
  )
)
