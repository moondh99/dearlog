import { useState } from 'react';
import type { FormEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { UserRound, UsersRound } from 'lucide-react';
import { useStore, type GuardianProfile, type SeniorProfile } from '../store';
import { cn } from '../components/Layout';
import { updateLocalUserProfile, updateLocalUserRole } from '../lib/local-server';

const birthDecadeOptions = ['1940년대', '1950년대', '1960년대', '1970년대'];
const relationshipOptions = ['자녀', '배우자', '손주', '형제자매', '기타 가족'];

export default function OnboardingPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const auth = useStore((state) => state.auth);
  const selectRole = useStore((state) => state.selectRole);
  const setServerAuthUser = useStore((state) => state.setServerAuthUser);
  const saveSeniorProfile = useStore((state) => state.saveSeniorProfile);
  const saveGuardianProfile = useStore((state) => state.saveGuardianProfile);
  const skipFamilyInvite = useStore((state) => state.skipFamilyInvite);
  const [profile, setProfile] = useState<SeniorProfile>({
    name: auth.profile?.name ?? '',
    birthDecade: auth.profile?.birthDecade ?? '1950년대',
    preferredName: auth.profile?.preferredName ?? '어르신',
  });
  const [guardianProfile, setGuardianProfile] = useState<GuardianProfile>({
    name: auth.guardianProfile?.name ?? '',
    relationship: auth.guardianProfile?.relationship ?? '자녀',
    preferredName: auth.guardianProfile?.preferredName ?? '보호자',
  });
  const [error, setError] = useState('');
  const [pendingRole, setPendingRole] = useState<'senior' | 'guardian' | null>(null);
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  const isSeniorProfileStep = location.pathname.endsWith('/senior-profile');
  const isGuardianProfileStep = location.pathname.endsWith('/guardian-profile');

  const handleRole = async (role: 'senior' | 'guardian') => {
    setPendingRole(role);
    setError('');
    try {
      if (auth.userId) {
        const { user } = await updateLocalUserRole(auth.userId, role);
        // 역할 선택 역시 서버 DB에 반영해 실제 테스트 참여자 계정 상태를 유지합니다.
        setServerAuthUser(user);
      } else {
        selectRole(role);
      }
      navigate(role === 'guardian' ? '/onboarding/guardian-profile' : '/onboarding/senior-profile');
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : '역할 저장에 실패했습니다.');
    } finally {
      setPendingRole(null);
    }
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile.name.trim() || !profile.preferredName.trim()) {
      setError('이름과 선호 호칭을 입력해 주세요.');
      return;
    }
    const trimmedProfile = {
      ...profile,
      name: profile.name.trim(),
      preferredName: profile.preferredName.trim(),
    };
    setIsSavingProfile(true);
    try {
      if (auth.userId) {
        const { user } = await updateLocalUserProfile({
          userId: auth.userId,
          role: 'senior',
          ...trimmedProfile,
        });
        // 프로필은 인터뷰 안내와 DB 계정 표시명에 함께 쓰이므로 로컬 상태와 서버를 같이 갱신합니다.
        setServerAuthUser(user);
      }
      saveSeniorProfile(trimmedProfile);
      navigate('/');
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : '프로필 저장에 실패했습니다.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleGuardianProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!guardianProfile.name.trim() || !guardianProfile.relationship.trim() || !guardianProfile.preferredName.trim()) {
      setError('이름, 관계, 호칭을 입력해 주세요.');
      return;
    }
    const trimmedProfile = {
      ...guardianProfile,
      name: guardianProfile.name.trim(),
      relationship: guardianProfile.relationship.trim(),
      preferredName: guardianProfile.preferredName.trim(),
    };
    setIsSavingProfile(true);
    try {
      if (auth.userId) {
        const { user } = await updateLocalUserProfile({
          userId: auth.userId,
          role: 'guardian',
          name: trimmedProfile.name,
          preferredName: trimmedProfile.preferredName,
          relationship: trimmedProfile.relationship,
        });
        // 보호자 프로필도 서버 DB에 저장해 실제 테스트 참여자 정보를 수집합니다.
        setServerAuthUser(user);
      }
      saveGuardianProfile(trimmedProfile);
      navigate('/child');
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : '보호자 정보 저장에 실패했습니다.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSkipInvite = () => {
    skipFamilyInvite();
  };

  if (!isSeniorProfileStep && !isGuardianProfileStep) {
    return (
      <main className="min-h-[100dvh] bg-[#101114] px-5 py-8 text-white">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-5xl flex-col justify-center">
          <div className="mb-10 text-center">
            <p className="text-[13px] font-black uppercase tracking-[0.22em] text-white/42">Dearlog profiles</p>
            <h1 className="mt-3 text-[34px] font-black text-white sm:text-[44px]">누가 사용하시나요?</h1>
            <p className="mx-auto mt-3 max-w-2xl text-[16px] font-semibold leading-relaxed text-white/58">
              실제 사용자 테스트에서는 휴대폰 번호 계정 하나에 선택한 역할이 저장됩니다.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => handleRole('senior')}
              disabled={Boolean(pendingRole)}
              className="group flex min-h-[270px] w-full flex-col items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.08] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.25)] transition duration-300 hover:-translate-y-1 hover:border-white/26 hover:bg-white/[0.13] focus:outline-none focus:ring-4 focus:ring-white/12 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#F2C879] text-[#17130B] shadow-[0_20px_48px_rgba(242,200,121,0.18)] transition group-hover:scale-105">
                <UserRound className="h-12 w-12" aria-hidden="true" />
              </span>
              <span className="mt-7 block text-[26px] font-black text-white">어르신</span>
              <span className="mt-3 block max-w-[260px] text-[14px] font-bold leading-relaxed text-white/55">
                인터뷰 화면만 보고 사진과 질문에 편하게 답합니다.
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleRole('guardian')}
              disabled={Boolean(pendingRole)}
              className="group flex min-h-[270px] w-full flex-col items-center justify-center rounded-[8px] border border-white/10 bg-white/[0.08] p-6 text-center shadow-[0_24px_70px_rgba(0,0,0,0.25)] transition duration-300 hover:-translate-y-1 hover:border-white/26 hover:bg-white/[0.13] focus:outline-none focus:ring-4 focus:ring-white/12 disabled:cursor-wait disabled:opacity-60"
            >
              <span className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-[#84B7FF] text-[#07111F] shadow-[0_20px_48px_rgba(132,183,255,0.18)] transition group-hover:scale-105">
                <UsersRound className="h-12 w-12" aria-hidden="true" />
              </span>
              <span className="mt-7 block text-[26px] font-black text-white">보호자</span>
              <span className="mt-3 block max-w-[260px] text-[14px] font-bold leading-relaxed text-white/55">
                사진, 질문, 진척도, 출판 신청을 관리합니다.
              </span>
            </button>
          </div>
          {error && <p className="mt-6 text-center text-[14px] font-bold text-[#FFB4A8]">{error}</p>}
        </div>
      </main>
    );
  }

  if (isGuardianProfileStep) {
    return (
      <main className="min-h-[100dvh] bg-bg px-5 py-8 text-text">
        <div className="mx-auto flex min-h-[calc(100dvh-4rem)] w-full max-w-md flex-col justify-center">
          <div className="mb-8">
            <h1 className="text-[28px] font-black text-text">보호자 기본 정보</h1>
            <p className="mt-2 text-[16px] font-semibold leading-relaxed text-text-muted">
              가족 공간에서 사진과 질문을 관리할 때 표시할 정보를 입력합니다.
            </p>
          </div>

          <form onSubmit={handleGuardianProfileSubmit} className="space-y-5 rounded-[28px] border border-border bg-surface p-6 shadow-[0_8px_28px_rgba(0,0,0,0.06)]">
            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-text-muted">보호자 이름</span>
              <input
                value={guardianProfile.name}
                onChange={(event) => {
                  setGuardianProfile((prev) => ({ ...prev, name: event.target.value }));
                  setError('');
                }}
                placeholder="김민수"
                className="w-full rounded-2xl border border-border bg-surface-alt px-4 py-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-text-muted">어르신과의 관계</span>
              <select
                value={guardianProfile.relationship}
                onChange={(event) => setGuardianProfile((prev) => ({ ...prev, relationship: event.target.value }))}
                className="w-full rounded-2xl border border-border bg-surface-alt px-4 py-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                {relationshipOptions.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-2 block text-[14px] font-black text-text-muted">화면에 표시할 호칭</span>
              <input
                value={guardianProfile.preferredName}
                onChange={(event) => {
                  setGuardianProfile((prev) => ({ ...prev, preferredName: event.target.value }));
                  setError('');
                }}
                placeholder="보호자"
                className="w-full rounded-2xl border border-border bg-surface-alt px-4 py-4 text-[18px] font-bold text-text outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </label>

            {error && <p className="text-[14px] font-bold text-error">{error}</p>}

            <div className="rounded-2xl border border-primary/20 bg-primary-pale p-4">
              <p className="text-[14px] font-bold leading-relaxed text-primary">
                이 정보는 로컬 DB에 저장되며, 가족 공간의 관리 주체를 구분하는 데 사용됩니다.
              </p>
            </div>

            <button
              type="submit"
              disabled={isSavingProfile}
              className="w-full rounded-2xl bg-primary px-4 py-4 text-[15px] font-black text-white shadow-sm transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {isSavingProfile ? '저장 중...' : '가족 공간 시작'}
            </button>
          </form>
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
            인터뷰 질문과 화면 안내에 사용할 최소 정보만 정합니다. 나머지는 가족이 나중에 도울 수 있습니다.
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
              가족 초대와 사진 준비는 나중에 해도 됩니다. 부모님은 지금 바로 첫 회상 기록으로 들어갈 수 있습니다.
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
              disabled={isSavingProfile}
              className="rounded-2xl bg-primary px-4 py-4 text-[15px] font-black text-white shadow-sm transition hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {isSavingProfile ? '저장 중...' : '시작하기'}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
