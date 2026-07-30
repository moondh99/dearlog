import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

function formatKoreanPhoneNumber(value: string) {
  const digits = value.replace(/[^\d]/g, '').slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, digits.length - 4)}-${digits.slice(-4)}`;
}

export default function VerifyPage() {
  const navigate = useNavigate();
  const phoneNumber = useAuthStore((state) => state.phoneNumber);
  const role = useAuthStore((state) => state.role);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const displayPhoneNumber = phoneNumber ? formatKoreanPhoneNumber(phoneNumber) : '';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) {
      setError('6자리 인증번호를 입력해 주세요.');
      return;
    }
    setError('');
    if (role === 'parent') {
      navigate('/parent');
      return;
    }
    if (role === 'child') {
      navigate('/child');
      return;
    }
    navigate('/auth');
  };

  return (
    <main className="flex min-h-[100dvh] flex-col bg-[#F8F6F9] px-6 text-[#2A2830]">
      <div className="flex h-16 shrink-0 items-center">
        <Link
          to="/auth"
          className="-ml-1 flex h-10 w-10 items-center justify-center rounded-full text-[#7A767F] transition active:bg-[#EDE8F0]"
          aria-label="이전 화면으로"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
        </Link>
      </div>

      <header className="shrink-0 pb-9">
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-[#7A767F]">
          회원가입
        </p>
        <h1 className="mt-4 whitespace-pre-line font-serif text-[26px] font-normal leading-[1.35] text-[#2A2830]">
          인증번호를{'\n'}입력해주세요
        </h1>
        <p className="mt-3 text-[12px] leading-[1.5] text-[#7A767F]">
          {displayPhoneNumber ? `${displayPhoneNumber}로 발송된` : '문자로 발송된'} 6자리 번호를 입력해주세요.
        </p>
      </header>

      <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
        <label className="block">
          <span className="sr-only">인증번호</span>
          <input
            inputMode="numeric"
            maxLength={6}
            value={code}
            onChange={(event) => {
              setCode(event.target.value.replace(/[^\d]/g, ''));
              setError('');
            }}
            aria-invalid={Boolean(error)}
            className="sr-only"
          />
          <div className="grid grid-cols-6 gap-3" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="flex h-[54px] items-center justify-center rounded-[14px] border border-[#E0DBE8] bg-white font-serif text-[18px] text-[#2A2830]"
              >
                {code[index] ?? <span className="text-[rgba(122,118,127,0.3)]">·</span>}
              </div>
            ))}
          </div>
        </label>

        <div className="mt-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#9485BE]" />
            <span className="text-[12px] text-[#7A767F]">남은 시간</span>
          </div>
          <span className="font-serif text-[13px] text-[#9485BE]">03:00</span>
        </div>

        <div className="mt-6 h-px bg-[#E0DBE8]" />

        <div className="mt-6 rounded-[14px] bg-[rgba(237,232,240,0.68)] px-4 py-4">
          <p className="text-[12px] leading-[1.7] text-[#7A767F]">
            인증번호가 오지 않나요? 번호를 확인하고 잠시 후 다시 받아보세요.
          </p>
        </div>

        {error && <p className="mt-4 text-[13px] font-medium text-[#FF3B30]">{error}</p>}

        <div className="mt-auto flex flex-col gap-3 pb-10 pt-8">
          <button
            type="submit"
            className="min-h-[51px] w-full rounded-[14px] bg-[#2A2830] px-6 text-[14px] font-medium tracking-[0.04em] text-[#F7F5FB] shadow-[0_12px_28px_rgba(42,40,48,0.16)] transition active:scale-[0.99]"
          >
            인증하기
          </button>

          <Link
            to="/auth"
            className="flex min-h-[51px] w-full items-center justify-center rounded-[14px] border border-[#E0DBE8] bg-white px-6 text-[14px] font-medium tracking-[0.03em] text-[#2A2830] transition active:scale-[0.99]"
          >
            인증번호 다시 받기
          </Link>
        </div>
      </form>
    </main>
  );
}
