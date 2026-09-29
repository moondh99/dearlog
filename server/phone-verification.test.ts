// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  OTP_CODE_TTL_MS,
  OTP_RESEND_COOLDOWN_MS,
  OTP_TICKET_TTL_MS,
  isVerificationTokenValid,
  issueOtpCode,
  resetPhoneVerificationForTests,
  verifyOtpCode,
} from './phone-verification';

// 시간이 걸리는 규칙(만료, 재발송 간격)은 시각을 직접 넘겨 확인한다.

const PHONE = '01012345678';
const T0 = 1_800_000_000_000;

beforeEach(() => resetPhoneVerificationForTests());
afterEach(() => vi.restoreAllMocks());

function issue(now = T0) {
  const issued = issueOtpCode(PHONE, 'login', now);
  if (issued.ok === false) throw new Error('expected a code');
  return issued.code;
}

describe('휴대폰 인증번호', () => {
  it('6자리 번호를 암호학적 난수로 만든다', () => {
    const random = vi.spyOn(Math, 'random');
    const code = issue();
    expect(code).toMatch(/^\d{6}$/);
    expect(random).not.toHaveBeenCalled();
  });

  it('3분이 지나면 맞는 번호도 받지 않는다', () => {
    const code = issue();
    expect(verifyOtpCode(PHONE, 'login', code, T0 + OTP_CODE_TTL_MS)).toEqual({ ok: false, reason: 'expired' });
  });

  it('1분 안에는 다시 보내지 않는다', () => {
    issue();
    const again = issueOtpCode(PHONE, 'login', T0 + OTP_RESEND_COOLDOWN_MS - 1000);
    expect(again.ok).toBe(false);
    expect(issueOtpCode(PHONE, 'login', T0 + OTP_RESEND_COOLDOWN_MS).ok).toBe(true);
  });

  it('다시 보내면 앞의 번호는 쓸 수 없다', () => {
    const first = issue();
    const second = issue(T0 + OTP_RESEND_COOLDOWN_MS);
    if (first === second) return; // 100만분의 1 확률로 같은 번호가 나온다.
    expect(verifyOtpCode(PHONE, 'login', first, T0 + OTP_RESEND_COOLDOWN_MS + 1).ok).toBe(false);
  });

  it('용도가 다르면 맞는 번호도 받지 않는다', () => {
    const code = issue();
    expect(verifyOtpCode(PHONE, 'signup', code, T0 + 1)).toEqual({ ok: false, reason: 'missing' });
  });

  it('확인 토큰은 10분이 지나면 무효다', () => {
    const code = issue();
    const verified = verifyOtpCode(PHONE, 'login', code, T0 + 1);
    if (verified.ok === false) throw new Error('expected a token');
    expect(isVerificationTokenValid(verified.verificationToken, PHONE, 'login', T0 + 2)).toBe(true);
    expect(isVerificationTokenValid(verified.verificationToken, PHONE, 'login', T0 + 1 + OTP_TICKET_TTL_MS)).toBe(false);
  });

  it('인증번호는 한 번만 맞힐 수 있다', () => {
    const code = issue();
    expect(verifyOtpCode(PHONE, 'login', code, T0 + 1).ok).toBe(true);
    expect(verifyOtpCode(PHONE, 'login', code, T0 + 2)).toEqual({ ok: false, reason: 'missing' });
  });
});
