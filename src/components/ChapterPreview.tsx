import { useState, useCallback } from 'react';
import { BookOpen, Edit3, Check, X } from 'lucide-react';
import type { ChapterNarrative, Citation, Memory } from '../lib/types';
import SourceEvidencePanel from './SourceEvidencePanel';

export interface ChapterPreviewProps {
  key?: string | number;
  narrative: ChapterNarrative;
  sourceMemories?: Memory[];
  onEdit: (newBody: string) => void;
}

export default function ChapterPreview({ narrative, sourceMemories = [], onEdit }: ChapterPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(narrative.body);
  const [selectedSourceMemoryId, setSelectedSourceMemoryId] = useState<string | null>(null);
  const selectedSourceMemory = selectedSourceMemoryId
    ? sourceMemories.find((memory) => memory.id === selectedSourceMemoryId) ?? null
    : null;

  const handleStartEdit = () => {
    setEditText(narrative.body);
    setIsEditing(true);
  };

  const handleSaveEdit = () => {
    onEdit(editText);
    setIsEditing(false);
  };

  const handleCancelEdit = () => {
    setEditText(narrative.body);
    setIsEditing(false);
  };

  const renderBodyWithCitations = useCallback(() => {
    const sentences = narrative.body.split(/(?<=[.!?。])\s*/);
    const citationMap = new Map<number, Citation[]>();

    for (const citation of narrative.citations) {
      const existing = citationMap.get(citation.sentenceIndex) || [];
      existing.push(citation);
      citationMap.set(citation.sentenceIndex, existing);
    }

    return sentences.map((sentence, index) => {
      const citations = citationMap.get(index);
      return (
        <span key={index}>
          {sentence}
          {citations && citations.length > 0 && (
            <sup className="inline-flex gap-0.5 ml-0.5">
              {citations.map((c, i) => (
                <button
                  type="button"
                  key={`${c.memoryId}-${i}`}
                  onClick={() => setSelectedSourceMemoryId(c.memoryId)}
                  className="text-[11px] text-secondary font-semibold cursor-pointer rounded px-0.5 hover:bg-secondary-pale focus:outline-none focus:ring-1 focus:ring-secondary/30"
                  title={`출처: ${c.memoryId}`}
                  aria-label={`출처 기억 ${c.memoryId} 원문 확인`}
                >
                  [{c.memoryId.slice(-4)}]
                </button>
              ))}
            </sup>
          )}
          {index < sentences.length - 1 && ' '}
        </span>
      );
    });
  }, [narrative.body, narrative.citations]);

  return (
    <article
      className="premium-panel space-y-5 rounded-[28px] p-7"
      aria-label={`챕터: ${narrative.title}`}
    >
      {/* Chapter Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-[19px] font-black text-text">{narrative.title}</h2>
        </div>
        {!isEditing && (
          <button
            type="button"
            onClick={handleStartEdit}
            className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-white/78 px-3 py-1.5 text-[13px] font-semibold text-text-muted shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white focus:outline-none focus:ring-4 focus:ring-primary/10"
            aria-label="본문 편집"
          >
            <Edit3 className="w-3.5 h-3.5" aria-hidden="true" />
            편집
          </button>
        )}
      </header>

      {/* Chapter Body */}
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-[200px] w-full resize-y rounded-2xl border border-border/80 bg-white/78 p-5 text-[16px] leading-relaxed text-text shadow-sm transition-all duration-300 ease-out focus:border-primary/40 focus:outline-none focus:ring-4 focus:ring-primary/10"
            aria-label="챕터 본문 편집"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 rounded-xl border border-border/70 bg-white/78 px-4 py-2 text-[13px] font-semibold text-text-muted shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-white focus:outline-none"
              aria-label="편집 취소"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light focus:outline-none"
              aria-label="편집 저장"
            >
              <Check className="w-3.5 h-3.5" aria-hidden="true" />
              저장
            </button>
          </div>
          {narrative.citations.length > 0 && (
            <p className="text-[12px] text-text-subtle" aria-live="polite">
              출처 링크 {narrative.citations.length}개가 편집 후에도 유지됩니다.
            </p>
          )}
        </div>
      ) : (
        <div className="text-[16px] leading-[1.8] text-text-muted" aria-label="챕터 본문">
          {renderBodyWithCitations()}
        </div>
      )}

      {/* Citation Summary */}
      {!isEditing && narrative.citations.length > 0 && (
        <footer className="pt-4 border-t border-border">
          <details className="text-[13px] text-text-subtle">
            <summary className="cursor-pointer hover:text-text-muted focus:outline-none focus:ring-1 focus:ring-primary/30 rounded font-semibold">
              출처 ({narrative.citations.length}개 기억 참조)
            </summary>
            <ul className="mt-2 space-y-1 pl-4" aria-label="출처 목록">
              {[...new Set(narrative.citations.map((c) => c.memoryId))].map((memoryId) => (
                <li key={memoryId} className="text-[12px] text-text-subtle">
                  <button
                    type="button"
                    onClick={() => setSelectedSourceMemoryId(memoryId)}
                    className="rounded px-1 font-semibold text-secondary hover:bg-secondary-pale focus:outline-none focus:ring-1 focus:ring-secondary/30"
                  >
                    기억 ID: {memoryId}
                  </button>
                </li>
              ))}
            </ul>
          </details>
        </footer>
      )}

      {!isEditing && selectedSourceMemory && (
        <SourceEvidencePanel
          memory={selectedSourceMemory}
          label="자서전 문장 출처"
          onClose={() => setSelectedSourceMemoryId(null)}
        />
      )}
    </article>
  );
}
