// 이메일 주소 다루기. 로그인 인증번호를 받는 주소라 형식이 틀리면 저장하지 않는다.

// RFC 전체를 따르지는 않는다. 흔한 오타(공백, @ 누락, 도메인 점 누락)를 막는 정도다.
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(value: unknown): string | null {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) return null;
  return email;
}

// 화면에 "어디로 보냈는지" 보여 줄 때 쓴다. 번호만 아는 사람에게 주소 전체를 알려 주지 않는다.
export function maskEmail(email: string) {
  const [local, domain] = email.split('@');
  const visible = local.slice(0, Math.min(2, Math.max(1, local.length - 1)));
  return `${visible}${'*'.repeat(Math.max(3, local.length - visible.length))}@${domain}`;
}
