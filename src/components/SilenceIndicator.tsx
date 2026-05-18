import { Clock, MessageCircle, RefreshCw, LogOut } from 'lucide-react';
import type { SilenceState } from '../lib/types';

interface SilenceIndicatorProps {
  silenceState: SilenceState;
  onContinue: () => void;
  onChangeTopic: () => void;
  onEndSession: () => void;
}

export default function SilenceIndicator({
  silenceState,
  onContinue,
  onChangeTopic,
  onEndSession,
}: SilenceIndicatorProps) {
  const { isActive, silenceDuration, phase } = silenceState;

  if (!isActive || phase === 'normal') {
    return null;
  }

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    if (mins > 0) {
      return `${mins}분 ${secs}초`;
    }
    return `${secs}초`;
  };

  return (
    <div
      className="space-y-4 p-5 rounded-2xl bg-surface-alt border border-border"
      role="status"
      aria-live="polite"
      aria-label={`침묵 ${formatDuration(silenceDuration)} 경과`}
    >
      {/* Timer */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <Clock className="w-5 h-5 text-text-subtle animate-pulse" aria-hidden="true" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-primary rounded-full animate-ping" />
        </div>
        <span className="text-[16px] text-text-muted font-semibold" aria-label={`경과 시간: ${formatDuration(silenceDuration)}`}>
          {formatDuration(silenceDuration)}
        </span>
      </div>

      {/* Encouragement */}
      {(phase === 'encouraging' || phase === 'offering_options') && (
        <p className="text-[15px] text-text-muted leading-relaxed">
          천천히 생각하셔도 괜찮습니다
        </p>
      )}

      {/* Option buttons (20s+) */}
      {phase === 'offering_options' && (
        <div className="flex flex-col gap-2.5 pt-1" role="group" aria-label="침묵 대응 옵션">
          <button
            type="button"
            onClick={onContinue}
            className="flex items-center justify-center gap-2 w-full min-h-[52px] px-6 py-3 text-[16px] font-semibold text-text bg-surface border border-border rounded-2xl hover:bg-border/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30 transition-colors"
            aria-label="계속 생각하기"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            계속 생각할게요
          </button>
          <button
            type="button"
            onClick={onChangeTopic}
            className="flex items-center justify-center gap-2 w-full min-h-[52px] px-6 py-3 text-[16px] font-semibold text-secondary bg-secondary-pale border border-secondary/25 rounded-2xl hover:bg-secondary-pale/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-secondary/30 transition-colors"
            aria-label="다른 이야기하기"
          >
            <MessageCircle className="w-4 h-4" aria-hidden="true" />
            다른 이야기 할래요
          </button>
          <button
            type="button"
            onClick={onEndSession}
            className="flex items-center justify-center gap-2 w-full min-h-[52px] px-6 py-3 text-[16px] font-semibold text-text-muted bg-surface-alt border border-border rounded-2xl hover:bg-border/30 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/30 transition-colors"
            aria-label="오늘은 여기까지"
          >
            <LogOut className="w-4 h-4" aria-hidden="true" />
            오늘은 여기까지
          </button>
        </div>
      )}
    </div>
  );
}
