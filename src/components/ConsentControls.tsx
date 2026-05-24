import { Lock, Users, Globe, UserCheck } from 'lucide-react';
import type { MemoryConsent, AccessTier, ConsentCategoryV2, ConsentSettingsV2, ConsentStatus } from '../lib/types';

interface ConsentControlsProps {
  memoryId: string;
  consent: MemoryConsent;
  consentSettings: ConsentSettingsV2;
  onConsentChange: (consent: MemoryConsent) => void;
  onConsentSettingsChange: (settings: ConsentSettingsV2) => void;
}

const accessTierConfig: Record<AccessTier, { icon: typeof Lock; label: string; description: string }> = {
  '본인만': { icon: Lock,      label: '본인만',    description: '본인만 열람 가능' },
  '지정 가족': { icon: UserCheck, label: '지정 가족', description: '지정된 가족만 열람 가능' },
  '전체 가족': { icon: Globe,     label: '전체 가족', description: '모든 가족 열람 가능' },
};

const accessTiers: AccessTier[] = ['본인만', '지정 가족', '전체 가족'];

const categoryDescriptions: Record<ConsentCategoryV2, string> = {
  출판: '자서전과 PDF에 포함',
  가족열람: '가족 공간에서 열람',
  챗봇: '나의 분신 답변 근거',
  사후공개: '사후 정책 적용 대상',
  민감정보: '민감한 내용 전체 열람',
};

const consentCategories: ConsentCategoryV2[] = ['출판', '가족열람', '챗봇', '사후공개', '민감정보'];

