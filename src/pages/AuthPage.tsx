import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { useStore } from '../store';

function isKoreanPhoneNumber(value: string) {
  return /^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(value.trim());
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, '');
}

export default function AuthPage() {
  const navigate = useNavigate();
  const startPhoneAuth = useStore((state) => state.startPhoneAuth);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isKoreanPhoneNumber(phoneNumber)) {
      setError('휴대폰 번호를 다시 확인해 주세요.');
      return;
    }

    startPhoneAuth(normalizePhoneNumber(phoneNumber));
    navigate('/auth/verify');
  };

  return (
    <main className="min-h-[100dvh] bg-bg px-4 py-5 text-text sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100dvh-2.5rem)] w-full max-w-6xl overflow-hidden rounded-[34px] border border-border bg-surface shadow-[0_24px_80px_rgba(41,35,33,0.12)] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="flex min-h-[380px] flex-col justify-between bg-[#2A2027] p-8 text-white lg:p-12">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-white/12 ring-1 ring-white/15">
                <BookOpen className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-[31px] font-black leading-none tracking-tight">Dearlog</h1>
                <p className="mt-1 text-[13px] font-bold text-white/55">Memory to book</p>
              </div>
            </div>

            <div className="mt-16 max-w-xl">
              <p className="text-[13px] font-black uppercase tracking-[0.22em] text-white/45">Mobile memoir service</p>
              <h2 className="mt-4 text-[34px] font-black leading-tight tracking-tight sm:text-[44px]">
                기록된 기억을 가족에게 건넬 수 있는 책으로.
              </h2>
              <p className="mt-5 max-w-lg text-[17px] font-semibold leading-relaxed text-white/68">
                대화형 회상, 가족 검수, 근거 기반 분신 대화, 인쇄용 자서전까지 하나의 여정으로 연결합니다.
              </p>
            </div>
          </div>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            {['대화형 회상', '가족 공개 동의', 'A5 인쇄 자서전'].map((item) => (
              <div key={item} className="rounded-[18px] border border-white/10 bg-white/8 px-4 py-3">
                <CheckCircle2 className="mb-2 h-4 w-4 text-[#DDB4BE]" aria-hidden="true" />
                <p className="text-[13px] font-black text-white/86">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-5 sm:p-8 lg:p-12">
          <div className="w-full max-w-md">
            <div className="mb-7">
              <p className="text-[13px] font-black uppercase tracking-[0.18em] text-primary">Sign in</p>
              <h2 className="mt-2 text-[27px] font-black tracking-tight text-text">시연을 시작합니다</h2>
              <p className="mt-2 text-[15px] font-semibold leading-relaxed text-text-muted">
                휴대폰 번호 인증 후 어르신 프로필과 가족 초대 흐름으로 이어집니다.
              </p>
            </div>

            <div className="mb-5 flex items-start gap-3 rounded-[22px] border border-primary/12 bg-primary-pale p-4">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-[14px] font-bold leading-relaxed text-primary">
                휴대폰 번호는 본인 확인과 가족 초대 연결에만 사용합니다.
              </p>
            </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-text">휴대폰 번호</span>
              <div className="relative">
                <Smartphone className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text-subtle" aria-hidden="true" />
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(event) => {
                    setPhoneNumber(event.target.value);
                    setError('');
                  }}
                  placeholder="010 1234 5678"
                  aria-invalid={Boolean(error)}
                  className="w-full rounded-[20px] border border-border bg-surface-alt py-4 pl-12 pr-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </label>

            {error && <p className="text-[14px] font-bold text-error">{error}</p>}

            <button
              type="submit"
              className="w-full rounded-[20px] bg-primary px-5 py-4 text-[17px] font-black text-white shadow-[0_16px_32px_rgba(122,49,67,0.24)] transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              인증번호 받기
            </button>
          </form>

            <div className="mt-6 rounded-[22px] border border-border bg-surface-alt p-4">
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-text-subtle">Demo hint</p>
              <p className="mt-1 text-[14px] font-bold leading-relaxed text-text-muted">
                발표 시에는 로그인 후 설정의 발표 데모 탭에서 사전 데이터를 불러오면 됩니다.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
