import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from './Layout';

export type StatusNoticeTone = 'success' | 'error' | 'info';

interface StatusNoticeProps {
  tone: StatusNoticeTone;
  title: string;
  message?: string;
  onDismiss?: () => void;
}

const toneClass: Record<StatusNoticeTone, string> = {
  success: 'bg-white/86 border-emerald-200/70 text-emerald-800 shadow-sm',
  error: 'bg-white/86 border-red-200/70 text-red-800 shadow-sm',
  info: 'bg-white/86 border-border/80 text-text-muted shadow-sm',
};

const icons = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

export default function StatusNotice({ tone, title, message, onDismiss }: StatusNoticeProps) {
  const Icon = icons[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn('flex items-start gap-3 rounded-2xl border px-4.5 py-3.5 backdrop-blur', toneClass[tone])}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black text-text">{title}</p>
        {message && <p className="mt-1 text-[13px] font-medium leading-relaxed opacity-85">{message}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-lg p-1 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-surface-alt"
          aria-label="상태 메시지 닫기"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