export default function ConsentControls({
  memoryId,
  consent,
  consentSettings,
  onConsentChange,
  onConsentSettingsChange,
}: ConsentControlsProps) {
  const handleConsentToggle = () => {
    onConsentChange({
      ...consent,
      status: consent.status === 'granted' ? 'revoked' : 'granted',
      lastModified: new Date().toISOString(),
    });
  };

  const handleAccessTierChange = (tier: AccessTier) => {
    onConsentChange({
      ...consent,
      accessTier: tier,
      designatedFamilyIds: tier !== '지정 가족' ? [] : consent.designatedFamilyIds,
      lastModified: new Date().toISOString(),
    });
  };

  const handleFamilyMemberAdd = (familyId: string) => {
    if (!consent.designatedFamilyIds.includes(familyId)) {
      onConsentChange({
        ...consent,
        designatedFamilyIds: [...consent.designatedFamilyIds, familyId],
        lastModified: new Date().toISOString(),
      });
    }
  };

  const handleFamilyMemberRemove = (familyId: string) => {
    onConsentChange({
      ...consent,
      designatedFamilyIds: consent.designatedFamilyIds.filter((id) => id !== familyId),
      lastModified: new Date().toISOString(),
    });
  };

  const handleCategoryToggle = (category: ConsentCategoryV2) => {
    const nextStatus: ConsentStatus =
      consentSettings[category] === 'granted' ? 'revoked' : 'granted';
    onConsentSettingsChange({
      ...consentSettings,
      [category]: nextStatus,
    });
  };

  const currentTierConfig = accessTierConfig[consent.accessTier];
  const TierIcon = currentTierConfig.icon;

  return (
    <div
      className="space-y-4 rounded-2xl border border-border/70 bg-white/76 p-4 shadow-sm"
      aria-label={`기억 항목 ${memoryId} 동의 설정`}
      role="group"
    >
      <div className="rounded-2xl border border-secondary/20 bg-secondary-pale/60 px-4 py-3 shadow-sm">
        <p className="text-[13px] font-black text-secondary">공개 범위와 활용 동의는 따로 정합니다</p>
        <p className="mt-1 text-[12px] font-semibold text-text-muted leading-relaxed">
          접근 권한은 이 기억을 읽을 수 있는 사람을, 세부 동의는 자서전·분신·사후 공개 같은 사용처를 정합니다.
        </p>
      </div>

      {/* Consent Toggle */}
      <div className="flex items-center justify-between">
        <span className="text-[14px] font-semibold text-text-muted">공유 동의</span>
        <button
          type="button"
          role="switch"
          aria-checked={consent.status === 'granted'}
          aria-label={consent.status === 'granted' ? '공유 동의됨 - 클릭하여 철회' : '공유 철회됨 - 클릭하여 동의'}
          onClick={handleConsentToggle}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30 ${
            consent.status === 'granted' ? 'bg-success' : 'bg-border-strong'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform ${
              consent.status === 'granted' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Current Access Tier Display */}
      <div className="flex items-center gap-2 text-[13px] text-text-muted">
        <TierIcon className="w-4 h-4" aria-hidden="true" />
        <span>{currentTierConfig.description}</span>
      </div>

      {/* Access Tier Selector */}
      <fieldset>
        <legend className="text-[13px] font-semibold text-text-muted mb-2">접근 권한</legend>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="접근 권한 선택">
          {accessTiers.map((tier) => {
            const config = accessTierConfig[tier];
            const Icon = config.icon;
            const isSelected = consent.accessTier === tier;

            return (
              <button
                key={tier}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={config.description}
                onClick={() => handleAccessTierChange(tier)}
                className={`flex items-center gap-1.5 rounded-xl border px-3 py-2 text-[13px] font-semibold transition-all duration-300 ease-out hover:-translate-y-0.5 focus:outline-none focus:ring-4 focus:ring-primary/10 ${
                  isSelected
                    ? 'bg-primary-pale border-primary/30 text-primary'
                    : 'bg-white/80 border-border/70 text-text-muted hover:bg-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                {config.label}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* Designated Family Members */}
      {consent.accessTier === '지정 가족' && (
        <div className="space-y-2">
          <label htmlFor={`family-input-${memoryId}`} className="text-[13px] font-semibold text-text-muted">
            지정 가족 구성원
          </label>
          {consent.designatedFamilyIds.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="지정된 가족 목록">
              {consent.designatedFamilyIds.map((familyId) => (
                <li key={familyId}>
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-secondary-pale text-secondary text-[12px] font-semibold border border-secondary/25">
                    <Users className="w-3 h-3" aria-hidden="true" />
                    {familyId}
                    <button
                      type="button"
                      onClick={() => handleFamilyMemberRemove(familyId)}
                      aria-label={`${familyId} 제거`}
                      className="ml-0.5 text-secondary/70 hover:text-secondary focus:outline-none rounded"
                    >
                      ×
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="flex gap-2">
            <input
              id={`family-input-${memoryId}`}
              type="text"
              placeholder="가족 ID 입력"
              className="flex-1 rounded-xl border border-border/80 bg-white/78 px-3 py-2 text-[13px] text-text shadow-sm transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const input = e.currentTarget;
                  const value = input.value.trim();
                  if (value) {
                    handleFamilyMemberAdd(value);
                    input.value = '';
                  }
                }
              }}
            />
            <button
              type="button"
              onClick={(e) => {
                const input = (e.currentTarget.previousElementSibling as HTMLInputElement);
                const value = input.value.trim();
                if (value) {
                  handleFamilyMemberAdd(value);
                  input.value = '';
                }
              }}
              className="rounded-xl bg-primary px-3 py-2 text-[13px] font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light focus:outline-none focus:ring-4 focus:ring-primary/10"
              aria-label="가족 구성원 추가"
            >
              추가
            </button>
          </div>
        </div>
      )}

      <fieldset className="border-t border-border/70 pt-3">
        <legend className="text-[13px] font-semibold text-text-muted mb-2">세부 동의</legend>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {consentCategories.map((category) => {
            const isGranted = consentSettings[category] === 'granted';
            return (
              <button
                key={category}
                type="button"
                onClick={() => handleCategoryToggle(category)}
                aria-pressed={isGranted}
                className={`flex items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 ${
                  isGranted
                    ? 'bg-secondary-pale border-secondary/25 text-secondary'
                    : 'bg-white/78 border-border/70 text-text-muted'
                }`}
              >
                <span>
                  <span className="block text-[13px] font-black">{category}</span>
                  <span className="block text-[11px] font-semibold opacity-80 mt-0.5">
                    {categoryDescriptions[category]}
                  </span>
                </span>
                <span className="text-[12px] font-black shrink-0">
                  {isGranted ? '허용' : '차단'}
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>
    </div>
  );
}
