import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, AlertTriangle, CalendarDays, PlayCircle, Database, Loader2, CheckCircle2, Circle, ClipboardList, FileText, Printer, MessageSquareQuote, Quote } from 'lucide-react';
import { useStore } from '../store';
import { processUpcomingEvents, SUPPORTED_EVENT_TYPES } from '../lib/agents/calendar-trigger';
import { ragIndex } from '../lib/rag/index';
import StatusNotice, { type StatusNoticeTone } from '../components/StatusNotice';
import {
  CAPSTONE_SUBMISSION_SECTIONS,
  DEMO_PERSONA_QUESTIONS,
  DEMO_PRESENTATION_SCRIPT,
  DEMO_SCENARIO_STEPS,
  JUDGE_QA,
  PITCH_COPY,
  PRINT_READY_CHECKLIST,
} from '../lib/demo/capstone-presentation';
import type { CalendarEvent, CalendarEventType, CalendarTriggerResult, PosthumousPolicy } from '../lib/types';

/**
 * SettingsPage provides posthumous policy configuration with a double-confirm
 * UI pattern. Users can choose between full release, maintain current, or
 * delete all data.
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4
 */

interface PolicyOption {
  value: PosthumousPolicy;
  label: string;
  description: string;
}

type SettingsPanel = 'policy' | 'index' | 'calendar' | 'demo';

const POLICY_OPTIONS: PolicyOption[] = [
  {
    value: 'full_release',
    label: '전체 공개',
    description: '모든 기억을 가족에게 공개합니다',
  },
  {
    value: 'maintain_current',
    label: '현재 설정 유지',
    description: '현재 각 기억의 권한 설정을 유지합니다',
  },
  {
    value: 'delete_all',
    label: '전체 삭제',
    description: '모든 기억을 삭제합니다',
  },
];

