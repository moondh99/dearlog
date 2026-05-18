import { useState, useCallback } from 'react';
import { BookOpen, Edit3, Check, X } from 'lucide-react';
import type { ChapterNarrative, Citation } from '../lib/types';

export interface ChapterPreviewProps {
  key?: string | number;
  narrative: ChapterNarrative;
  onEdit: (newBody: string) => void;
}

export default function ChapterPreview({ narrative, onEdit }: ChapterPreviewProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(narrative.body);

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
                <span
                  key={`${c.memoryId}-${i}`}
                  className="text-[11px] text-secondary font-semibold cursor-help"
                  title={`출처: ${c.memoryId}`}
                  aria-label={`출처 기억 ${c.memoryId}`}
                >
                  [{c.memoryId.slice(-4)}]
                </span>
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
      className="space-y-5 p-7 rounded-[28px] border border-border bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.06)]"
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
            className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-text-muted bg-surface-alt border border-border rounded-xl hover:bg-border/40 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary/30 transition-colors"
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
            className="w-full min-h-[200px] p-5 text-[16px] leading-relaxed text-text border border-border rounded-2xl resize-y focus:outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary transition-all"
            aria-label="챕터 본문 편집"
          />
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={handleCancelEdit}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-text-muted bg-surface-alt border border-border rounded-xl hover:bg-border/40 focus:outline-none transition-colors"
              aria-label="편집 취소"
            >
              <X className="w-3.5 h-3.5" aria-hidden="true" />
              취소
            </button>
            <button
              type="button"
              onClick={handleSaveEdit}
              className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-primary rounded-xl hover:bg-primary-light focus:outline-none transition-colors shadow-sm"
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
                  기억 ID: {memoryId}
                </li>
              ))}
            </ul>
          </details>
        </footer>
      )}
    </article>
  );
}
