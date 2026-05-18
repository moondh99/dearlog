import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KeyRound, MessageCircle } from 'lucide-react';
import { useStore } from '../store';

export default function VerifyPage() {
  const navigate = useNavigate();
  const phoneNumber = useStore((state) => state.auth.phoneNumber);
  const verifyPhoneCode = useStore((state) => state.verifyPhoneCode);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!verifyPhoneCode(code)) {
      setError('6자리 인증번호를 입력해 주세요.');
      return;
    }
    navigate('/onboarding/role');
  };

  return (
    <main className="min-h-[100dvh] bg-bg px-5 py-8 text-text">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[18px] bg-primary-pale text-primary">
            <MessageCircle className="h-7 w-7" aria-hidden="true" />
          </div>
          <h1 className="text-[28px] font-black text-text">인증번호 확인</h1>
          <p className="mt-2 text-[16px] font-semibold leading-relaxed text-text-muted">
            {phoneNumber ? `${phoneNumber} 번호로 보낸` : '문자로 받은'} 6자리 인증번호를 입력해 주세요.
          </p>
        </div>

        <section className="rounded-[28px] border border-border bg-surface p-6 shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-text-muted">인증번호</span>
              <div className="relative">
                <KeyRound className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                <input
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(event) => {
                    setCode(event.target.value.replace(/[^\d]/g, ''));
                    setError('');
                  }}
                  placeholder="483920"
                  aria-invalid={Boolean(error)}
                  className="w-full rounded-2xl border border-border bg-surface-alt py-4 pl-12 pr-4 text-[22px] font-black tracking-[0.18em] text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>

            {error && <p className="text-[14px] font-bold text-error">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-2xl bg-primary px-5 py-4 text-[17px] font-black text-white shadow-sm transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              확인하고 계속
            </button>

            <Link
              to="/auth"
              className="flex w-full items-center justify-center rounded-2xl border border-border bg-surface-alt px-5 py-4 text-[16px] font-black text-text-muted transition hover:bg-border/40"
            >
              휴대폰 번호 다시 입력
            </Link>
          </form>
        </section>
      </div>
    </main>
  );
}
