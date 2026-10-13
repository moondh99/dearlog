import crypto from 'node:crypto';

// 휴대폰 인증번호와, 인증을 마친 뒤 가입·로그인에 한 번 쓰는 확인 토큰을 보관한다.
// ponytail: 로그인 시도 제한(authAttemptBuckets)과 같이 단일 인스턴스 메모리 저장이다.
// 서버를 다시 켜면 진행 중이던 인증은 사라지고 사용자는 번호를 다시 받는다.
// 인스턴스를 늘리면 공유 저장소로 옮긴다.

export type OtpPurpose = 'login' | 'signup';

export const OTP_CODE_TTL_MS = 3 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const OTP_MAX_VERIFY_ATTEMPTS = 5;
export const OTP_TICKET_TTL_MS = 10 * 60 * 1000;

type PendingCode = { codeHash: Buffer; expiresAt: number; attempts: number; sentAt: number };
type Ticket = { phoneNumber: string; purpose: OtpPurpose; expiresAt: number };

const pendingCodes = new Map<string, PendingCode>();
const tickets = new Map<string, Ticket>();

function codeKey(phoneNumber: string, purpose: OtpPurpose) {
  return `${purpose}:${phoneNumber}`;
}

function hashCode(code: string) {
  return crypto.createHash('sha256').update(code).digest();
}

function prune(now: number) {
  if (pendingCodes.size > 5000) {
    for (const [key, entry] of pendingCodes) {
      if (now >= entry.expiresAt) pendingCodes.delete(key);
    }
  }
  if (tickets.size > 5000) {
    for (const [token, ticket] of tickets) {
      if (now >= ticket.expiresAt) tickets.delete(token);
    }
  }
}

export function isOtpPurpose(value: unknown): value is OtpPurpose {
  return value === 'login' || value === 'signup';
}

export function issueOtpCode(phoneNumber: string, purpose: OtpPurpose, now = Date.now()):
  | { ok: true; code: string; expiresInSeconds: number; resendAfterSeconds: number }
  | { ok: false; retryAfterSeconds: number } {
  const key = codeKey(phoneNumber, purpose);
  const existing = pendingCodes.get(key);
  // 다시 받기를 연달아 누르면 문자 요금이 그대로 나간다. 발송 간격을 둔다.
  if (existing && now - existing.sentAt < OTP_RESEND_COOLDOWN_MS) {
    return { ok: false, retryAfterSeconds: Math.ceil((OTP_RESEND_COOLDOWN_MS - (now - existing.sentAt)) / 1000) };
  }

  // Math.random 은 출력 몇 개로 내부 상태를 되돌릴 수 있다. 인증번호는 암호학적 난수로 뽑는다.
  const code = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
  pendingCodes.set(key, { codeHash: hashCode(code), expiresAt: now + OTP_CODE_TTL_MS, attempts: 0, sentAt: now });
  prune(now);
  return {
    ok: true,
    code,
    expiresInSeconds: OTP_CODE_TTL_MS / 1000,
    resendAfterSeconds: OTP_RESEND_COOLDOWN_MS / 1000,
  };
}

// 문자 발송이 실패하면 방금 만든 번호를 지워 바로 다시 받을 수 있게 한다.
export function discardOtpCode(phoneNumber: string, purpose: OtpPurpose) {
  pendingCodes.delete(codeKey(phoneNumber, purpose));
}

export function verifyOtpCode(phoneNumber: string, purpose: OtpPurpose, code: string, now = Date.now()):
  | { ok: true; verificationToken: string; expiresInSeconds: number }
  | { ok: false; reason: 'missing' | 'expired' | 'mismatch' | 'too_many'; remainingAttempts?: number } {
  const key = codeKey(phoneNumber, purpose);
  const entry = pendingCodes.get(key);
  if (!entry) return { ok: false, reason: 'missing' };
  if (now >= entry.expiresAt) {
    pendingCodes.delete(key);
    return { ok: false, reason: 'expired' };
  }

  entry.attempts += 1;
  const candidate = String(code ?? '').trim();
  const matches = /^\d{6}$/.test(candidate) && crypto.timingSafeEqual(hashCode(candidate), entry.codeHash);
  if (!matches) {
    // 6자리는 100만 가지뿐이다. 한 번호로 맞혀 볼 수 있는 횟수를 막아 두지 않으면 대입으로 뚫린다.
    const remainingAttempts = OTP_MAX_VERIFY_ATTEMPTS - entry.attempts;
    if (remainingAttempts <= 0) {
      pendingCodes.delete(key);
      return { ok: false, reason: 'too_many' };
    }
    return { ok: false, reason: 'mismatch', remainingAttempts };
  }

  // 인증번호는 한 번만 쓴다. 맞힌 뒤에는 가입·로그인에 한 번 쓰는 토큰으로 바꿔 준다.
  pendingCodes.delete(key);
  const verificationToken = crypto.randomBytes(24).toString('base64url');
  tickets.set(verificationToken, { phoneNumber, purpose, expiresAt: now + OTP_TICKET_TTL_MS });
  prune(now);
  return { ok: true, verificationToken, expiresInSeconds: OTP_TICKET_TTL_MS / 1000 };
}

// 토큰이 이 번호·용도로 발급됐고 아직 유효한지만 본다. 쓰지는 않는다.
// 로그인에서 이름이 틀렸을 때 인증을 처음부터 다시 받게 하지 않으려고 확인과 소비를 나눴다.
export function isVerificationTokenValid(token: unknown, phoneNumber: string, purpose: OtpPurpose, now = Date.now()) {
  if (typeof token !== 'string' || !token) return false;
  const ticket = tickets.get(token);
  if (!ticket) return false;
  if (now >= ticket.expiresAt) {
    tickets.delete(token);
    return false;
  }
  return ticket.phoneNumber === phoneNumber && ticket.purpose === purpose;
}

export function consumeVerificationToken(token: string) {
  tickets.delete(token);
}

export function resetPhoneVerificationForTests() {
  pendingCodes.clear();
  tickets.clear();
}
