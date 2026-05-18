import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserRound, UsersRound } from 'lucide-react';
import { useStore, type SeniorProfile } from '../store';
import { cn } from '../components/Layout';

const birthDecadeOptions = ['1940년대', '1950년대', '1960년대', '1970년대'];

export default function OnboardingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useStore((state) => state.auth);
  const selectRole = useStore((state) => state.selectRole);
  const saveSeniorProfile = useStore((state) => state.saveSeniorProfile);
  const skipFamilyInvite = useStore((state) => state.skipFamilyInvite);
  const [profile, setProfile] = useState<SeniorProfile>({
    name: auth.profile?.name ?? '',
    birthDecade: auth.profile?.birthDecade ?? '1950년대',
    preferredName: auth.profile?.preferredName ?? '어르신',
  });
  const [error, setError] = useState('');

  const isProfileStep = location.pathname.endsWith('/senior-profile');

  const handleRole = (role: 'senior' | 'family') => {
    selectRole(role);
    navigate(role === 'family' ? '/review' : '/onboarding/senior-profile');
  };

  const handleProfileSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile.name.trim() || !profile.preferredName.trim()) {
      setError('이름과 선호 호칭을 입력해 주세요.');
      return;
    }
    saveSeniorProfile({
      ...profile,
      name: profile.name.trim(),
      preferredName: profile.preferredName.trim(),
    });
    navigate('/');
  };

  const handleSkipInvite = () => {
    skipFamilyInvite();
  };

  if (!isProfileStep) {
    return (
      <main className="min-h-[100dvh] bg-bg px-5 py-8 text-text">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-[28px] font-black text-text">누구의 이야기로 시작할까요?</h1>
            <p className="mt-2 text-[16px] font-semibold leading-relaxed text-text-muted">
              Dearlog는 어르신의 회상 기록을 먼저 열고, 가족은 질문과 검수를 도와드립니다.
            </p>
          </div>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => handleRole('senior')}
              className="flex w-full items-start gap-4 rounded-[28px] border-2 border-primary bg-primary-pale p-5 text-left shadow-sm transition hover:bg-primary-pale/70"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-white">
                <UserRound className="h-6 w-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[20px] font-black text-primary">어르신으로 시작</span>
                <span className="mt-1 block text-[14px] font-bold leading-relaxed text-primary">
                  내 이야기를 직접 남기고 가족에게 전할 기억을 모읍니다.
                </span>
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleRole('family')}
              className="flex w-full items-start gap-4 rounded-[28px] border border-border bg-surface p-5 text-left shadow-sm transition hover:bg-surface-alt"
            >
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-secondary text-white">
                <UsersRound className="h-6 w-6" aria-hidden="true" />
              </span>
              <span>
                <span className="block text-[20px] font-black text-text">가족으로 참여</span>
                <span className="mt-1 block text-[14px] font-bold leading-relaxed text-text-muted">
                  질문을 남기고 공개된 기억을 함께 검수합니다.
                </span>
              </span>
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-bg px-5 py-8 text-text">
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
        <div className="mb-8">
          <h1 className="text-[28px] font-black text-text">어르신 기본 프로필</h1>
          <p className="mt-2 text-[16px] font-semibold leading-relaxed text-text-muted">
            인터뷰 질문과 화면 안내에 사용할 기본 정보를 정합니다.
          </p>
        </div>

        <form onSubmit={handleProfileSubmit} className="space-y-5 rounded-[28px] border border-border bg-surface p-6 shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
          <label className="block">
            <span className="mb-2 block text-[14px] font-black text-text-muted">이름 또는 별명</span>
            <input
              value={profile.name}
              onChange={(event) => {
                setProfile((prev) => ({ ...prev, name: event.target.value }));
                setError('');
              }}
              placeholder="김영자"
              className="w-full rounded-2xl border border-border bg-surface-alt px-4 py-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          <label className="block">
            <span className="mb-2 block text-[14px] font-black text-text-muted">출생연도대</span>
            <select
              value={profile.birthDecade}
              onChange={(event) => setProfile((prev) => ({ ...prev, birthDecade: event.target.value }))}
              className="w-full rounded-2xl border border-border bg-surface-alt px-4 py-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {birthDecadeOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="mb-2 block text-[14px] font-black text-text-muted">선호 호칭</span>
            <input
              value={profile.preferredName}
              onChange={(event) => {
                setProfile((prev) => ({ ...prev, preferredName: event.target.value }));
                setError('');
              }}
              placeholder="어르신"
              className="w-full rounded-2xl border border-border bg-surface-alt px-4 py-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </label>

          {error && <p className="text-[14px] font-bold text-error">{error}</p>}

          <div className="rounded-2xl border border-secondary/20 bg-secondary-pale p-4">
            <p className="text-[14px] font-bold leading-relaxed text-secondary">
              가족 초대는 나중에 해도 됩니다. 지금은 첫 회상 기록으로 바로 들어갈 수 있습니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleSkipInvite}
              className={cn(
                'rounded-2xl border px-4 py-4 text-[15px] font-black transition',
                auth.familyInviteSkipped
                  ? 'border-secondary bg-secondary-pale text-secondary'
                  : 'border-border bg-surface-alt text-text-muted hover:bg-border/40'
              )}
            >
              초대 건너뛰기
            </button>
            <button
              type="submit"
              className="rounded-2xl bg-primary px-4 py-4 text-[15px] font-black text-white shadow-sm transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              시작하기
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
