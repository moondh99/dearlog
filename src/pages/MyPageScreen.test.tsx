import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import MyPageScreen from './MyPageScreen'
import { useAuthStore } from '../store/authStore'
import { useConsentStore } from '../store/consentStore'
import { useInterviewStore } from '../store/interviewStore'

// 알림의 "받는 쪽"을 확인한다.
// 예전에는 푸시 알림 토글이 useState(true) 로 고정돼 있어서, 구독이 하나도 없어도 켜졌다고
// 보여 줬다. 서버는 sendWebPush 로 알림을 계속 만들고 있었지만 그걸 읽는 화면도 없었다.
//
// local-server 모듈을 통째로 대신 세우는 대신 fetch 와 serviceWorker 만 세워 둔다.
// 화면이 부르는 등록/해지 경로가 실제로 그대로 돌아야 이 테스트가 의미가 있다.

const ENDPOINT = 'https://push.example.test/subscriptions/abc'

let currentSubscription: any = null
let subscribeCalls = 0
let unsubscribeCalls = 0
let notifications: any[] = []
let requests: Array<{ method: string; path: string; body: any }> = []

function makeSubscription() {
  return {
    endpoint: ENDPOINT,
    toJSON: () => ({ endpoint: ENDPOINT, keys: { p256dh: 'p256dh', auth: 'auth' } }),
    unsubscribe: async () => {
      unsubscribeCalls += 1
      currentSubscription = null
      return true
    },
  }
}

const registration = {
  pushManager: {
    getSubscription: async () => currentSubscription,
    subscribe: async () => {
      subscribeCalls += 1
      currentSubscription = makeSubscription()
      return currentSubscription
    },
  },
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'OK',
    json: async () => body,
  } as unknown as Response
}

// 화면이 쓰는 경로만 답하고 나머지는 빈 응답으로 넘긴다. 스토어들도 같은 fetch 를 타기 때문이다.
function fakeFetch(input: any, init: any = {}) {
  const url = String(input)
  const path = url.replace(/^https?:\/\/[^/]+/, '')
  const method = (init.method ?? 'GET').toUpperCase()
  let body: any
  try {
    body = typeof init.body === 'string' ? JSON.parse(init.body) : undefined
  } catch {
    body = undefined
  }
  requests.push({ method, path, body })

  if (path.startsWith('/api/push-public-key')) {
    return Promise.resolve(jsonResponse({ publicKey: 'vapid-public-key' }))
  }
  if (path.startsWith('/api/push-subscriptions')) {
    return Promise.resolve(method === 'DELETE' ? jsonResponse({ deleted: 1 }) : jsonResponse({ subscription: {} }, 201))
  }
  if (/^\/api\/notifications\/[^/]+\/read/.test(path)) {
    const id = path.split('/')[3]
    notifications = notifications.map((item) => (item.id === id ? { ...item, status: 'read' } : item))
    return Promise.resolve(jsonResponse({ notification: notifications.find((item) => item.id === id) }))
  }
  if (path.startsWith('/api/notifications')) {
    return Promise.resolve(
      jsonResponse({
        notifications,
        unreadCount: notifications.filter((item) => item.status === 'unread').length,
      }),
    )
  }
  return Promise.resolve(jsonResponse({}))
}

const NOTIFICATION = {
  id: 'notification-nudge',
  type: 'nudge',
  title: 'Dearlog에서 기다리고 있어요',
  body: '가족이 오늘의 이야기를 조금 더 듣고 싶어 합니다.',
  status: 'unread',
  createdAt: '2026-07-01T00:00:00.000Z',
  readAt: null,
  metadata: {},
}

// 딥링크를 따라갔는지 보려면 실제 위치가 필요하다. MemoryRouter 만으로는 화면이 그대로 남는다.
function LocationProbe() {
  const location = useLocation()
  return <span data-testid="location">{`${location.pathname}${location.search}`}</span>
}

function renderScreen() {
  return render(
    <MemoryRouter initialEntries={['/child/mypage']}>
      <MyPageScreen />
      <LocationProbe />
    </MemoryRouter>,
  )
}

function pushToggle() {
  return screen.getByRole('button', { name: '푸시 알림' })
}

