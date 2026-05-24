import { FileText, Mic2, X } from 'lucide-react';
import type { Memory } from '../lib/types';

interface SourceEvidencePanelProps {
  memory: Memory;
  label?: string;
  onClose?: () => void;
}

export default function SourceEvidencePanel({
  memory,
  label = '근거 기억 확인',
  onClose,
}: SourceEvidencePanelProps) {
  return (
    <section
      className="rounded-[24px] border border-border/70 bg-white/76 p-5 shadow-sm backdrop-blur"
      aria-label={`${memory.topic} ${label}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-secondary-pale text-secondary">
            <FileText className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <p className="text-[12px] font-black uppercase tracking-wide text-secondary">{label}</p>
            <h3 className="mt-1 text-[17px] font-black text-text">{memory.topic}</h3>
            <p className="mt-1 text-[12px] font-semibold text-text-subtle">
              기억 ID {memory.id} · {memory.confidenceLabel}
            </p>
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border/70 bg-white/80 p-2 text-text-subtle shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:text-text"
            aria-label="근거 닫기"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>

      <div className="mt-4 rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
        <div className="flex items-center gap-2">
          <Mic2 className="h-4 w-4 text-primary" aria-hidden="true" />
          <p className="text-[13px] font-black text-text">음성 조각</p>
          <span className="rounded-full bg-primary-pale px-2 py-0.5 text-[11px] font-black text-primary">
            데모
          </span>
        </div>
        <div className="mt-3 flex h-10 items-center gap-1" aria-hidden="true">
          {[18, 28, 14, 34, 22, 30, 16, 26, 12, 24, 18, 32].map((height, index) => (
            <span
              key={`${memory.id}-wave-${index}`}
              className="w-1.5 rounded-full bg-primary/45"
              style={{ height }}
            />
          ))}
        </div>
        <p className="mt-2 text-[12px] font-semibold leading-relaxed text-text-subtle">
          실제 음성 파일이 연결되면 이 구간에서 원본 목소리를 재생해 AI 정리본과 대조합니다.
        </p>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
          <p className="text-[12px] font-black text-text-subtle">STT 원문</p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-text-muted">
            {memory.originalTranscript || '원문이 아직 연결되지 않았습니다.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
          <p className="text-[12px] font-black text-text-subtle">AI 정리본</p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-text-muted">
            {memory.cleanedTranscript || '정리본이 아직 생성되지 않았습니다.'}
          </p>
        </div>
        <div className="rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
          <p className="text-[12px] font-black text-text-subtle">가족 검수본</p>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-text-muted">
            {memory.publishVersion || '가족 검수본이 아직 없습니다.'}
          </p>
        </div>
      </div>
    </section>
  );
}
