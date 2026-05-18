import { CheckCircle, HelpCircle, AlertTriangle } from 'lucide-react';
import type { ConfidenceLabel as ConfidenceLabelType } from '../lib/types';

interface ConfidenceLabelProps {
  label: ConfidenceLabelType;
}

const labelConfig: Record<ConfidenceLabelType, { icon: typeof CheckCircle; className: string; ariaLabel: string }> = {
  '확인됨': {
    icon: CheckCircle,
    className: 'bg-green-100 text-green-800 border-green-200',
    ariaLabel: '확인됨 - 신뢰도 높음',
  },
  '추정': {
    icon: HelpCircle,
    className: 'bg-amber-100 text-amber-800 border-amber-200',
    ariaLabel: '추정 - 추가 확인 권장',
  },
  '추가 확인 필요': {
    icon: AlertTriangle,
    className: 'bg-red-100 text-red-800 border-red-200',
    ariaLabel: '추가 확인 필요 - 모순 감지됨',
  },
};

/**
 * ConfidenceLabel displays a visual badge indicating the confidence level
 * of a memory record based on contradiction detection results.
 *
 * Validates: Requirements 1.7
 */
export default function ConfidenceLabel({ label }: ConfidenceLabelProps) {
  const config = labelConfig[label];
  const Icon = config.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium border ${config.className}`}
      role="status"
      aria-label={config.ariaLabel}
    >
      <Icon className="w-4 h-4" aria-hidden="true" />
      {label}
    </span>
  );
}
