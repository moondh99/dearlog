import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

export type StatusNoticeTone = 'success' | 'error' | 'info';

interface StatusNoticeProps {
  tone: StatusNoticeTone;
  title: string;
  message?: string;
  onDismiss?: () => void;
}

const toneClass: Record<StatusNoticeTone, string> = {
  success: 'border-[#E0DBE8] bg-white text-[#2A2830]',
  error: 'border-[#FF3B30]/20 bg-[#FF3B30]/10 text-[#FF3B30]',
  info: 'border-[#E0DBE8] bg-[rgba(237,232,240,0.68)] text-[#7A767F]',
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
      className={cn('flex items-start gap-3 rounded-[14px] border px-4 py-4', toneClass[tone])}
    >
      <Icon className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium leading-[1.6]">{title}</p>
        {message && <p className="mt-1 text-[12px] leading-[1.7] opacity-85">{message}</p>}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          className="rounded-[8px] p-1 text-[#7A767F] transition active:bg-[#EDE8F0]"
          aria-label="상태 메시지 닫기"
        >
          <X className="w-4 h-4" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
