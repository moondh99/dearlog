import { useState } from 'react';
import { Link } from 'react-router-dom';
import { BookOpen, FileDown, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../store';
import { AUTOBIOGRAPHY_STYLE_LABELS, generateAllChaptersV2, toPDFReadyAutobiography } from '../lib/agents/ghostwriter';
import ChapterPreview from '../components/ChapterPreview';
import StatusNotice from '../components/StatusNotice';
import { canAccessV2, getEffectiveConsentSettings } from '../lib/consent/manager';
import { createChapterReviewComment } from '../lib/insights/memory-insights';
import { buildDemoAutobiography } from '../lib/demo/capstone-demo-data';
import type { Autobiography, AutobiographyStyle } from '../lib/types';

/**
 * AutobiographyPage allows users to generate a full autobiography from
 * available memories, preview chapters, and download as PDF.
 *
 * Validates: Requirements 3.1, 3.4, 5.4, 13.1
 */
export default function AutobiographyPage() {
  const memories = useStore((state) => state.memories);
  const speechProfile = useStore((state) => state.speechProfile.profile);
  const demo = useStore((state) => state.demo);
  const profile = useStore((state) => state.auth.profile);
  const photos = useStore((state) => state.photos.photos);

  const [autobiography, setAutobiography] = useState<Autobiography | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDownloadingPrint, setIsDownloadingPrint] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState<AutobiographyStyle>('memoir');
  const [commentDrafts, setCommentDrafts] = useState<Record<string, string>>({});
  const [chapterComments, setChapterComments] = useState<Record<string, ReturnType<typeof createChapterReviewComment>[]>>({});

  // Count non-private memories
  const nonPrivateMemories = memories.filter((m) =>
    m.privacy !== 'private' &&
    canAccessV2(m, getEffectiveConsentSettings(m), 'family', '출판')
  );
  const hasEnoughMemories = nonPrivateMemories.length >= 1;

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const chapters = await generateAllChaptersV2(memories, speechProfile, selectedStyle);
      const result = toPDFReadyAutobiography(chapters, '나의 이야기', selectedStyle);
      setAutobiography(result);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('자서전 생성 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!autobiography) return;
    setIsDownloading(true);
    setError(null);
    try {
      const { download } = await import('../lib/pdf/generator');
      await download(autobiography);
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('PDF 다운로드 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsDownloading(false);
    }
  };

  const handleLoadDemoAutobiography = () => {
    setAutobiography(buildDemoAutobiography());
    setError(null);
  };

  const handleDownloadPrintReadyPDF = async () => {
    if (!autobiography) return;
    setIsDownloadingPrint(true);
    setError(null);
    try {
      const { downloadPrintReady } = await import('../lib/pdf/generator');
      await downloadPrintReady(autobiography, {
        authorName: profile?.name ?? '김영자',
        subtitle: 'Dearlog 캡스톤 발표용 인쇄 자서전',
        familyReviewed: true,
        photos,
        closingMessage: '서로의 안부를 자주 묻고, 힘든 날에는 먼저 손을 내밀어 주세요.',
      });
    } catch (err) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('인쇄용 PDF 다운로드 중 알 수 없는 오류가 발생했습니다.');
      }
    } finally {
      setIsDownloadingPrint(false);
    }
  };

  const handleChapterEdit = (chapterId: string, newBody: string) => {
    if (!autobiography) return;
    setAutobiography({
      ...autobiography,
      chapters: autobiography.chapters.map((ch) =>
        ch.chapterId === chapterId ? { ...ch, body: newBody } : ch
      ),
    });
  };

  const handleAddComment = (chapterId: string) => {
    const body = commentDrafts[chapterId]?.trim();
    if (!body) return;
    const comment = createChapterReviewComment(chapterId, body);
    setChapterComments((prev) => ({
      ...prev,
      [chapterId]: [...(prev[chapterId] ?? []), comment],
    }));
    setCommentDrafts((prev) => ({ ...prev, [chapterId]: '' }));
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[13px] font-black uppercase tracking-[0.18em] text-primary">Print studio</p>
          <div className="mt-2 flex items-center gap-3">
            <BookOpen className="w-7 h-7 text-primary" aria-hidden="true" />
            <h1 className="text-[30px] font-black tracking-tight text-text">자서전</h1>
          </div>
        </div>
        <div className="rounded-full border border-border bg-surface px-4 py-2 text-[13px] font-black text-text-muted shadow-sm">
          공개 기억 {nonPrivateMemories.length}개 · 사진 {photos.length}장
        </div>
      </div>

      {/* Minimum memory notice */}
      {!hasEnoughMemories && (
        <div className="rounded-[28px] border border-primary/20 bg-primary-pale p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
            <div>
              <h2 className="text-[18px] font-black text-primary">공개 가능한 기억이 필요합니다</h2>
              <p className="mt-1 text-[15px] font-medium leading-relaxed text-primary">
                자서전을 생성하려면 최소 1개의 공개 기억이 필요합니다. 현재 {nonPrivateMemories.length}개의 기억이 있습니다.
              </p>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              to="/"
              className="inline-flex items-center justify-center rounded-2xl bg-primary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-colors hover:bg-primary-light"
            >
              기억 기록하기
            </Link>
            <Link
              to="/review"
              className="inline-flex items-center justify-center rounded-2xl border border-primary/30 bg-surface px-5 py-3 text-[15px] font-bold text-primary transition-colors hover:bg-white"
            >
              공개 범위 확인하기
            </Link>
          </div>
        </div>
      )}

      {!autobiography && (
        <section className="grid overflow-hidden rounded-[34px] border border-border bg-surface shadow-[0_22px_64px_rgba(41,35,33,0.1)] lg:grid-cols-[1fr_390px]">
          <div className="bg-[#2A2027] p-7 text-white sm:p-9">
            <p className="text-[12px] font-black uppercase tracking-[0.2em] text-white/45">A5 editorial proof</p>
            <h2 className="mt-4 max-w-xl text-[32px] font-black leading-tight tracking-tight">
              기억 카드를 한 권의 인쇄 자서전으로 편집합니다.
            </h2>
            <p className="mt-4 max-w-xl text-[16px] font-semibold leading-relaxed text-white/65">
              공개 가능한 기억, 가족 검수 코멘트, 사진 메타데이터를 묶어 표지와 목차가 있는 PDF 결과물을 만듭니다.
            </p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ['공개 기억', nonPrivateMemories.length],
                ['사진 자료', photos.length],
                ['PDF 형식', 'A5'],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-white/10 bg-white/8 p-4">
                  <p className="text-[12px] font-bold text-white/50">{label}</p>
                  <p className="mt-2 text-[26px] font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col justify-center gap-5 p-6 sm:p-8">
            <label className="flex flex-col gap-2 text-[14px] font-black text-text">
              자서전 문체
              <select
                value={selectedStyle}
                onChange={(event) => setSelectedStyle(event.target.value as AutobiographyStyle)}
                className="min-w-[220px] rounded-[20px] border border-border bg-surface-alt px-4 py-3 text-[16px] font-bold text-text outline-none focus:ring-2 focus:ring-primary/25"
              >
                {(Object.entries(AUTOBIOGRAPHY_STYLE_LABELS) as Array<[AutobiographyStyle, string]>).map(([style, label]) => (
                  <option key={style} value={style}>{label}</option>
                ))}
              </select>
            </label>
            {selectedStyle === 'news' && (
              <p className="text-[14px] font-semibold leading-relaxed text-text-muted">
                가족의 작은 사건도 기사처럼 제목, 리드문, 인용을 살려 구성합니다.
              </p>
            )}
            <button
              type="button"
              onClick={handleGenerate}
              disabled={!hasEnoughMemories || isGenerating}
              className="flex items-center justify-center gap-2.5 rounded-[20px] bg-primary px-8 py-4 text-[17px] font-black text-white shadow-[0_16px_34px_rgba(122,49,67,0.22)] transition-all hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="자서전 생성"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  생성 중...
                </>
              ) : (
                <>
                  <BookOpen className="w-5 h-5" aria-hidden="true" />
                  자서전 생성하기
                </>
              )}
            </button>
            {demo.enabled && (
              <button
                type="button"
                onClick={handleLoadDemoAutobiography}
                className="flex items-center justify-center gap-2.5 rounded-[20px] border border-primary/20 bg-primary-pale px-6 py-3 text-[16px] font-black text-primary transition-all hover:bg-primary/10 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <BookOpen className="w-5 h-5" aria-hidden="true" />
                사전 자서전 불러오기
              </button>
            )}
            {hasEnoughMemories && !isGenerating && (
              <p className="text-[14px] font-bold text-text-subtle">
                {nonPrivateMemories.length}개의 기억을 바탕으로 자서전을 생성합니다.
              </p>
            )}
          </div>
        </section>
      )}

      {/* Loading state */}
      {isGenerating && (
        <div className="flex flex-col items-center gap-3 py-14" aria-live="polite">
          <Loader2 className="w-10 h-10 text-primary animate-spin" aria-hidden="true" />
          <p className="text-[18px] text-text font-semibold">자서전을 생성하고 있습니다...</p>
          <p className="text-[14px] text-text-subtle">기억을 정리하고 서사를 작성하는 중입니다.</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <StatusNotice tone="error" title="작업을 완료하지 못했습니다" message={error} onDismiss={() => setError(null)} />
      )}

      {/* Autobiography content */}
      {autobiography && !isGenerating && (
        <div className="space-y-8">
          {/* Title + actions */}
          <div className="flex items-center justify-between flex-wrap gap-4 pb-6 border-b border-border">
            <h2 className="text-[22px] font-black text-text">{autobiography.title}</h2>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-semibold text-text-muted bg-surface-alt border border-border rounded-xl hover:bg-border/50 focus:outline-none transition-colors"
                aria-label="자서전 다시 생성"
              >
                <BookOpen className="w-4 h-4" aria-hidden="true" />
                다시 생성
              </button>
              <button
                type="button"
                onClick={handleDownloadPDF}
                disabled={isDownloading}
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-white bg-secondary rounded-xl hover:bg-secondary/90 focus:outline-none disabled:opacity-40 transition-colors shadow-sm"
                aria-label="PDF 다운로드"
              >
                {isDownloading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    다운로드 중...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" aria-hidden="true" />
                    PDF 다운로드
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadPrintReadyPDF}
                disabled={isDownloadingPrint}
                className="flex items-center gap-2 px-4 py-2.5 text-[14px] font-bold text-white bg-primary rounded-xl hover:bg-primary-light focus:outline-none disabled:opacity-40 transition-colors shadow-sm"
                aria-label="인쇄용 PDF 다운로드"
              >
                {isDownloadingPrint ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                    인쇄용 준비 중...
                  </>
                ) : (
                  <>
                    <FileDown className="w-4 h-4" aria-hidden="true" />
                    인쇄용 PDF
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Table of contents */}
          <div className="p-6 rounded-2xl bg-surface-alt border border-border">
            <h3 className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-4">목차</h3>
            <ol className="space-y-2" aria-label="챕터 목차">
              {autobiography.chapters.map((chapter, index) => (
                <li key={chapter.chapterId} className="flex items-center gap-3 text-[16px] text-text">
                  <span className="w-6 h-6 rounded-full bg-primary-pale text-primary text-[12px] font-black flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  {chapter.title}
                </li>
              ))}
            </ol>
          </div>

          {/* Chapters */}
          <div className="space-y-6" aria-label="챕터 미리보기">
            {autobiography.chapters.map((chapter) => (
              <div key={chapter.chapterId} className="space-y-3">
                <ChapterPreview
                  narrative={chapter}
                  onEdit={(newBody) => handleChapterEdit(chapter.chapterId, newBody)}
                />
                <div className="rounded-2xl bg-surface-alt border border-border p-4">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <h4 className="text-[14px] font-black text-text">가족 검수 코멘트</h4>
                    <span className="text-[12px] font-semibold text-text-subtle">
                      출처 {chapter.citations.length}개
                    </span>
                  </div>
                  {(chapterComments[chapter.chapterId] ?? []).length > 0 && (
                    <div className="space-y-2 mb-3">
                      {(chapterComments[chapter.chapterId] ?? []).map((comment) => (
                        <div key={comment.id} className="rounded-xl bg-surface border border-border px-3 py-2">
                          <p className="text-[13px] text-text-muted">{comment.body}</p>
                          <p className="text-[11px] text-text-subtle mt-1">
                            {new Date(comment.createdAt).toLocaleString('ko-KR')}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      value={commentDrafts[chapter.chapterId] ?? ''}
                      onChange={(e) =>
                        setCommentDrafts((prev) => ({
                          ...prev,
                          [chapter.chapterId]: e.target.value,
                        }))
                      }
                      placeholder="수정 요청이나 가족 확인 코멘트 입력"
                      className="flex-1 px-4 py-2.5 rounded-xl border border-border bg-surface text-[14px] text-text outline-none focus:ring-2 focus:ring-primary/25"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddComment(chapter.chapterId)}
                      className="px-4 py-2.5 rounded-xl bg-primary text-white text-[14px] font-bold hover:bg-primary-light transition-colors"
                    >
                      추가
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
