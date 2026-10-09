import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { assertServiceRequestAllowed } from './service-access'
import { SERVICE_RESTRICTION_MESSAGE } from '../../shared/service-access'
import { createLocalQuestion, fetchLocalPhotos, fetchLocalPublicationPreview, fetchLocalAIProxyAuditSummary, loginWithInvitationToken, registerLocalPhoneAccount, synthesizeLocalQuestionSpeech, registerLocalPushSubscription } from './local-server'

describe('client restriction before network or device actions', () => {
  const network = vi.fn()
  beforeEach(() => {
    window.sessionStorage.clear()
    window.localStorage.clear()
    network.mockReset().mockResolvedValue(new Response(JSON.stringify({ photos: [] }), { status: 200 }))
    vi.stubGlobal('fetch', network)
  })
  afterEach(() => vi.unstubAllGlobals())

  it.each(['POST', 'PUT', 'PATCH', 'DELETE'])('blocks %s requests', method => {
    expect(() => assertServiceRequestAllowed('/api/interview-records', { method })).toThrow(SERVICE_RESTRICTION_MESSAGE)
  })
  it.each([undefined, false, 'true', 1])('rejects a non-true login flag %s', isLogin => {
    expect(() => assertServiceRequestAllowed('/api/auth/phone', { method: 'POST', body: JSON.stringify({ isLogin }) })).toThrow(SERVICE_RESTRICTION_MESSAGE)
  })
  it('only permits the strict existing-login exception', async () => {
    network.mockResolvedValueOnce(new Response(JSON.stringify({ user: {}, authToken: 'fixture' }), { status: 200 }))
    await registerLocalPhoneAccount('01022223333', '가상 기존 사용자', true)
    expect(network).toHaveBeenCalledTimes(1)
    expect(JSON.parse(network.mock.calls[0][1].body).isLogin).toBe(true)
  })
  it('blocks signup and invitation login without a request', async () => {
    await expect(registerLocalPhoneAccount('01022223333', '가상 신규 사용자', false)).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    await expect(loginWithInvitationToken('fictional-token')).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    expect(network).not.toHaveBeenCalled()
  })
  it('blocks question writes, audio generation, and side-effecting GET endpoints', async () => {
    await expect(createLocalQuestion('가상 질문')).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    await expect(synthesizeLocalQuestionSpeech('가상 질문')).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    await expect(fetchLocalPublicationPreview()).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    await expect(fetchLocalAIProxyAuditSummary()).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    expect(network).not.toHaveBeenCalled()
  })
  it('blocks push registration before service worker or notification actions', async () => {
    await expect(registerLocalPushSubscription('fixture')).rejects.toThrow(SERVICE_RESTRICTION_MESSAGE)
    expect(network).not.toHaveBeenCalled()
  })
  it('uses the explicit authorized record space and a Bearer token without dev identity headers', async () => {
    window.sessionStorage.setItem('dearlog-auth', JSON.stringify({ state: { userId: 'guardian-1', role: 'child', authToken: 'fixture-token' } }))
    window.localStorage.setItem('dearlog-child', JSON.stringify({ state: { activeSeniorId: 'stale-unrelated-id' } }))
    await fetchLocalPhotos('allowed-senior')
    expect(network.mock.calls[0][0]).toContain('/api/photos?seniorId=allowed-senior')
    const headers = new Headers(network.mock.calls[0][1].headers)
    expect(headers.get('Authorization')).toBe('Bearer fixture-token')
    expect(headers.has('x-user-id')).toBe(false)
    expect(headers.has('x-user-role')).toBe(false)
  })
  it('does not append an old cached senior ID to an implicit own-account read', async () => {
    window.sessionStorage.setItem('dearlog-auth', JSON.stringify({ state: { userId: 'guardian-1', role: 'child', authToken: 'fixture-token' } }))
    window.localStorage.setItem('dearlog-child', JSON.stringify({ state: { activeSeniorId: 'unrelated-senior' } }))
    await fetchLocalPhotos()
    expect(network.mock.calls[0][0]).not.toContain('seniorId=')
  })
})
