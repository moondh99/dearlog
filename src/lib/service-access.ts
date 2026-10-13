import { isServiceRequestAllowed, SAMPLE_INQUIRY_ONLY, SERVICE_RESTRICTION_MESSAGE } from '../../shared/service-access'

// Client-side prevention complements the server policy; it is not an authorization boundary.
export function assertServiceRequestAllowed(path: string, options: RequestInit = {}) {
  // 시연 빌드는 접수 제한이 풀린 데모 서버에만 붙는다. 운영 서버의 제한은 서버가 따로 막는다.
  if (!SAMPLE_INQUIRY_ONLY || import.meta.env.VITE_DEMO_MODE === 'true') return
  let body: { isLogin?: unknown; purpose?: unknown } | undefined
  if (typeof options.body === 'string') {
    try { body = JSON.parse(options.body) ?? undefined } catch { /* Invalid bodies are not login exceptions. */ }
  }
  if (isServiceRequestAllowed(options.method ?? 'GET', path, body)) return
  throw new Error(SERVICE_RESTRICTION_MESSAGE)
}
