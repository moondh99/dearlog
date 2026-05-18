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
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-secondary-pale border-secondary/25 text-secondary',
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
      className={cn('flex items-start gap-3 rounded-2xl border px-4 py-3', toneClass[tone])}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-black">{title}</p>
        {message && <p className="text-[13px] font-semibold opacity-85 mt-0.5">{message}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="p-1 rounded-lg hover:bg-white/50 transition-colors"
          aria-label="상태 메시지 닫기"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
