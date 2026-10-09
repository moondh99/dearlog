import { SAMPLE_INQUIRY_ONLY, SERVICE_RESTRICTION_MESSAGE } from '../../shared/service-access'

// Client-side prevention complements the server policy; it is not an authorization boundary.
export function assertServiceRequestAllowed(path: string, options: RequestInit = {}) {
  if (!SAMPLE_INQUIRY_ONLY) return
  const method = (options.method ?? 'GET').toUpperCase()
  const pathname = path.split('?')[0]
  if ((method === 'GET' || method === 'HEAD')
    && pathname !== '/api/publication-preview'
    && pathname !== '/api/ai/audit-summary') return
  if (pathname === '/api/auth/phone' && method === 'POST' && typeof options.body === 'string') {
    try {
      if (JSON.parse(options.body)?.isLogin === true) return
    } catch { /* Invalid payloads are not a login exception. */ }
  }
  throw new Error(SERVICE_RESTRICTION_MESSAGE)
}
