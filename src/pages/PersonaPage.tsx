import { useState, useRef, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Archive, MessageCircle, Send, Loader2, Sparkles, GitFork } from 'lucide-react';
import { generatePersonaResponse } from '../lib/agents/persona';
import { buildGraphFromMemories } from '../lib/agents/persona';
import type { ChatMessage, EvidenceBadge, QuestionCategory } from '../lib/types';
import { useStore } from '../store';
import { cn } from '../components/Layout';
import SourceEvidencePanel from '../components/SourceEvidencePanel';

interface PersonaMessage extends ChatMessage {
  evidenceBadges?: EvidenceBadge[];
  linkedMemoryCards?: string[];
  questionCategory?: QuestionCategory;
}

export default function PersonaPage() {
  const memories = useStore(state => state.memories);
  const hasMemories = memories.length > 0;
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<PersonaMessage[]>([
    { role: 'model', text: '오냐, 왔니? 궁금한 게 있으면 뭐든 물어보렴.' }
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const [selectedEvidenceMemoryId, setSelectedEvidenceMemoryId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const memoryHighlights = memories.slice(0, 4);
  const selectedEvidenceMemory = selectedEvidenceMemoryId
    ? memories.find((memory) => memory.id === selectedEvidenceMemoryId) ?? null
    : null;

  const graphRelations = useMemo(() => {
    if (memories.length === 0) return [];
    const graph = buildGraphFromMemories(memories);
    return graph.getEdges().slice(0, 12);
  }, [memories]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: PersonaMessage = { role: 'user', text: input.trim() };
    const newHistory = [...messages, userMsg];
    
    setMessages(newHistory);
    setInput('');
    setIsTyping(true);

    const aiResponse = await generatePersonaResponse(userMsg.text, messages);
    
    // Parse out the citation badges if they exist e.g. [출처: 기억 ID]
    // We can just render them as text for now, but let's make them look like badges
    setMessages([
      ...newHistory,
      {
        role: 'model',
        text: aiResponse.text,
        evidenceBadges: aiResponse.evidenceBadges,
        linkedMemoryCards: aiResponse.linkedMemoryCards,
        questionCategory: aiResponse.questionCategory,
      },
    ]);
    setIsTyping(false);
  };

  const renderMessageText = (text: string) => {
    const parts = text.split(/(\[출처:\s*[^\]]+\])/g);
    return parts.map((part, i) => {
      if (part.startsWith('[출처:')) {
        const idMatch = part.match(/\[출처:\s*([^\]]+)\]/);
        const sourceId = idMatch ? idMatch[1].trim() : '';
        const memory = memories.find(m => m.id === sourceId);
        const displayLabel = memory ? memory.topic : sourceId;
        
        return (
          <span key={i} className="inline-flex items-center px-2.5 py-1 mx-1 rounded-lg bg-secondary-pale text-secondary text-[13px] font-semibold align-middle border border-secondary/25">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {displayLabel}
          </span>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  const renderEvidence = (msg: PersonaMessage) => {
    if (msg.role !== 'model' || !msg.questionCategory) return null;

    const badges = msg.evidenceBadges ?? [];

    return (
      <div className="mt-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-surface text-[12px] font-bold text-text-muted border border-border">
            {msg.questionCategory}
          </span>
          {badges.length === 0 && (
            <span className="text-[12px] font-semibold text-text-subtle">
              연결된 기억 없음
            </span>
          )}
        </div>
        {badges.length > 0 && (
          <div className="flex flex-col gap-1.5">
            {badges.slice(0, 3).map((badge) => {
              const memory = memories.find((m) => m.id === badge.memoryId);
              return (
                <div
                  key={badge.memoryId}
                  className="rounded-xl border border-secondary/20 bg-surface px-3 py-2 text-[12px] text-text-muted"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-black text-secondary">
                        {memory?.topic ?? badge.memoryId}
                      </span>
                      <span className="ml-2 font-semibold">
                        관련도 {Math.round(badge.relevanceScore * 100)}%
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedEvidenceMemoryId(badge.memoryId)}
                      className="rounded-lg border border-secondary/20 bg-surface px-2 py-1 text-[11px] font-black text-secondary transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary-pale"
                      aria-label={`${memory?.topic ?? badge.memoryId} 원문 근거 열기`}
                    >
                      원문 보기
                    </button>
                  </div>
                  <p className="mt-1 line-clamp-2">{badge.excerpt}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="grid min-h-full w-full gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
      <section className="premium-panel flex min-h-[620px] flex-col overflow-hidden rounded-[32px]">
        <div className="border-b border-primary-light/10 bg-primary px-7 py-6 text-primary-pale sm:px-9">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-light/30 ring-1 ring-primary-light/20">
              <MessageCircle className="h-5 w-5 text-primary-pale" aria-hidden="true" />
            </div>
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary-pale/60">Persona chat</p>
              <h2 className="mt-1 text-[24px] font-black tracking-tight">나의 분신과 대화하기</h2>
            </div>
          </div>
          <p className="mt-3 max-w-2xl text-[14px] font-semibold leading-relaxed text-primary-pale/80">
            저장된 기억을 근거로 답하고, 답변마다 출처 기억을 함께 보여줍니다.
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6 sm:px-8 sm:py-8 space-y-7">
          {!hasMemories && (
            <div className="rounded-[28px] border border-border/70 bg-surface p-8 text-center shadow-sm">
              <Sparkles className="mx-auto mb-3 h-9 w-9 text-secondary" aria-hidden="true" />
              <h3 className="text-[20px] font-black text-text">아직 근거로 삼을 기억이 없습니다</h3>
              <p className="mx-auto mt-2 max-w-md text-[15px] font-medium leading-relaxed text-text-muted">
                나의 분신은 저장된 추억을 근거로만 답합니다. 먼저 한 가지 기억을 기록해 주세요.
              </p>
              <Link
                to="/"
                className="mt-5 inline-flex items-center justify-center rounded-2xl bg-secondary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/90"
              >
                기억 기록하러 가기
              </Link>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={cn(
                "flex flex-col max-w-[88%] sm:max-w-[78%]",
                msg.role === 'user' ? "ml-auto items-end" : "mr-auto items-start"
              )}
            >
              <span className="text-[13px] text-text-subtle mb-1.5 px-1 font-semibold">
                {msg.role === 'user' ? '나' : '나의 분신'}
              </span>
              <div
                className={cn(
                  "px-5 py-4 leading-relaxed rounded-[22px]",
                  msg.role === 'user'
                    ? "bg-primary text-primary-pale text-[17px] font-semibold shadow-[0_12px_28px_rgba(92,52,32,0.15)]"
                    : "border border-border/70 bg-surface text-text text-[18px] font-bold shadow-sm"
                )}
              >
                {renderMessageText(msg.text)}
              </div>
              {renderEvidence(msg)}
            </div>
          ))}
          {isTyping && (
            <div className="mr-auto max-w-[82%]">
              <span className="text-[13px] text-text-subtle mb-1.5 px-1 font-semibold block">나의 분신</span>
              <div className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface px-6 py-5 shadow-sm">
                <Loader2 className="w-5 h-5 animate-spin text-text-muted" />
                <span className="text-[17px] text-text-muted font-semibold">분신이 대답을 생각하고 있어요...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {selectedEvidenceMemory && (
          <div className="shrink-0 border-t border-border/70 bg-surface/90 px-5 py-5 backdrop-blur sm:px-8">
            <SourceEvidencePanel
              memory={selectedEvidenceMemory}
              label="챗봇 답변 근거"
              onClose={() => setSelectedEvidenceMemoryId(null)}
            />
          </div>
        )}

        <div className="shrink-0 border-t border-border/70 bg-surface/90 px-5 py-5 backdrop-blur sm:px-8">
          <div className="relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              aria-label="분신에게 물어볼 내용"
              placeholder="어르신께 궁금한 점을 여쭤보세요..."
              disabled={!hasMemories}
              className="w-full rounded-[22px] border border-border/80 bg-surface px-5 py-4 pr-16 text-[17px] text-text shadow-sm outline-none transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-secondary/40 focus:bg-surface-alt focus:ring-4 focus:ring-secondary/10"
            />
            <button
              onClick={handleSend}
              disabled={!hasMemories || !input.trim() || isTyping}
              aria-label="분신에게 질문 보내기"
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-2xl bg-secondary p-3 text-white shadow-sm transition-all duration-300 ease-out hover:scale-[1.03] hover:bg-secondary/90 disabled:opacity-40"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <div className="premium-panel rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <Archive className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-[17px] font-black text-text">대화 근거</h3>
          </div>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-text-muted">
            분신은 아래 기억 카드를 우선 근거로 삼습니다.
          </p>
          <div className="mt-4 space-y-3">
            {memoryHighlights.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface-alt p-4 text-[13px] font-bold text-text-muted">
                아직 연결된 기억 카드가 없습니다.
              </p>
            ) : (
              memoryHighlights.map((memory) => (
                <div key={memory.id} className="rounded-2xl border border-border/70 bg-surface-alt p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5">
                  <p className="text-[14px] font-black text-text">{memory.topic}</p>
                  <p className="mt-1 line-clamp-2 text-[12px] font-semibold leading-relaxed text-text-muted">
                    {memory.publishVersion}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="premium-panel-soft rounded-[28px] p-5">
          <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">추천 질문</p>
          <div className="mt-3 space-y-2">
            {['처음 서울에 올라왔을 때 이야기를 들려주세요', '가족에게 꼭 남기고 싶은 말씀이 있으신가요?'].map((question) => (
              <button
                key={question}
                type="button"
                onClick={() => setInput(question)}
                disabled={!hasMemories}
                className="w-full rounded-2xl border border-border/70 bg-surface px-4 py-3 text-left text-[13px] font-black leading-relaxed text-primary shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-surface-alt disabled:opacity-45"
              >
                {question}
              </button>
            ))}
          </div>
        </div>

        <div className="premium-panel rounded-[28px] p-5">
          <div className="flex items-center gap-2">
            <GitFork className="h-5 w-5 text-secondary" aria-hidden="true" />
            <h3 className="text-[17px] font-black text-text">관계망</h3>
          </div>
          <p className="mt-2 text-[13px] font-semibold leading-relaxed text-text-muted">
            기억에서 추출된 인물·장소 관계입니다.
          </p>
          <div className="mt-4 space-y-2">
            {graphRelations.length === 0 ? (
              <p className="rounded-2xl border border-border bg-surface-alt p-4 text-[13px] font-bold text-text-muted">
                아직 관계 데이터가 없습니다.
              </p>
            ) : (
              graphRelations.map((edge, idx) => (
                <div key={idx} className="flex items-center gap-2 rounded-2xl border border-border/70 bg-surface-alt px-4 py-3 shadow-sm">
                  <span className="text-[13px] font-black text-primary">{edge.source}</span>
                  <span className="rounded-lg bg-secondary-pale px-2 py-0.5 text-[11px] font-bold text-secondary">{edge.type}</span>
                  <span className="text-[13px] font-black text-primary">{edge.target}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
