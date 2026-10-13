// Reopening intake requires a reviewed code change; production does not depend on an env toggle.
export const SAMPLE_INQUIRY_ONLY = true
export const SERVICE_RESTRICTION_CODE = 'SAMPLE_INQUIRY_ONLY'
export const SERVICE_RESTRICTION_MESSAGE = '현재 예시 체험과 문의만 받고 있습니다. 신규 가입·초대·기록 입력은 잠시 중단되어 있습니다.'

// Only decision logic is shared. Express and the browser parse their own request bodies.
export function isServiceRequestAllowed(method: string, path: string, body?: { isLogin?: unknown; purpose?: unknown }) {
  const pathname = path.split('?')[0].replace(/\/+$/, '').toLowerCase()
  const requestMethod = method.toUpperCase()
  const readMethod = requestMethod === 'GET' || requestMethod === 'HEAD'
  const hasReadSideEffect = pathname === '/api/publication-preview' || pathname === '/api/ai/audit-summary'
  const isLoginPost = requestMethod === 'POST' && body?.isLogin === true && pathname === '/api/auth/phone'
  // Existing-account login needs a phone code first; a code for signup stays blocked.
  const isLoginOtp = requestMethod === 'POST' && body?.purpose === 'login' && (pathname === '/api/auth/otp/request' || pathname === '/api/auth/otp/verify')
  return (readMethod && !hasReadSideEffect) || isLoginPost || isLoginOtp
}
