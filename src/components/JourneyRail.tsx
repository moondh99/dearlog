import { ArrowRight, Check, Circle, Lock, Radio } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useStore } from '../store';
import { routePreloads } from '../routes/pageLoaders';
import { buildUserJourney, type JourneyStageStatus } from '../lib/journey/user-journey';

function cx(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const statusLabels: Record<JourneyStageStatus, string> = {
  done: '완료',
  active: '현재',
  ready: '대기',
  locked: '잠김',
};

function StageIcon({ status }: { status: JourneyStageStatus }) {
  if (status === 'done') return <Check className="w-3.5 h-3.5" aria-hidden="true" />;
  if (status === 'active') return <Radio className="w-3.5 h-3.5" aria-hidden="true" />;
  if (status === 'locked') return <Lock className="w-3.5 h-3.5" aria-hidden="true" />;
  return <Circle className="w-3.5 h-3.5" aria-hidden="true" />;
}

export default function JourneyRail() {
  const location = useLocation();
  const memories = useStore((state) => state.memories);
  const familyQuestions = useStore((state) => state.familyQuestions.questions);
  const speechProfile = useStore((state) => state.speechProfile.profile);
  const autobiographyChapterCount = useStore((state) => state.autobiography.narratives.length);

  const journey = buildUserJourney({
    pathname: location.pathname,
    memoryCount: memories.length,
    publicMemoryCount: memories.filter((memory) => memory.privacy !== 'private').length,
    pendingFamilyQuestionCount: familyQuestions.filter((question) => question.status === 'pending').length,
    speechProfileReady: Boolean(speechProfile),
    autobiographyChapterCount,
  });

  return (
    <section className="premium-panel shrink-0 rounded-[28px] p-3.5" aria-label="사용자 여정">
      <div className="flex flex-col gap-3.5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center justify-between gap-3 px-1 xl:hidden">
          <p className="text-[11px] font-black uppercase tracking-[0.22em] text-text-subtle">Journey</p>
          <p className="truncate text-[13px] font-black text-primary">{journey.nextAction.label}</p>
        </div>
        <nav className="flex gap-2 overflow-x-auto pb-1 xl:pb-0" aria-label="사용자 여정 단계">
          {journey.stages.map((stage, index) => (
            <Link
              key={stage.id}
              to={stage.route}
              aria-current={stage.status === 'active' ? 'step' : undefined}
              onMouseEnter={() => routePreloads[stage.route]?.()}
              onFocus={() => routePreloads[stage.route]?.()}
              className={cx(
                'inline-flex shrink-0 items-center gap-2 rounded-2xl border px-3.5 py-2.5 text-[13px] font-black transition-all duration-300 ease-out hover:-translate-y-0.5',
                stage.status === 'active' && 'border-primary bg-primary text-white shadow-[0_12px_28px_rgba(15,23,42,0.18)]',
                stage.status === 'done' && 'border-border/70 bg-white text-primary shadow-sm',
                stage.status === 'ready' && 'border-border/70 bg-surface-alt/70 text-text-muted hover:border-primary/20 hover:bg-white hover:text-text',
                stage.status === 'locked' && 'border-border/60 bg-white/50 text-text-subtle'
              )}
            >
              <span
                className={cx(
                  'inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px]',
                  stage.status === 'active' && 'bg-white/20 text-white',
                  stage.status === 'done' && 'bg-primary text-white',
                  stage.status === 'ready' && 'bg-white text-text-muted ring-1 ring-border/70',
                  stage.status === 'locked' && 'bg-border/35 text-text-subtle'
                )}
              >
                <StageIcon status={stage.status} />
              </span>
              <span>{index + 1}. {stage.label}</span>
              <span className="sr-only">{statusLabels[stage.status]}</span>
            </Link>
          ))}
        </nav>

        <Link
          to={journey.nextAction.route}
          aria-label={`다음 단계 ${journey.nextAction.label}`}
          onMouseEnter={() => routePreloads[journey.nextAction.route]?.()}
          onFocus={() => routePreloads[journey.nextAction.route]?.()}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border/70 bg-white/80 px-4 py-2.5 text-[13px] font-black text-primary shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-primary/20 hover:bg-white xl:min-w-[220px]"
        >
          다음 단계
          <span>{journey.nextAction.label}</span>
          <ArrowRight className="w-4 h-4" aria-hidden="true" />
        </Link>
      </div>
    </section>
  );
}
