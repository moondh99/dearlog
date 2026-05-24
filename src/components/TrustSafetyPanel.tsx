import { FileSearch, ShieldCheck, Trash2 } from 'lucide-react';

const TRUST_SAFETY_ITEMS = [
  {
    icon: FileSearch,
    title: '원문 근거 확인',
    description: 'STT 원문, AI 정리본, 가족 검수본을 나란히 대조합니다.',
  },
  {
    icon: ShieldCheck,
    title: '공개 전 가족 검수',
    description: '가족 공개와 출판은 기억별 동의와 공개 범위를 따른 뒤 진행합니다.',
  },
  {
    icon: Trash2,
    title: '철회와 삭제 가능',
    description: '원치 않는 기억은 모든 활용을 중지하거나 완전히 삭제할 수 있습니다.',
  },
];

interface TrustSafetyPanelProps {
  compact?: boolean;
}

export default function TrustSafetyPanel({ compact = false }: TrustSafetyPanelProps) {
  return (
    <section
      className={`premium-panel rounded-[28px] ${compact ? 'p-5' : 'p-6 sm:p-7'}`}
      aria-label="신뢰와 데이터 주권 원칙"
    >
      <div className={compact ? 'space-y-1' : 'flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'}>
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-text-subtle">Trust controls</p>
          <h2 className="mt-2 text-[20px] font-black text-text">기억의 통제권은 사용자에게 있습니다</h2>
        </div>
        {!compact && (
          <p className="max-w-md text-[14px] font-medium leading-relaxed text-text-muted">
            저장이 부담스러운 기억은 근거를 확인하고, 공개 전 검수하고, 언제든 멈출 수 있게 설계합니다.
          </p>
        )}
      </div>

      <div className={`mt-5 grid gap-3 ${compact ? 'grid-cols-1' : 'md:grid-cols-3'}`}>
        {TRUST_SAFETY_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.title} className="rounded-[22px] border border-border/70 bg-white/74 px-4 py-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border border-border/70 bg-surface-alt text-primary shadow-sm">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </div>
                <div>
                  <h3 className="text-[15px] font-black text-text">{item.title}</h3>
                  <p className="mt-1 text-[12px] font-semibold leading-relaxed text-text-muted">{item.description}</p>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