describe('MyPageScreen 알림', () => {
  beforeEach(() => {
    window.localStorage.clear()
    window.sessionStorage.clear()
    useAuthStore.setState({
      role: 'child',
      userName: '김민수',
      userId: 'guardian-1',
      phoneNumber: '01011112222',
      authToken: 'token',
    })
    useInterviewStore.setState({ chapters: [], transcripts: [] })
    useConsentStore.setState({ consents: {} })

    currentSubscription = null
    subscribeCalls = 0
    unsubscribeCalls = 0
    notifications = []
    requests = []

    vi.stubGlobal('fetch', vi.fn(fakeFetch))
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        register: async () => registration,
        getRegistration: async () => registration,
        ready: Promise.resolve(registration),
      },
    })
    vi.stubGlobal('PushManager', function PushManager() {})
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    // jsdom 에는 원래 serviceWorker 가 없으므로 테스트마다 지워 둔다.
    Reflect.deleteProperty(navigator, 'serviceWorker')
  })

  it('구독이 없으면 푸시 알림이 꺼져 있다', async () => {
    renderScreen()

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'false'))
    expect(subscribeCalls).toBe(0)
  })

  it('이미 구독 중이면 켜져 있다', async () => {
    currentSubscription = makeSubscription()
    renderScreen()

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'true'))
  })

  it('토글을 켜면 VAPID 키를 받아 구독하고 서버에 등록한다', async () => {
    renderScreen()

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'false'))
    fireEvent.click(pushToggle())

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'true'))
    expect(subscribeCalls).toBe(1)
    const posted = requests.find((r) => r.method === 'POST' && r.path.startsWith('/api/push-subscriptions'))
    expect(posted?.body?.endpoint).toBe(ENDPOINT)
  })

  it('토글을 끄면 브라우저 구독을 끊고 서버 행도 지운다', async () => {
    currentSubscription = makeSubscription()
    renderScreen()

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'true'))
    fireEvent.click(pushToggle())

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'false'))
    expect(unsubscribeCalls).toBe(1)
    const deleted = requests.find((r) => r.method === 'DELETE' && r.path.startsWith('/api/push-subscriptions'))
    expect(deleted?.body?.endpoint).toBe(ENDPOINT)
  })

  it('VAPID 키가 없으면 이유를 보여주고 켜지지 않는다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: any, init: any) => {
        if (String(input).includes('/api/push-public-key')) return Promise.resolve(jsonResponse({ publicKey: '' }))
        return fakeFetch(input, init)
      }),
    )
    renderScreen()

    await waitFor(() => expect(pushToggle()).toHaveAttribute('aria-pressed', 'false'))
    fireEvent.click(pushToggle())

    expect(await screen.findByText('VAPID_PUBLIC_KEY가 아직 설정되지 않았습니다.')).toBeInTheDocument()
    expect(pushToggle()).toHaveAttribute('aria-pressed', 'false')
    expect(subscribeCalls).toBe(0)
  })

  it('서버가 만든 알림을 보여주고 누르면 읽음으로 표시한다', async () => {
    notifications = [{ ...NOTIFICATION }]
    renderScreen()

    expect(await screen.findByText('Dearlog에서 기다리고 있어요')).toBeInTheDocument()
    expect(screen.getByLabelText('읽지 않음')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Dearlog에서 기다리고 있어요'))

    await waitFor(() => expect(screen.queryByLabelText('읽지 않음')).not.toBeInTheDocument())
    expect(
      requests.some((r) => r.method === 'PATCH' && r.path.includes('/api/notifications/notification-nudge/read')),
    ).toBe(true)
  })

  it('화면이 없는 딥링크는 따라가지 않는다', async () => {
    notifications = [
      { ...NOTIFICATION, id: 'notification-call', metadata: { url: '/?callSessionId=session-1' } },
    ]
    renderScreen()

    fireEvent.click(await screen.findByText('Dearlog에서 기다리고 있어요'))

    // 읽음 처리는 되지만 위치는 마이페이지 그대로다.
    await waitFor(() => expect(screen.queryByLabelText('읽지 않음')).not.toBeInTheDocument())
    expect(screen.getByTestId('location')).toHaveTextContent('/child/mypage')
  })

  it('화면이 있는 딥링크는 따라간다', async () => {
    notifications = [{ ...NOTIFICATION, id: 'notification-alert', metadata: { url: '/child/mypage?tab=ai' } }]
    renderScreen()

    fireEvent.click(await screen.findByText('Dearlog에서 기다리고 있어요'))

    await waitFor(() => expect(screen.getByTestId('location')).toHaveTextContent('/child/mypage?tab=ai'))
  })

  it('알림이 없으면 비어 있다고 알려준다', async () => {
    renderScreen()

    expect(await screen.findByText('아직 받은 알림이 없습니다.')).toBeInTheDocument()
  })
})
