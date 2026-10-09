import { isServiceRequestAllowed, SAMPLE_INQUIRY_ONLY, SERVICE_RESTRICTION_MESSAGE } from '../../shared/service-access'

// Client-side prevention complements the server policy; it is not an authorization boundary.
export function assertServiceRequestAllowed(path: string, options: RequestInit = {}) {
  if (!SAMPLE_INQUIRY_ONLY) return
  let isLogin: unknown
  if (typeof options.body === 'string') {
    try { isLogin = JSON.parse(options.body)?.isLogin } catch { /* Invalid bodies are not login exceptions. */ }
  }
  if (isServiceRequestAllowed(options.method ?? 'GET', path, isLogin)) return
  throw new Error(SERVICE_RESTRICTION_MESSAGE)
}
