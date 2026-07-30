import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import DemoSettingsScreen from './DemoSettingsScreen'
import { useAuthStore } from '../store/authStore'
import { useAutobiographyStore } from '../store/autobiographyStore'
import { useCalendarStore } from '../store/calendarStore'
import { useChildStore } from '../store/childStore'
import { useConsentStore } from '../store/consentStore'
import { useDevModeStore } from '../store/devModeStore'
import { useInterviewStore } from '../store/interviewStore'

function RouteProbe() {
  const location = useLocation()
  return <p>route:{location.pathname}</p>
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/settings']}>
      <Routes>
        <Route path="/settings" element={<DemoSettingsScreen />} />
        <Route path="*" element={<RouteProbe />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DemoSettingsScreen', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({ role: 'child', userId: 'guardian_1', userName: '김민수', phoneNumber: '01012345678', authToken: null })
    useChildStore.setState({ photos: [], questions: [], activeSeniorId: null })
    useInterviewStore.setState({ chapters: [], transcripts: [] })
    useAutobiographyStore.setState({ chapters: [] })
    useCalendarStore.setState({ events: [] })
    useConsentStore.setState({ consents: {} })
    useDevModeStore.setState({ isDemoMode: false, isOfflineDemo: false, demoSeededAt: null })
  })

  it('renders the demo controls and new-generation demo route paths', () => {
    renderScreen()

    expect(screen.getByRole('heading', { name: '발표 데모' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '발표용 데이터 불러오기' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /데모 데이터 초기화/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '네트워크 없이 시연' })).toBeInTheDocument()

    for (const path of ['/parent/interview', '/child/photos', '/child/questions', '/child/chatbot', '/child/autobiography']) {
      expect(screen.getByRole('button', { name: new RegExp(`${path}로 이동`) })).toBeInTheDocument()
    }
    expect(screen.queryByText('/interview')).not.toBeInTheDocument()
    expect(screen.queryByText('/archive')).not.toBeInTheDocument()
    expect(screen.queryByText('/persona')).not.toBeInTheDocument()
  })

  it('toggles offline demo mode so agents use pre-recorded answers', () => {
    renderScreen()

    const toggle = screen.getByRole('button', { name: '네트워크 없이 시연' })
    expect(toggle).toHaveAttribute('aria-pressed', 'false')

    fireEvent.click(toggle)

    expect(useDevModeStore.getState().isOfflineDemo).toBe(true)
    expect(useDevModeStore.getState().isDemoMode).toBe(true)
    expect(screen.getByRole('button', { name: '네트워크 없이 시연' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.click(screen.getByRole('button', { name: '네트워크 없이 시연' }))

    expect(useDevModeStore.getState().isOfflineDemo).toBe(false)
    expect(useDevModeStore.getState().isDemoMode).toBe(false)
  })

  it('seeds the new-generation stores and clears them again', () => {
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: '발표용 데이터 불러오기' }))

    expect(useInterviewStore.getState().transcripts.length).toBeGreaterThan(0)
    expect(useInterviewStore.getState().chapters.length).toBeGreaterThan(0)
    expect(useChildStore.getState().photos.length).toBeGreaterThan(0)
    expect(useChildStore.getState().questions.length).toBeGreaterThan(0)
    expect(useAutobiographyStore.getState().chapters.length).toBeGreaterThan(0)
    expect(useCalendarStore.getState().events.length).toBeGreaterThan(0)
    expect(Object.keys(useConsentStore.getState().consents).length).toBeGreaterThan(0)
    expect(useDevModeStore.getState().demoSeededAt).not.toBeNull()
    expect(screen.getByText('발표용 데이터를 불러왔습니다.')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /데모 데이터 초기화/ }))

    expect(useInterviewStore.getState().transcripts).toHaveLength(0)
    expect(useChildStore.getState().photos).toHaveLength(0)
    expect(useAutobiographyStore.getState().chapters).toHaveLength(0)
    expect(useDevModeStore.getState().demoSeededAt).toBeNull()
  })

  it('switches the demo role before navigating to a parent-only step', () => {
    renderScreen()

    fireEvent.click(screen.getByRole('button', { name: /\/parent\/interview로 이동/ }))

    expect(useAuthStore.getState().role).toBe('parent')
    expect(screen.getByText('route:/parent/interview')).toBeInTheDocument()
  })
})
