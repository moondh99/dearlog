import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CheckCircle2, ShieldCheck, Smartphone } from 'lucide-react';
import { useStore } from '../store';
import { registerLocalPhoneAccount } from '../lib/local-server';

function isKoreanPhoneNumber(value: string) {
  return /^01[016789][-\s]?\d{3,4}[-\s]?\d{4}$/.test(value.trim());
}

function normalizePhoneNumber(value: string) {
  return value.replace(/[^\d]/g, '');
}

export default function AuthPage() {
  const navigate = useNavigate();
  const startPhoneAuth = useStore((state) => state.startPhoneAuth);
  const setServerAuthUser = useStore((state) => state.setServerAuthUser);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isKoreanPhoneNumber(phoneNumber)) {
      setError('휴대폰 번호를 다시 확인해 주세요.');
      return;
    }

    const normalizedPhoneNumber = normalizePhoneNumber(phoneNumber);
    setIsSubmitting(true);
    try {
      const { user } = await registerLocalPhoneAccount(normalizedPhoneNumber);
      // SMS 인증 없이 휴대폰 번호를 로컬 DB 계정으로 즉시 등록합니다.
      startPhoneAuth(normalizedPhoneNumber);
      setServerAuthUser({ ...user, forceRoleSelection: true });
      navigate('/select-mode');
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : '가입 정보를 저장하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-[100dvh] bg-bg px-4 py-6 text-text sm:px-6 lg:px-8">
      <div className="premium-panel mx-auto grid min-h-[calc(100dvh-3rem)] w-full max-w-6xl overflow-hidden rounded-[34px] lg:grid-cols-[1.08fr_0.92fr]">
        <section className="flex min-h-[380px] flex-col justify-between bg-primary p-9 text-primary-pale lg:p-14">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] border border-primary-light/20 bg-primary-light/30 shadow-sm ring-1 ring-primary-light/10">
                <BookOpen className="h-6 w-6 text-primary-pale" aria-hidden="true" />
              </div>
              <div>
                <h1 className="text-[31px] font-black leading-none tracking-tight text-primary-pale">Dearlog</h1>
                <p className="mt-1 text-[13px] font-bold text-primary-pale/55">Family memory archive</p>
              </div>
            </div>

            <div className="mt-16 max-w-xl">
              <p className="text-[12px] font-black uppercase tracking-[0.26em] text-primary-pale/45">Memoir plus family archive</p>
              <h2 className="mt-4 text-[34px] font-black leading-tight tracking-tight sm:text-[44px]">
                부모님의 기억을 가족이 다시 만나는 아카이브로.
              </h2>
              <p className="mt-6 max-w-lg text-[17px] font-medium leading-relaxed text-primary-pale/64">
                자녀가 사진과 질문을 준비하면, 부모님은 큰 마이크 버튼으로 편하게 답하고 가족 검수 뒤 자서전·분신 대화·주간 가족 퀴즈로 이어갑니다.
              </p>
            </div>
          </div>

          <div className="mt-12 grid gap-3 sm:grid-cols-3">
            {['자녀가 준비', '부모님은 음성 답변', '가족 검수 아카이브'].map((item) => (
              <div key={item} className="rounded-[18px] border border-primary-light/20 bg-primary-light/30 px-4 py-3.5 shadow-sm backdrop-blur transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light/45">
                <CheckCircle2 className="mb-2 h-4 w-4 text-primary-pale/70" aria-hidden="true" />
                <p className="text-[13px] font-black text-primary-pale/82">{item}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center p-6 sm:p-9 lg:p-14">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <p className="text-[12px] font-black uppercase tracking-[0.22em] text-text-subtle">Sign in / Sign up</p>
              <h2 className="mt-2 text-[27px] font-black tracking-tight text-text">시작하기</h2>
              <p className="mt-3 text-[15px] font-medium leading-relaxed text-text-muted">
                휴대폰 번호 하나로 회원가입 및 로그인을 간편하게 완료합니다.
              </p>
            </div>

            <div className="mb-6 flex items-start gap-3 rounded-[22px] border border-border/70 bg-surface-alt/72 p-4 shadow-sm">
              <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              <p className="text-[14px] font-semibold leading-relaxed text-text-muted">
                입력하신 휴대폰 번호는 로그인 시 본인 확인 및 시니어/가디언 계정 연결에 안전하게 사용됩니다.
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
                    className="w-full rounded-[20px] border border-border/80 bg-surface-alt/70 py-4 pl-12 pr-4 text-[18px] font-bold text-text outline-none shadow-sm transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-primary/40 focus:bg-surface focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </label>

              {error && <p className="text-[14px] font-bold text-error">{error}</p>}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full rounded-[20px] bg-primary px-5 py-4 text-[17px] font-black text-primary-pale shadow-[0_14px_34px_rgba(92,52,32,0.18)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:scale-[1.01] hover:bg-primary-light focus:outline-none focus:ring-4 focus:ring-primary/15"
              >
                {isSubmitting ? '저장 중...' : '휴대폰 번호로 시작'}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}
