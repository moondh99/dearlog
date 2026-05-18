import { useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { Lock, Users, Globe, Save, MessageSquarePlus } from 'lucide-react';
import { useStore, PrivacyLevel } from '../store';
import { cn } from '../components/Layout';
import ConsentControls from '../components/ConsentControls';
import { submitQuestion } from '../lib/agents/family-question-queue';
import { getEffectiveConsentSettings } from '../lib/consent/manager';
import { getFamilyQuestionStats } from '../lib/insights/memory-insights';
import type { MemoryConsent, PriorityTag } from '../lib/types';

export default function ReviewPage() {
  const {
    memories,
    familyQuestions,
    updateMemoryPrivacy,
    updateMemoryPublishVersion,
    updateMemoryConsent,
    updateMemoryConsentSettings,
  } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionPriority, setQuestionPriority] = useState<PriorityTag>('normal');
  const [anonymous, setAnonymous] = useState(false);
  const questionStats = getFamilyQuestionStats(familyQuestions.questions);

  const handleEditStart = (id: string, currentContent: string) => {
    setEditingId(id);
    setEditContent(currentContent);
  };

  const handleEditSave = (id: string) => {
    updateMemoryPublishVersion(id, editContent);
    setEditingId(null);
  };

  const handleSubmitQuestion = () => {
    if (!questionText.trim()) return;
    submitQuestion(questionText.trim(), 'family-user', anonymous, questionPriority);
    setQuestionText('');
    setQuestionPriority('normal');
    setAnonymous(false);
  };

  const PrivacyIcon = ({ level }: { level: PrivacyLevel }) => {
    switch (level) {
      case 'private': return <Lock className="w-4 h-4" />;
      case 'family': return <Users className="w-4 h-4" />;
      case 'public': return <Globe className="w-4 h-4" />;
    }
  };

  if (memories.length === 0) {
    return (
      <div className="mx-auto flex h-full max-w-3xl flex-col items-center justify-center p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-primary-pale text-primary">
          <Users className="h-10 w-10" />
        </div>
        <p className="mt-6 text-[12px] font-black uppercase tracking-[0.18em] text-primary">Family review</p>
        <h2 className="mt-2 text-[28px] font-black text-text">검토할 기억이 없습니다.</h2>
        <p className="mt-3 max-w-md text-[17px] font-medium leading-relaxed text-text-muted">
          먼저 회상 인터뷰를 저장하면 가족 질문, 공개 범위, 동의 설정을 이곳에서 함께 확인할 수 있습니다.
        </p>
        <Link
          to="/"
          className="mt-7 inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3.5 text-[16px] font-black text-white shadow-[0_16px_34px_rgba(122,49,67,0.22)] transition-colors hover:bg-primary-light"
        >
          기억 기록하러 가기
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="overflow-hidden rounded-[32px] border border-border bg-surface shadow-[0_22px_60px_rgba(41,35,33,0.1)]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-[#2A2027] p-6 text-white sm:p-8">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-white/50">Family review</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight sm:text-[36px]">가족 공간</h1>
            <p className="mt-3 max-w-2xl text-[16px] font-semibold leading-relaxed text-white/65">
              가족 질문을 등록하고, 기록된 이야기를 출판 가능한 문장으로 검수하며 공개 범위를 조정합니다.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['기억', memories.length],
                ['질문', questionStats.total],
                ['대기', questionStats.pending],
                ['답변율', `${Math.round(questionStats.answerRate * 100)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-white/10 bg-white/8 px-4 py-3">
                  <p className="text-[11px] font-black text-white/45">{label}</p>
                  <p className="mt-1 text-[24px] font-black text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 bg-primary-pale p-6 sm:p-8">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">동의 기반 공개</p>
              <h2 className="mt-2 text-[22px] font-black text-text">가족에게 보여주기 전에 한 번 더 확인합니다</h2>
              <p className="mt-3 text-[15px] font-bold leading-relaxed text-primary">
                사적 기억, 가족 공개, 전체 공개를 기억별로 분리해 심사위원에게 개인정보 보호 흐름을 보여줄 수 있습니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['나만', memories.filter((memory) => memory.privacy === 'private').length],
                ['가족', memories.filter((memory) => memory.privacy === 'family').length],
                ['공개', memories.filter((memory) => memory.privacy === 'public').length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface px-3 py-3 text-center shadow-sm">
                  <p className="text-[11px] font-black text-text-subtle">{label}</p>
                  <p className="mt-1 text-[20px] font-black text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-surface rounded-[30px] shadow-[0_18px_52px_rgba(41,35,33,0.08)] border border-border overflow-hidden">
        <div className="bg-surface-alt px-6 py-5 border-b border-border flex items-center gap-3 sm:px-8">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-pale text-secondary">
            <MessageSquarePlus className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-[19px] font-black text-text">어르신께 여쭤볼 질문</h3>
            <p className="text-[14px] text-text-muted font-medium mt-0.5">
              등록된 질문은 인터뷰 흐름이 자연스러울 때 대화에 이어집니다.
            </p>
          </div>
        </div>

        <div className="p-5 grid grid-cols-1 gap-5 sm:p-7 lg:grid-cols-[1fr_300px]">
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                ['전체', questionStats.total],
                ['대기', questionStats.pending],
                ['답변', questionStats.archived],
                ['답변율', `${Math.round(questionStats.answerRate * 100)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl bg-surface-alt border border-border px-4 py-3">
                  <p className="text-[11px] font-bold text-text-subtle uppercase tracking-wide">{label}</p>
                  <p className="text-[20px] font-black text-text">{value}</p>
                </div>
              ))}
            </div>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              aria-label="가족 질문 내용"
              placeholder="예: 할머니가 처음 서울에 올라오셨을 때 어떤 마음이셨나요?"
              className="w-full h-24 p-4 rounded-2xl border border-border bg-surface-alt text-[16px] text-text resize-none focus:ring-2 focus:ring-secondary/25 focus:border-secondary outline-none leading-relaxed"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={questionPriority}
                onChange={(e) => setQuestionPriority(e.target.value as PriorityTag)}
                aria-label="질문 우선순위"
                className="px-4 py-2.5 rounded-xl border border-border bg-surface-alt text-[14px] font-semibold text-text-muted outline-none"
              >
                <option value="high">높은 우선순위</option>
                <option value="normal">보통 우선순위</option>
                <option value="low">낮은 우선순위</option>
              </select>
              <label className="flex items-center gap-2 text-[14px] font-semibold text-text-muted">
                <input
                  type="checkbox"
                  checked={anonymous}
                  onChange={(e) => setAnonymous(e.target.checked)}
                  className="w-4 h-4 text-secondary focus:ring-secondary/30"
                />
                익명 질문
              </label>
              <button
                type="button"
                onClick={handleSubmitQuestion}
                disabled={!questionText.trim()}
                className="ml-auto px-5 py-2.5 rounded-2xl bg-secondary text-white text-[14px] font-black disabled:opacity-40 hover:bg-secondary/90 transition-colors shadow-sm"
              >
                질문 등록
              </button>
            </div>
          </div>

          <div className="rounded-[24px] bg-surface-alt border border-border p-4">
            <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-3">질문 대기열</p>
            {familyQuestions.questions.length === 0 ? (
              <p className="text-[14px] text-text-subtle">아직 등록된 질문이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {familyQuestions.questions.slice(0, 6).map((question) => (
                  <div key={question.id} className="rounded-xl bg-surface border border-border px-3 py-2">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-[12px] font-black text-secondary">
                        {question.priority === 'high' ? '높음' : question.priority === 'normal' ? '보통' : '낮음'}
                      </span>
                      <span className="text-[11px] font-semibold text-text-subtle">
                        {question.status === 'pending'
                          ? '대기'
                          : question.status === 'delivered'
                            ? '전달됨'
                            : question.status === 'answered'
                              ? '답변됨'
                              : '보관됨'}
                      </span>
                    </div>
                    <p className="text-[13px] text-text-muted line-clamp-2">{question.questionText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <div className="space-y-8">
        {memories.map((memory) => (
          <div key={memory.id} className="bg-surface rounded-[30px] shadow-[0_18px_52px_rgba(41,35,33,0.08)] border border-border overflow-hidden">
            <div className="bg-surface-alt px-6 py-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:px-8">
              <div>
                <h3 className="text-[22px] font-black text-text mb-1">{memory.topic}</h3>
                <span className="text-[14px] font-medium text-text-muted">
                  {format(new Date(memory.date), 'yyyy년 M월 d일', { locale: ko })}
                </span>
              </div>
              
              <div className="flex items-center gap-1 bg-surface p-1.5 rounded-2xl border border-border">
                {(['private', 'family', 'public'] as PrivacyLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => updateMemoryPrivacy(memory.id, level)}
                    aria-label={`${memory.topic} 공개 범위 ${level === 'private' ? '나만 보기' : level === 'family' ? '가족 공개' : '전체 공개'}로 변경`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[15px] font-semibold transition-all",
                      memory.privacy === level
                        ? "bg-primary text-white shadow-sm"
                        : "text-text-muted hover:bg-border/40"
                    )}
                  >
                    <PrivacyIcon level={level} />
                    <span>
                      {level === 'private' ? '나만 보기' : level === 'family' ? '가족 공개' : '전체 공개'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-border">
              {/* Column 1: Original */}
              <div className="p-7 bg-surface-alt">
                <h4 className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-3">원본 녹취록</h4>
                <p className="text-[16px] text-text-muted whitespace-pre-wrap leading-relaxed italic">
                  "{memory.originalTranscript}"
                </p>
              </div>

              {/* Column 2: Cleaned */}
              <div className="p-7 bg-surface">
                <h4 className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-3">AI 교정본</h4>
                <p className="text-[16px] text-text whitespace-pre-wrap leading-relaxed font-medium">
                  {memory.cleanedTranscript}
                </p>
              </div>

              {/* Column 3: Publish Version */}
              <div className="p-7 bg-primary-pale/40">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[12px] font-bold text-primary/70 uppercase tracking-wide">최종 발행본</h4>
                  {editingId !== memory.id ? (
                    <button
                      onClick={() => handleEditStart(memory.id, memory.publishVersion)}
                      className="text-[14px] text-primary hover:text-primary-light font-semibold underline underline-offset-4"
                    >
                      수정하기
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditSave(memory.id)}
                      className="flex items-center gap-1.5 text-[14px] font-bold bg-primary text-white px-3 py-1.5 rounded-xl hover:bg-primary-light transition-colors shadow-sm"
                    >
                      <Save className="w-4 h-4" />
                      <span>저장</span>
                    </button>
                  )}
                </div>

                {editingId === memory.id ? (
                  <textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    className="w-full h-44 p-4 rounded-2xl border border-primary/30 bg-surface text-[16px] font-medium text-text resize-none focus:ring-2 focus:ring-primary/25 focus:border-primary outline-none leading-relaxed transition-all"
                  />
                ) : (
                  <p className="text-[16px] text-text whitespace-pre-wrap leading-relaxed font-semibold">
                    {memory.publishVersion}
                  </p>
                )}
              </div>
            </div>

            {/* Consent Controls */}
            <div className="px-8 py-6 border-t border-border">
              <ConsentControls
                memoryId={memory.id}
                consent={memory.consent}
                consentSettings={getEffectiveConsentSettings(memory)}
                onConsentChange={(consent: MemoryConsent) => updateMemoryConsent(memory.id, consent)}
                onConsentSettingsChange={(settings) => updateMemoryConsentSettings(memory.id, settings)}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
