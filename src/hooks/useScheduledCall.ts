import { useEffect, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useScheduledCallStore } from '../store/scheduledCallStore'
import { useCalendarStore } from '../store/calendarStore'
import { useInterviewStore } from '../store/interviewStore'
import { processCalendarTrigger } from '../lib/agents/calendarTrigger'

export function useScheduledCall() {
  const navigate = useNavigate()
  const location = useLocation()
  const { scheduledTime, scheduledDays, isEnabled, lastCallDate, markCallMade } =
    useScheduledCallStore()
  const { getUpcomingEvents } = useCalendarStore()
  const { transcripts } = useInterviewStore()
  const notifiedEventIds = useRef(new Set<string>())

  useEffect(() => {
    if (!isEnabled) return

    const check = () => {
      const now = new Date()
      const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
      const today = now.toISOString().split('T')[0]

      // Scheduled interview call check
      if (
        !location.pathname.startsWith('/parent/interview') &&
        currentTime === scheduledTime &&
        scheduledDays.includes(now.getDay()) &&
        lastCallDate !== today
      ) {
        markCallMade()
        navigate('/parent/interview?type=scheduled')
      }

      // D-1 calendar event check
      const tomorrowEvents = getUpcomingEvents(1)
      const memoryChunks = transcripts
        .filter((t) => t.chunk)
        .map((t) => ({ ...t.chunk!, chunkId: t.id }))

      for (const event of tomorrowEvents) {
        if (notifiedEventIds.current.has(event.eventId)) continue
        notifiedEventIds.current.add(event.eventId)

        processCalendarTrigger(event, memoryChunks).then((result) => {
          if (result.triggerType === 'INTERVIEW') {
            const topics = result.suggestedInterviewTopics.slice(0, 2).join('\n• ')
            window.alert(
              `내일 ${event.eventType} 관련 인터뷰 주제가 있어요:\n• ${topics}`
            )
          } else if (result.triggerType === 'DELIVERY' && result.editedStory) {
            window.alert(
              `내일 ${event.eventType}이에요.\n부모님의 이야기가 준비되었어요:\n\n${result.editedStory.text.slice(0, 100)}...`
            )
          }
        }).catch(() => {})
      }
    }

    check()
    const id = setInterval(check, 60 * 1000)
    return () => clearInterval(id)
  }, [isEnabled, scheduledTime, scheduledDays, lastCallDate, location.pathname, transcripts])
}