function getPolicyLabel(policy: PosthumousPolicy): string {
  const option = POLICY_OPTIONS.find((o) => o.value === policy);
  return option?.label ?? '현재 설정 유지';
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const posthumousPolicy = useStore((state) => state.posthumousPolicy);
  const setPosthumousPolicy = useStore((state) => state.setPosthumousPolicy);
  const signOut = useStore((state) => state.signOut);
  const demo = useStore((state) => state.demo);
  const seedDemoData = useStore((state) => state.seedDemoData);
  const clearDemoData = useStore((state) => state.clearDemoData);
  const setDemoOfflineMode = useStore((state) => state.setDemoOfflineMode);
  const calendar = useStore((state) => state.calendar);
  const addCalendarEvent = useStore((state) => state.addCalendarEvent);
  const memories = useStore((state) => state.memories);
  const ragEntries = useStore((state) => state.ragIndex.entries);
  const photos = useStore((state) => state.photos.photos);
  const familyQuestions = useStore((state) => state.familyQuestions.questions);
  const autobiographyChapters = useStore((state) => state.autobiography.narratives);
  const updateMemoryEmbedding = useStore((state) => state.updateMemoryEmbedding);

  const [selectedPolicy, setSelectedPolicy] = useState<PosthumousPolicy>(
    posthumousPolicy.policy
  );
  const [showConfirm, setShowConfirm] = useState(false);
  const [saved, setSaved] = useState(false);
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<CalendarEventType>('생일');
  const [eventDate, setEventDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [eventPeople, setEventPeople] = useState('');
  const [eventDescription, setEventDescription] = useState('');
  const [calendarResults, setCalendarResults] = useState<CalendarTriggerResult[]>([]);
  const [isProcessingCalendar, setIsProcessingCalendar] = useState(false);
  const [isIndexing, setIsIndexing] = useState(false);
  const [indexNotice, setIndexNotice] = useState<{ tone: StatusNoticeTone; title: string; message?: string } | null>(null);
  const [calendarNotice, setCalendarNotice] = useState<{ tone: StatusNoticeTone; title: string; message?: string } | null>(null);
  const [activePanel, setActivePanel] = useState<SettingsPanel>('policy');

  const handleSignOut = () => {
    signOut();
    navigate('/auth', { replace: true });
  };

  const handleSave = () => {
    setShowConfirm(true);
    setSaved(false);
  };

  const handleConfirm = () => {
    setPosthumousPolicy(selectedPolicy);
    setShowConfirm(false);
    setSaved(true);
    // Clear saved message after 3 seconds
    setTimeout(() => setSaved(false), 3000);
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  const handleAddEvent = () => {
    if (!eventTitle.trim() || !eventDate) return;

    const event: CalendarEvent = {
      id: `event_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      title: eventTitle.trim(),
      eventType,
      date: eventDate,
      relatedPeople: eventPeople
        .split(',')
        .map((person) => person.trim())
        .filter(Boolean),
      description: eventDescription.trim(),
    };

    addCalendarEvent(event);
    setEventTitle('');
    setEventPeople('');
    setEventDescription('');
    setCalendarNotice({
      tone: 'success',
      title: '가족 일정을 등록했습니다',
      message: `${event.title} 일정이 가족 일정 알림 목록에 추가되었습니다.`,
    });
  };

  const handleProcessCalendar = async () => {
    setIsProcessingCalendar(true);
    setCalendarNotice(null);
    try {
      const results = await processUpcomingEvents(calendar.events);
      setCalendarResults(results);
      setCalendarNotice({
        tone: 'info',
        title: '일정 처리를 완료했습니다',
        message: results.length === 0 ? '오늘 확인할 다가오는 일정이 없습니다.' : `${results.length}개의 일정 알림 결과를 만들었습니다.`,
      });
    } catch {
      setCalendarNotice({
        tone: 'error',
        title: '일정 처리에 실패했습니다',
        message: '잠시 후 다시 시도해 주세요. 등록된 일정은 유지됩니다.',
      });
    } finally {
      setIsProcessingCalendar(false);
    }
  };

  const handleBackfillRAG = async () => {
    setIsIndexing(true);
    setIndexNotice(null);
    let indexedCount = 0;

    try {
      for (const memory of memories) {
        const hasEntry = useStore
          .getState()
          .ragIndex.entries.some((entry) => entry.memoryId === memory.id);
        if (hasEntry) continue;

        await ragIndex.addMemory(memory.id, memory.cleanedTranscript, memory.tags);
        const entry = useStore
          .getState()
          .ragIndex.entries.find((item) => item.memoryId === memory.id);
        if (entry) {
          updateMemoryEmbedding(memory.id, entry.embedding);
        }
        indexedCount += 1;
      }

      setIndexNotice({
        tone: 'success',
        title: indexedCount === 0
          ? '기억 검색 연결이 이미 최신 상태입니다'
          : '기억 검색 연결을 완료했습니다',
        message: indexedCount === 0
          ? '모든 기억이 이미 나의 분신과 가족 일정 알림에서 찾을 수 있는 상태입니다.'
          : `${indexedCount}개의 기억을 나의 분신과 가족 일정 알림에서 찾을 수 있게 연결했습니다.`,
      });
    } catch (error) {
      console.error('RAG backfill failed:', error);
      setIndexNotice({
        tone: 'error',
        title: '기억 검색 연결에 실패했습니다',
        message: '네트워크 또는 API 설정을 확인한 뒤 다시 시도해 주세요.',
      });
    } finally {
      setIsIndexing(false);
    }
  };

  const hasChanges = selectedPolicy !== posthumousPolicy.policy;
  const demoReadinessChecks = [
    { label: '발표용 데이터', ready: demo.enabled },
    { label: '오프라인 시연', ready: demo.offlineMode },
    { label: '기억 카드 6개 이상', ready: memories.length >= 6 },
    { label: '사진 4장 이상', ready: photos.length >= 4 },
    { label: '가족 질문 3개 이상', ready: familyQuestions.length >= 3 },
    { label: '자서전 챕터 6개 이상', ready: autobiographyChapters.length >= 6 },
    { label: '검색 연결 6개 이상', ready: ragEntries.length >= 6 },
  ];
  const demoReadyCount = demoReadinessChecks.filter((check) => check.ready).length;
  const isDemoReady = demoReadinessChecks.every((check) => check.ready);
  const panels: Array<{ id: SettingsPanel; label: string; count?: number }> = [
    { id: 'policy', label: '사후 정책' },
    { id: 'index', label: '기억 검색 연결', count: ragEntries.length },
    { id: 'calendar', label: '가족 일정', count: calendar.events.length },
    { id: 'demo', label: '발표 데모', count: demo.enabled ? 1 : 0 },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <Settings className="w-7 h-7 text-primary" aria-hidden="true" />
        <h1 className="text-[26px] font-black text-text">설정</h1>
        <button
          type="button"
          onClick={handleSignOut}
          className="ml-auto rounded-xl border border-border bg-surface px-4 py-2 text-[14px] font-bold text-text-muted transition-colors hover:bg-surface-alt"
        >
          로그아웃
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="설정 영역">
        {panels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            role="tab"
            aria-selected={activePanel === panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={`shrink-0 px-4 py-2 rounded-xl text-[14px] font-bold border transition-colors ${
              activePanel === panel.id
                ? 'bg-primary text-white border-primary'
                : 'bg-surface border-border text-text-muted hover:bg-surface-alt'
            }`}
          >
            {panel.label}
            {typeof panel.count === 'number' && <span className="ml-2 opacity-75">{panel.count}</span>}
          </button>
        ))}
      </div>

      {/* Posthumous Policy Section */}
      {activePanel === 'policy' && <section
        className="p-7 rounded-[28px] bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-6"
        aria-labelledby="posthumous-policy-heading"
      >
        <div className="flex items-center gap-3">
          <Shield className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 id="posthumous-policy-heading" className="text-[19px] font-black text-text">
            사후 이용 정책
          </h2>
        </div>

        <p className="text-[15px] text-text-muted leading-relaxed">
          사후에 기억 데이터를 어떻게 처리할지 설정합니다. 이 설정은 언제든지 변경할 수 있습니다.
        </p>

        {/* Current policy status */}
        <div className="p-4 rounded-2xl bg-surface-alt border border-border">
          <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-1">현재 정책</p>
          <p className="text-[16px] font-bold text-text">
            {getPolicyLabel(posthumousPolicy.policy)}
          </p>
          {posthumousPolicy.confirmedAt && (
            <p className="text-[12px] text-text-subtle mt-1">
              마지막 확인:{' '}
              {new Date(posthumousPolicy.confirmedAt).toLocaleDateString('ko-KR', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          )}
        </div>

        {/* Policy options */}
        <fieldset>
          <legend className="text-[13px] font-bold text-text-muted mb-3">정책 선택</legend>
          <div className="space-y-2.5" role="radiogroup" aria-label="사후 이용 정책 선택">
            {POLICY_OPTIONS.map((option) => (
              <label
                key={option.value}
                className={`flex items-start gap-3 p-4 rounded-2xl border-2 cursor-pointer transition-all ${
                  selectedPolicy === option.value
                    ? 'border-primary bg-primary-pale/60 shadow-sm'
                    : 'border-border bg-surface hover:border-border-strong'
                }`}
              >
                <input
                  type="radio"
                  name="posthumous-policy"
                  value={option.value}
                  checked={selectedPolicy === option.value}
                  onChange={() => {
                    setSelectedPolicy(option.value);
                    setSaved(false);
                  }}
                  className="mt-0.5 w-4 h-4 text-primary focus:ring-primary/30"
                  aria-describedby={`policy-desc-${option.value}`}
                />
                <div>
                  <span className="text-[16px] font-bold text-text">{option.label}</span>
                  <p
                    id={`policy-desc-${option.value}`}
                    className="text-[14px] text-text-muted mt-0.5"
                  >
                    {option.description}
                  </p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Save button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!hasChanges}
            className="px-6 py-3 text-[15px] font-bold text-white bg-primary rounded-2xl hover:bg-primary-light focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary/40 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            aria-label="정책 저장"
          >
            저장
          </button>
        </div>
        {saved && (
          <StatusNotice tone="success" title="사후 이용 정책을 저장했습니다" />
        )}
      </section>}

      {activePanel === 'index' && <section className="p-7 rounded-[28px] bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-6">
        <div className="flex items-center gap-3">
          <Database className="w-5 h-5 text-secondary" aria-hidden="true" />
          <h2 className="text-[19px] font-black text-text">기억 검색 연결</h2>
        </div>
        <p className="text-[15px] text-text-muted leading-relaxed">
          저장된 기억을 나의 분신, 검증 화면, 가족 일정 알림에서 찾을 수 있도록 연결합니다.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleBackfillRAG}
            disabled={isIndexing || memories.length === 0}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-secondary text-white text-[15px] font-bold disabled:opacity-40 hover:bg-secondary/90 transition-colors shadow-sm"
          >
            {isIndexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
            기억 검색 연결하기
          </button>
          <span className="text-[13px] font-semibold text-text-subtle">
            기억 {memories.length}개 / 검색 연결 {ragEntries.length}개
          </span>
        </div>
        {indexNotice && (
          <StatusNotice
            tone={indexNotice.tone}
            title={indexNotice.title}
            message={indexNotice.message}
            onDismiss={() => setIndexNotice(null)}
          />
        )}
      </section>}

      {activePanel === 'calendar' && <section className="p-7 rounded-[28px] bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-6">
        <div className="flex items-center gap-3">
          <CalendarDays className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-[19px] font-black text-text">가족 일정 알림</h2>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <input
            value={eventTitle}
            onChange={(e) => setEventTitle(e.target.value)}
            aria-label="일정 제목"
            placeholder="일정 제목"
            className="w-full px-4 py-3 rounded-2xl border border-border bg-surface-alt text-[15px] text-text outline-none focus:ring-2 focus:ring-primary/25"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEventType)}
              aria-label="일정 유형"
              className="px-4 py-3 rounded-2xl border border-border bg-surface-alt text-[15px] text-text outline-none"
            >
              {SUPPORTED_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            <input
              type="date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              aria-label="일정 날짜"
              className="px-4 py-3 rounded-2xl border border-border bg-surface-alt text-[15px] text-text outline-none"
            />
          </div>
          <input
            value={eventPeople}
            onChange={(e) => setEventPeople(e.target.value)}
            aria-label="관련 인물"
            placeholder="관련 인물, 쉼표로 구분"
            className="w-full px-4 py-3 rounded-2xl border border-border bg-surface-alt text-[15px] text-text outline-none focus:ring-2 focus:ring-primary/25"
          />
          <textarea
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            aria-label="일정 설명"
            placeholder="일정 설명"
            className="w-full h-24 p-4 rounded-2xl border border-border bg-surface-alt text-[15px] text-text resize-none outline-none focus:ring-2 focus:ring-primary/25"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAddEvent}
              disabled={!eventTitle.trim() || !eventDate}
              className="px-5 py-3 rounded-2xl bg-primary text-white text-[15px] font-bold disabled:opacity-40 hover:bg-primary-light transition-colors shadow-sm"
            >
              일정 등록
            </button>
            <button
              type="button"
              onClick={handleProcessCalendar}
              disabled={isProcessingCalendar || calendar.events.length === 0}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-secondary text-white text-[15px] font-bold disabled:opacity-40 hover:bg-secondary/90 transition-colors shadow-sm"
            >
              {isProcessingCalendar ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
              다가오는 일정 확인
            </button>
          </div>
        </div>

        {calendarNotice && (
          <StatusNotice
            tone={calendarNotice.tone}
            title={calendarNotice.title}
            message={calendarNotice.message}
            onDismiss={() => setCalendarNotice(null)}
          />
        )}

        {calendar.events.length > 0 && (
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide">등록된 일정</p>
            {calendar.events.slice(0, 5).map((event) => (
              <div key={event.id} className="rounded-2xl bg-surface-alt border border-border p-4">
                <p className="text-[15px] font-bold text-text">{event.title}</p>
                <p className="text-[13px] text-text-muted mt-1">
                  {event.eventType} · {event.date} · {event.relatedPeople.join(', ') || '관련 인물 없음'}
                </p>
              </div>
            ))}
          </div>
        )}

        {calendarResults.length > 0 && (
          <div className="space-y-2">
            <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide">처리 결과</p>
            {calendarResults.map((result) => (
              <div key={result.event.id} className="rounded-2xl bg-primary-pale/50 border border-primary/20 p-4">
                <p className="text-[15px] font-bold text-text">
                  {result.event.title} · {result.action === 'auto_edit' ? '기억 전달 초안 생성' : '새 인터뷰 질문 생성'}
                </p>
                <p className="text-[13px] text-text-muted mt-1">
                  연결 기억 {result.relatedMemoryIds.length}개
                </p>
              </div>
            ))}
          </div>
        )}
      </section>}

      {activePanel === 'demo' && <section className="p-7 rounded-[28px] bg-surface border border-border shadow-[0_2px_8px_rgba(0,0,0,0.06)] space-y-6">
        <div className="flex items-center gap-3">
          <PlayCircle className="w-5 h-5 text-primary" aria-hidden="true" />
          <h2 className="text-[19px] font-black text-text">발표 데모</h2>
        </div>
        <p className="text-[15px] text-text-muted leading-relaxed">
          캡스톤 시연용 사전 DB를 불러와 네트워크 없이 나의 분신과 인쇄용 자서전을 안정적으로 보여줍니다.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            ['기억 카드', memories.length],
            ['사진', photos.length],
            ['가족 질문', familyQuestions.length],
            ['자서전 챕터', autobiographyChapters.length],
            ['검색 연결', ragEntries.length],
            ['공개 기억', memories.filter((memory) => memory.privacy !== 'private').length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border bg-surface-alt p-4">
              <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide">{label}</p>
              <p className="mt-1 text-[24px] font-black text-text">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={seedDemoData}
            className="px-5 py-3 rounded-2xl bg-primary text-white text-[15px] font-bold hover:bg-primary-light transition-colors shadow-sm"
          >
            발표용 데이터 불러오기
          </button>
          <button
            type="button"
            onClick={clearDemoData}
            disabled={!demo.enabled}
            className="px-5 py-3 rounded-2xl border border-border bg-surface-alt text-[15px] font-bold text-text-muted disabled:opacity-40 hover:bg-border/40 transition-colors"
          >
            발표용 데이터 초기화
          </button>
          <label className="inline-flex items-center gap-2 rounded-2xl border border-border bg-surface-alt px-5 py-3 text-[15px] font-bold text-text-muted">
            <input
              type="checkbox"
              checked={demo.offlineMode}
              onChange={(event) => setDemoOfflineMode(event.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary/30"
            />
            네트워크 없이 시연
          </label>
        </div>

        <div className={`rounded-2xl border p-4 ${isDemoReady ? 'border-primary/20 bg-primary-pale' : 'border-border bg-surface-alt'}`}>
          <p className={`text-[14px] font-bold leading-relaxed ${isDemoReady ? 'text-primary' : 'text-text-muted'}`}>
            {demo.enabled
              ? `${isDemoReady ? '발표 준비가 완료되었습니다.' : `발표 준비 ${demoReadyCount}/${demoReadinessChecks.length}개 완료.`}${demo.seededAt ? ` 불러온 시각: ${new Date(demo.seededAt).toLocaleString('ko-KR')}` : ''}`
              : '발표용 데이터 불러오기를 누르면 사전 기억, 사진, 가족 질문, 말투, 자서전 챕터가 주입됩니다.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {demoReadinessChecks.map((check) => (
            <div key={check.label} className="flex items-center gap-3 rounded-2xl border border-border bg-surface-alt p-4">
              {check.ready ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-text-subtle" aria-hidden="true" />
              )}
              <span className={`text-[14px] font-bold ${check.ready ? 'text-text' : 'text-text-muted'}`}>
                {check.label}
              </span>
            </div>
          ))}
        </div>

        <div className="rounded-[24px] border border-border bg-surface-alt p-5">
          <div className="mb-4 flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-[16px] font-black text-text">3~5분 시연 순서</h3>
          </div>
          <div className="space-y-3">
            {DEMO_SCENARIO_STEPS.map((step) => (
              <div key={step.step} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-[12px] font-black text-white">
                    {step.step}
                  </span>
                  <p className="text-[15px] font-black text-text">{step.title}</p>
                  <span className="rounded-full bg-primary-pale px-3 py-1 text-[12px] font-bold text-primary">
                    {step.routeLabel}
                  </span>
                </div>
                <p className="mt-3 text-[14px] font-semibold leading-relaxed text-text-muted">{step.action}</p>
                <p className="mt-2 text-[13px] leading-relaxed text-text-subtle">{step.presenterLine}</p>
                <p className="mt-2 text-[13px] font-bold text-primary">{step.successSignal}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[24px] border border-border bg-surface-alt p-5">
            <div className="mb-4 flex items-center gap-2">
              <Printer className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-[16px] font-black text-text">인쇄물 점검표</h3>
            </div>
            <div className="space-y-3">
              {PRINT_READY_CHECKLIST.map((item) => (
                <div key={item.title} className="rounded-2xl bg-surface p-4">
                  <p className="text-[14px] font-black text-text">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-surface-alt p-5">
            <div className="mb-4 flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-[16px] font-black text-text">제출 자료 구성</h3>
            </div>
            <div className="space-y-3">
              {CAPSTONE_SUBMISSION_SECTIONS.map((item) => (
                <div key={item.title} className="rounded-2xl bg-surface p-4">
                  <p className="text-[14px] font-black text-text">{item.title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-text-muted">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-surface-alt p-5">
          <h3 className="text-[16px] font-black text-text">시연용 추천 질문</h3>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEMO_PERSONA_QUESTIONS.map((question) => (
              <p key={question} className="rounded-2xl bg-surface px-4 py-3 text-[14px] font-semibold text-text-muted">
                {question}
              </p>
            ))}
          </div>
        </div>

        <div className="rounded-[24px] border border-border bg-surface-alt p-5">
          <div className="mb-4 flex items-center gap-2">
            <MessageSquareQuote className="h-5 w-5 text-primary" aria-hidden="true" />
            <h3 className="text-[16px] font-black text-text">3~5분 발표 대본</h3>
          </div>
          <div className="space-y-3">
            {DEMO_PRESENTATION_SCRIPT.map((segment) => (
              <div key={segment.timebox} className="rounded-2xl border border-border bg-surface p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-primary-pale px-3 py-1 text-[12px] font-black text-primary">
                    {segment.timebox}
                  </span>
                  <p className="text-[14px] font-black text-text">{segment.title}</p>
                </div>
                <p className="mt-3 text-[14px] font-semibold leading-relaxed text-text-muted">{segment.script}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[24px] border border-border bg-surface-alt p-5">
            <div className="mb-4 flex items-center gap-2">
              <Quote className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-[16px] font-black text-text">PPT/포스터 핵심 문장</h3>
            </div>
            <div className="space-y-2">
              {PITCH_COPY.map((copy) => (
                <p key={copy} className="rounded-2xl bg-surface px-4 py-3 text-[14px] font-bold leading-relaxed text-text">
                  {copy}
                </p>
              ))}
            </div>
          </div>

          <div className="rounded-[24px] border border-border bg-surface-alt p-5">
            <div className="mb-4 flex items-center gap-2">
              <MessageSquareQuote className="h-5 w-5 text-primary" aria-hidden="true" />
              <h3 className="text-[16px] font-black text-text">심사위원 예상 질문</h3>
            </div>
            <div className="space-y-3">
              {JUDGE_QA.map((item) => (
                <div key={item.question} className="rounded-2xl bg-surface p-4">
                  <p className="text-[14px] font-black text-text">{item.question}</p>
                  <p className="mt-2 text-[13px] font-semibold leading-relaxed text-text-muted">{item.answer}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3">
          {[
            ['말씀 나누기', '/'],
            ['추억 보관함', '/archive'],
            ['가족 공간', '/review'],
            ['나의 분신', '/persona'],
            ['자서전', '/autobiography'],
          ].map(([label, path]) => (
            <button
              key={path}
              type="button"
              onClick={() => navigate(path)}
              className="rounded-2xl border border-primary/30 bg-surface px-4 py-2.5 text-[14px] font-bold text-primary transition-colors hover:bg-primary-pale"
            >
              {label}
            </button>
          ))}
        </div>
      </section>}

      {/* Double-confirm dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-title"
        >
          <div className="bg-surface rounded-[28px] p-7 max-w-sm w-full mx-4 shadow-[0_20px_60px_rgba(0,0,0,0.15)] border border-border space-y-4">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-primary" aria-hidden="true" />
              <h3 id="confirm-dialog-title" className="text-[18px] font-black text-text">
                정책 변경 확인
              </h3>
            </div>
            <p className="text-[15px] text-text-muted">정말 이 정책을 저장하시겠습니까?</p>
            <p className="text-[14px] text-text-subtle">
              선택한 정책: <span className="font-bold text-text">{getPolicyLabel(selectedPolicy)}</span>
            </p>
            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-3 text-[15px] font-semibold text-text-muted bg-surface-alt border border-border rounded-2xl hover:bg-border/30 focus:outline-none transition-colors"
                aria-label="취소"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className="flex-1 px-4 py-3 text-[15px] font-bold text-white bg-primary rounded-2xl hover:bg-primary-light focus:outline-none transition-colors shadow-sm"
                aria-label="확인"
              >
                확인
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
