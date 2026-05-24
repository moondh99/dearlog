import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Shield, AlertTriangle, CalendarDays, PlayCircle, Database, Loader2, CheckCircle2, Circle, ClipboardList, FileText, Printer, MessageSquareQuote, Quote, KeyRound, Lock, Unlock, ShieldCheck, RefreshCw, Eye, EyeOff } from 'lucide-react';
import { splitSecret, combineShares, type Share } from '../lib/security/shamir';
import { encryptText } from '../lib/security/encryption';
import { useStore } from '../store';
import { processUpcomingEvents, SUPPORTED_EVENT_TYPES } from '../lib/agents/calendar-trigger';
import { ragIndex } from '../lib/rag/index';
import StatusNotice, { type StatusNoticeTone } from '../components/StatusNotice';
import TrustSafetyPanel from '../components/TrustSafetyPanel';
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

type SettingsPanel = 'policy' | 'index' | 'calendar' | 'legacy' | 'demo';

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
  const role = useStore((state) => state.auth.role);
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
  
  // Legacy vault actions
  const fetchLegacyVault = useStore((state) => state.fetchLegacyVault);
  const setupLegacyVault = useStore((state) => state.setupLegacyVault);
  const triggerDeathVerification = useStore((state) => state.triggerDeathVerification);
  const approveDeathVerification = useStore((state) => state.approveDeathVerification);
  const recoverLegacyData = useStore((state) => state.recoverLegacyData);
  const resetLegacyVault = useStore((state) => state.resetLegacyVault);

  useEffect(() => {
    fetchLegacyVault();
  }, [fetchLegacyVault]);

  // Legacy local state
  const [shareAInput, setShareAInput] = useState(() => {
    return localStorage.getItem('dearlog_legacy_share_a') ?? '';
  });
  const [isProcessingLegacy, setIsProcessingLegacy] = useState(false);
  const [showShareA, setShowShareA] = useState(false);
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

  // Legacy encryption state
  const [legacyShares, setLegacyShares] = useState<Share[] | null>(null);
  const [selectedShareIndices, setSelectedShareIndices] = useState<Set<number>>(new Set());
  const [recoveredSecret, setRecoveredSecret] = useState<string | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [legacyNotice, setLegacyNotice] = useState<{ tone: StatusNoticeTone; title: string; message?: string } | null>(null);

  const handleSplitKey = () => {
    const profile = useStore.getState().auth.profile;
    const dek = `DEK-${profile?.name ?? 'dearlog'}-${Date.now().toString(36)}`;
    const shares = splitSecret(dek, 2, 3);
    setLegacyShares(shares);
    setSelectedShareIndices(new Set());
    setRecoveredSecret(null);
    setRecoveryError(null);
    setLegacyNotice({
      tone: 'success',
      title: '암호화 키를 3개 조각으로 분할했습니다',
      message: `비밀 키: ${dek.substring(0, 20)}... → 임의의 2개 조각으로 복원할 수 있습니다.`,
    });
  };

  const handleToggleShare = (index: number) => {
    setSelectedShareIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
    setRecoveredSecret(null);
    setRecoveryError(null);
  };

  const handleCombineShares = () => {
    if (!legacyShares || selectedShareIndices.size < 2) return;
    try {
      const selected = Array.from(selectedShareIndices).map((i) => legacyShares[i]);
      const secret = combineShares(selected);
      setRecoveredSecret(secret);
      setRecoveryError(null);
    } catch (err) {
      setRecoveredSecret(null);
      setRecoveryError(err instanceof Error ? err.message : '복원에 실패했습니다');
    }
  };

  const handleCreateVault = async () => {
    setIsProcessingLegacy(true);
    setLegacyNotice(null);
    try {
      const profile = useStore.getState().auth.profile;
      const dek = `DEK-${profile?.name ?? 'dearlog'}-${Date.now().toString(36)}`;
      const shares = splitSecret(dek, 2, 3);
      const encryptedMemories = await encryptText(JSON.stringify(memories), dek);
      const encryptedAutobiography = await encryptText(JSON.stringify(autobiographyChapters), dek);

      await setupLegacyVault({
        encryptedMemories,
        encryptedAutobiography,
        serverShare: JSON.stringify(shares[1]),
        institutionShare: JSON.stringify(shares[2]),
      });

      const shareAStr = JSON.stringify(shares[0]);
      localStorage.setItem('dearlog_legacy_share_a', shareAStr);
      setShareAInput(shareAStr);

      setLegacyNotice({
        tone: 'success',
        title: '유산 금고 개설 완료',
        message: '데이터가 안전하게 암호화되어 백업되었습니다. 키 조각 A가 브라우저에 저장되었습니다.',
      });
    } catch (err) {
      console.error(err);
      setLegacyNotice({
        tone: 'error',
        title: '유산 금고 개설 실패',
        message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessingLegacy(false);
    }
  };

  const handleTriggerDeath = async () => {
    setIsProcessingLegacy(true);
    setLegacyNotice(null);
    try {
      await triggerDeathVerification();
      setLegacyNotice({
        tone: 'success',
        title: '사망 증명 연동 완료',
        message: '사망 심사가 개시되었습니다. 관리자 승인을 대기합니다.',
      });
    } catch (err) {
      console.error(err);
      setLegacyNotice({
        tone: 'error',
        title: '사망 심사 개시 실패',
        message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessingLegacy(false);
    }
  };

  const handleApproveDeath = async () => {
    setIsProcessingLegacy(true);
    setLegacyNotice(null);
    try {
      await approveDeathVerification();
      setLegacyNotice({
        tone: 'success',
        title: '사망 심사 승인 완료',
        message: '사망 심사가 최종 승인되었습니다. 키 조각 B, C가 릴리즈되었습니다.',
      });
    } catch (err) {
      console.error(err);
      setLegacyNotice({
        tone: 'error',
        title: '사망 심사 승인 실패',
        message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessingLegacy(false);
    }
  };

  const handleRecoverData = async () => {
    setIsProcessingLegacy(true);
    setLegacyNotice(null);
    try {
      await recoverLegacyData(shareAInput);
      setLegacyNotice({
        tone: 'success',
        title: '데이터 복원 성공',
        message: '키 조각들을 결합하여 유산 데이터를 완벽히 복구했습니다!',
      });
    } catch (err) {
      console.error(err);
      setLegacyNotice({
        tone: 'error',
        title: '데이터 복원 실패',
        message: err instanceof Error ? err.message : '알 수 없는 오류가 발생했습니다.',
      });
    } finally {
      setIsProcessingLegacy(false);
    }
  };

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
    { label: '기억 카드 20개 이상', ready: memories.length >= 20 },
    { label: '사진 12장 이상', ready: photos.length >= 12 },
    { label: '가족 질문 3개 이상', ready: familyQuestions.length >= 3 },
    { label: '자서전 챕터 20개 이상', ready: autobiographyChapters.length >= 20 },
    { label: '검색 연결 20개 이상', ready: ragEntries.length >= 20 },
  ];
  const demoReadyCount = demoReadinessChecks.filter((check) => check.ready).length;
  const isDemoReady = demoReadinessChecks.every((check) => check.ready);
  const panels: Array<{ id: SettingsPanel; label: string; count?: number }> = [
    { id: 'policy', label: '사후 정책' },
    { id: 'index', label: '기억 검색 연결', count: ragEntries.length },
    { id: 'calendar', label: '가족 일정', count: calendar.events.length },
    { id: 'legacy', label: '유산 암호화' },
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
          className="ml-auto rounded-xl border border-border/70 bg-surface px-4 py-2 text-[14px] font-bold text-text-muted shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-surface-alt"
        >
          로그아웃
        </button>
      </div>

      <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-border/70 bg-surface px-2 py-2 shadow-sm backdrop-blur" role="tablist" aria-label="설정 영역">
        {panels.map((panel) => (
          <button
            key={panel.id}
            type="button"
            role="tab"
            aria-selected={activePanel === panel.id}
            onClick={() => setActivePanel(panel.id)}
            className={`shrink-0 rounded-xl border px-4 py-2 text-[14px] font-bold transition-all duration-300 ease-out ${
              activePanel === panel.id
                ? 'border-primary bg-primary text-primary-pale shadow-sm'
                : 'border-transparent bg-transparent text-text-muted hover:-translate-y-0.5 hover:bg-surface-alt'
            }`}
          >
            {panel.label}
            {typeof panel.count === 'number' && <span className="ml-2 opacity-75">{panel.count}</span>}
          </button>
        ))}
      </div>

      {/* Posthumous Policy Section */}
      {activePanel === 'policy' && <section
        className="premium-panel space-y-6 rounded-[28px] p-7"
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

        <TrustSafetyPanel compact />

        {/* Current policy status */}
        <div className="rounded-2xl border border-border/70 bg-surface p-4 shadow-sm">
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
                className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-4 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 ${
                  selectedPolicy === option.value
                    ? 'border-primary/30 bg-primary-pale/70'
                    : 'border-border/70 bg-surface hover:border-border-strong'
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
            className="rounded-2xl bg-primary px-6 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="정책 저장"
          >
            저장
          </button>
        </div>
        {saved && (
          <StatusNotice tone="success" title="사후 이용 정책을 저장했습니다" />
        )}
      </section>}

      {activePanel === 'index' && <section className="premium-panel space-y-6 rounded-[28px] p-7">
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
            className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/90 disabled:opacity-40"
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

      {activePanel === 'calendar' && <section className="premium-panel space-y-6 rounded-[28px] p-7">
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
            className="w-full rounded-2xl border border-border/80 bg-surface px-4 py-3 text-[15px] text-text shadow-sm outline-none transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value as CalendarEventType)}
              aria-label="일정 유형"
              className="rounded-2xl border border-border/80 bg-surface px-4 py-3 text-[15px] text-text shadow-sm outline-none transition-all duration-300 ease-out focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
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
              className="rounded-2xl border border-border/80 bg-surface px-4 py-3 text-[15px] text-text shadow-sm outline-none transition-all duration-300 ease-out focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
            />
          </div>
          <input
            value={eventPeople}
            onChange={(e) => setEventPeople(e.target.value)}
            aria-label="관련 인물"
            placeholder="관련 인물, 쉼표로 구분"
            className="w-full rounded-2xl border border-border/80 bg-surface px-4 py-3 text-[15px] text-text shadow-sm outline-none transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
          <textarea
            value={eventDescription}
            onChange={(e) => setEventDescription(e.target.value)}
            aria-label="일정 설명"
            placeholder="일정 설명"
            className="h-24 w-full resize-none rounded-2xl border border-border/80 bg-surface p-4 text-[15px] text-text shadow-sm outline-none transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
          />
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleAddEvent}
              disabled={!eventTitle.trim() || !eventDate}
              className="rounded-2xl bg-primary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light disabled:opacity-40"
            >
              일정 등록
            </button>
            <button
              type="button"
              onClick={handleProcessCalendar}
              disabled={isProcessingCalendar || calendar.events.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-secondary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/90 disabled:opacity-40"
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
              <div key={event.id} className="rounded-2xl border border-border/70 bg-surface p-4 shadow-sm">
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
              <div key={result.event.id} className="rounded-2xl border border-primary/20 bg-primary-pale/60 p-4 shadow-sm">
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

      {activePanel === 'legacy' && <section
        className="premium-panel space-y-6 rounded-[28px] p-7"
        aria-labelledby="legacy-encryption-heading"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <KeyRound className="w-5 h-5 text-primary" aria-hidden="true" />
            <h2 id="legacy-encryption-heading" className="text-[19px] font-black text-text">
              디지털 유산 상속 워크플로우 (Shamir&apos;s Secret Sharing)
            </h2>
          </div>
          {posthumousPolicy.vault && (
            <button
              type="button"
              onClick={async () => {
                if (confirm('유산 금고 설정을 초기화하고 생존 상태로 복원하시겠습니까?')) {
                  setIsProcessingLegacy(true);
                  try {
                    await resetLegacyVault();
                    localStorage.removeItem('dearlog_legacy_share_a');
                    setShareAInput('');
                    setLegacyNotice({
                      tone: 'info',
                      title: '금고가 초기화되었습니다',
                      message: '모든 암호화 데이터와 로컬 키 조각이 성공적으로 삭제되었습니다.',
                    });
                  } catch (err) {
                    setLegacyNotice({
                      tone: 'error',
                      title: '초기화 실패',
                      message: err instanceof Error ? err.message : '초기화 중 오류가 발생했습니다.',
                    });
                  } finally {
                    setIsProcessingLegacy(false);
                  }
                }
              }}
              className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 bg-red-50/50 px-3 py-1.5 text-[12px] font-black text-red-600 hover:bg-red-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              시뮬레이션 초기화
            </button>
          )}
        </div>

        <p className="text-[15px] text-text-muted leading-relaxed">
          어르신의 기억 데이터 암호화 키를 3개 조각으로 분리하고, 사후 사망 심사 통과 시에만 키를 조각 결합으로 복원하여 해독하는 풀스택 안전 프로토콜입니다.
        </p>

        {legacyNotice && (
          <StatusNotice
            tone={legacyNotice.tone}
            title={legacyNotice.title}
            message={legacyNotice.message}
            onDismiss={() => setLegacyNotice(null)}
          />
        )}

        {/* Stepper Steps UI */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 bg-surface-alt/50 p-4 rounded-[24px] border border-border/60">
          {[
            {
              step: 1,
              title: '생존 (금고 개설)',
              desc: '데이터 암호화 및 3개 조각 분산',
              active: !posthumousPolicy.vault,
              done: !!posthumousPolicy.vault,
            },
            {
              step: 2,
              title: '유고 발생 (심사 개시)',
              desc: '행안부 연동 또는 보호자 심사 신청',
              active: posthumousPolicy.vault?.deathVerificationStatus === 'alive',
              done: posthumousPolicy.vault && posthumousPolicy.vault.deathVerificationStatus !== 'alive',
            },
            {
              step: 3,
              title: '사망 심사 승인',
              desc: '관리자 승인 후 서버/기관 조각 릴리즈',
              active: posthumousPolicy.vault?.deathVerificationStatus === 'pending_verification',
              done: posthumousPolicy.vault?.deathVerificationStatus === 'released',
            },
            {
              step: 4,
              title: '유산 상속 (복원)',
              desc: '보유 조각 A + 릴리즈된 조각들로 최종 해독',
              active: posthumousPolicy.vault?.deathVerificationStatus === 'released' && !posthumousPolicy.recoveredMemories,
              done: !!posthumousPolicy.recoveredMemories,
            },
          ].map((item) => (
            <div
              key={item.step}
              className={`flex flex-col gap-1.5 rounded-2xl border p-4 transition-all duration-300 ${
                item.active
                  ? 'border-primary bg-primary-pale/50 shadow-sm ring-1 ring-primary/20'
                  : item.done
                  ? 'border-green-200 bg-green-50/20'
                  : 'border-border/40 opacity-50 bg-surface'
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-black ${
                    item.done
                      ? 'bg-green-600 text-white'
                      : item.active
                      ? 'bg-primary text-white'
                      : 'bg-text-subtle text-surface'
                  }`}
                >
                  {item.step}
                </span>
                <span className="text-[14px] font-black text-text">{item.title}</span>
              </div>
              <p className="text-[12px] text-text-muted leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>

        {/* Interactive Action Card based on current status */}
        <div className="premium-panel border border-primary/10 bg-gradient-to-br from-surface to-surface-alt/30 p-6 rounded-[24px]">
          {/* Step 1: Survive / Vault setup */}
          {!posthumousPolicy.vault && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="w-5 h-5 text-primary" />
                <h3 className="text-[16px] font-black text-text">1단계: 디지털 유산 금고 개설 및 기억 암호화</h3>
              </div>
              <p className="text-[14px] text-text-muted leading-relaxed">
                현재 작성된 기억들({memories.length}개) 및 자서전을 대칭키(AES-GCM)로 암호화하고, 암호화 키를 Shamir&apos;s Secret Sharing (2-of-3)으로 쪼갭니다.
                <br />
                <strong>조각 A (가족 보관)</strong>는 로컬에만 저장되며, <strong>조각 B(서버), 조각 C(검증기관)</strong>가 서버로 안전히 백업됩니다.
              </p>
              <button
                type="button"
                onClick={handleCreateVault}
                disabled={isProcessingLegacy || memories.length === 0}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light disabled:opacity-40"
              >
                {isProcessingLegacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                유산 금고 개설 & 암호화 잠금 설정
              </button>
              {memories.length === 0 && (
                <p className="text-[12px] text-red-500 font-bold">암호화할 기억 카드가 없습니다. 발표 데모 탭에서 샘플 데이터를 먼저 로드해 주세요.</p>
              )}
            </div>
          )}

          {/* Step 2: Trigger death */}
          {posthumousPolicy.vault?.deathVerificationStatus === 'alive' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-orange-500" />
                <h3 className="text-[16px] font-black text-text">2단계: 유고 발생 심사 트리거 (사망 신고 연동)</h3>
              </div>
              <p className="text-[14px] text-text-muted leading-relaxed">
                어르신의 생존 상태에서는 비공개 기억들이 완벽하게 차단(마스킹)됩니다.
                사후 데이터 상속을 위해 행정안전부 사망 증명 연동 API 또는 보호자 연동 사망 심사 절차를 시작합니다.
              </p>
              <div className="bg-surface p-4 rounded-xl border border-border space-y-2.5">
                <p className="text-[13px] font-bold text-text-muted">안전하게 보관 중인 키 조각 상태:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="rounded-xl border border-primary/20 bg-primary-pale/30 px-3 py-2 text-[12px]">
                    <span className="font-black text-primary">✓ 조각 A (가족 보관)</span>
                    <span className="block mt-1 text-[11px] font-mono text-text-subtle">브라우저 내 안전 저장됨</span>
                  </div>
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] opacity-75">
                    <span className="font-black text-text-muted">🔒 조각 B (서버 보관)</span>
                    <span className="block mt-1 text-[11px] font-mono text-text-subtle">잠김 (사후 해독 불가)</span>
                  </div>
                  <div className="rounded-xl border border-border bg-surface px-3 py-2 text-[12px] opacity-75">
                    <span className="font-black text-text-muted">🔒 조각 C (검증기관)</span>
                    <span className="block mt-1 text-[11px] font-mono text-text-subtle">잠김 (사후 해독 불가)</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleTriggerDeath}
                disabled={isProcessingLegacy}
                className="inline-flex items-center gap-2 rounded-2xl bg-orange-600 px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-orange-500 disabled:opacity-40"
              >
                {isProcessingLegacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
                사망 증명 연동 신청 (심사 개시)
              </button>
            </div>
          )}

          {/* Step 3: Approve death */}
          {posthumousPolicy.vault?.deathVerificationStatus === 'pending_verification' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-500" />
                <h3 className="text-[16px] font-black text-text">3단계: 사망 사실 검증 및 승인 (서버/기관 조각 릴리즈)</h3>
              </div>
              <p className="text-[14px] text-text-muted leading-relaxed">
                사망 증빙 심사를 처리합니다. 본 시뮬레이션에서는 관리자가 심사 서류를 검토하고 사망을 최종 승인하여 키 조각 B, C의 릴리즈 플래그를 활성화하는 과정입니다.
              </p>
              <button
                type="button"
                onClick={handleApproveDeath}
                disabled={isProcessingLegacy}
                className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-red-500 disabled:opacity-40"
              >
                {isProcessingLegacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                사망 심사 최종 승인 & 키 조각 릴리즈
              </button>
            </div>
          )}

          {/* Step 4: Recover & Inherit */}
          {posthumousPolicy.vault?.deathVerificationStatus === 'released' && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Unlock className="w-5 h-5 text-green-600" />
                <h3 className="text-[16px] font-black text-text">4단계: 디지털 유산 복원 및 해독</h3>
              </div>
              <p className="text-[14px] text-text-muted leading-relaxed">
                사망 승인이 완료되어 서버 조각 B와 검증 기관 조각 C가 릴리즈되었습니다.
                가족 보관 조각 A와 서버에서 수신한 조각 B, C를 모아 원본 AES-GCM 키를 복구하고 전체 유산 데이터를 성공적으로 해독합니다.
              </p>

              <div className="space-y-2">
                <label className="block text-[13px] font-bold text-text-muted" htmlFor="share-a-input">
                  가족 소유 키 조각 A (JSON 문자열)
                </label>
                <div className="relative">
                  <textarea
                    id="share-a-input"
                    value={shareAInput}
                    onChange={(e) => setShareAInput(e.target.value)}
                    placeholder="조각 A JSON 문자열을 입력하거나 로컬 저장된 조각이 자동 로드됩니다"
                    className="w-full h-24 rounded-2xl border border-border bg-surface px-4 py-3 font-mono text-[12px] text-text shadow-sm outline-none placeholder:text-text-subtle focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowShareA(!showShareA)}
                    className="absolute right-3 bottom-3 rounded-lg border border-border bg-surface-alt p-1.5 text-text-muted hover:bg-surface"
                  >
                    {showShareA ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              {showShareA && shareAInput && (
                <div className="rounded-xl bg-surface-alt p-3 border border-border text-[11px] font-mono text-text-subtle break-all">
                  {shareAInput}
                </div>
              )}

              <button
                type="button"
                onClick={handleRecoverData}
                disabled={isProcessingLegacy || !shareAInput.trim()}
                className="inline-flex items-center gap-2 rounded-2xl bg-green-600 px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-green-500 disabled:opacity-40"
              >
                {isProcessingLegacy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Unlock className="w-4 h-4" />}
                조각 결합 및 데이터 해독
              </button>
            </div>
          )}
        </div>

        {/* Recovered Data Display Section */}
        {posthumousPolicy.recoveredMemories && (
          <div className="space-y-4 mt-6 border-t border-border/80 pt-6">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-6 h-6 text-green-600" />
              <h3 className="text-[17px] font-black text-text">성공적으로 복원된 상속 유산 피드</h3>
            </div>
            
            <p className="text-[14px] text-text-muted">
              총 {posthumousPolicy.recoveredMemories.length}개의 어르신 기억 카드와 자서전 챕터가 안전하게 해독되어 복원되었습니다.
            </p>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {posthumousPolicy.recoveredMemories.map((memory: any) => (
                <div
                  key={memory.id}
                  className="rounded-2xl border border-green-100 bg-white/70 p-5 shadow-sm backdrop-blur transition-all duration-300 hover:border-green-200"
                >
                  <div className="flex justify-between items-start gap-4">
                    <span className="rounded-full bg-green-50 px-3 py-1 text-[12px] font-bold text-green-700">
                      {memory.topic || '기억 조각'}
                    </span>
                    <span className="text-[12px] text-text-subtle">{memory.date}</span>
                  </div>
                  
                  <div className="mt-3 text-[14px] leading-relaxed text-text font-serif">
                    {memory.cleanedTranscript}
                  </div>
                  
                  {memory.tags && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {memory.tags.people?.map((p: string) => (
                        <span key={p} className="rounded-lg bg-surface-alt px-2 py-0.5 text-[11px] text-text-muted">
                          👤 {p}
                        </span>
                      ))}
                      {memory.tags.places?.map((pl: string) => (
                        <span key={pl} className="rounded-lg bg-surface-alt px-2 py-0.5 text-[11px] text-text-muted">
                          📍 {pl}
                        </span>
                      ))}
                      {memory.tags.timePeriod && (
                        <span className="rounded-lg bg-surface-alt px-2 py-0.5 text-[11px] text-text-muted">
                          🕒 {memory.tags.timePeriod}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>}

      {activePanel === 'demo' && <section className="premium-panel space-y-6 rounded-[28px] p-7">
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
            ['가족 일정', calendar.events.length],
            ['자서전 챕터', autobiographyChapters.length],
            ['검색 연결', ragEntries.length],
            ['공개 기억', memories.filter((memory) => memory.privacy !== 'private').length],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-border/70 bg-surface p-4 shadow-sm">
              <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide">{label}</p>
              <p className="mt-1 text-[24px] font-black text-text">{value}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={seedDemoData}
            className="rounded-2xl bg-primary px-5 py-3 text-[15px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light"
          >
            발표용 데이터 불러오기
          </button>
          <button
            type="button"
            onClick={clearDemoData}
            disabled={!demo.enabled}
            className="rounded-2xl border border-border/70 bg-surface px-5 py-3 text-[15px] font-bold text-text-muted shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-surface-alt disabled:opacity-40"
          >
            발표용 데이터 초기화
          </button>
          <label className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-surface px-5 py-3 text-[15px] font-bold text-text-muted shadow-sm">
            <input
              type="checkbox"
              checked={demo.offlineMode}
              onChange={(event) => setDemoOfflineMode(event.target.checked)}
              className="h-4 w-4 text-primary focus:ring-primary/30"
            />
            네트워크 없이 시연
          </label>
        </div>

        <div className={`rounded-2xl border p-4 shadow-sm ${isDemoReady ? 'border-primary/20 bg-primary-pale' : 'border-border/70 bg-surface'}`}>
          <p className={`text-[14px] font-bold leading-relaxed ${isDemoReady ? 'text-primary' : 'text-text-muted'}`}>
            {demo.enabled
              ? `${isDemoReady ? '발표 준비가 완료되었습니다.' : `발표 준비 ${demoReadyCount}/${demoReadinessChecks.length}개 완료.`}${demo.seededAt ? ` 불러온 시각: ${new Date(demo.seededAt).toLocaleString('ko-KR')}` : ''}`
              : '발표용 데이터 불러오기를 누르면 사전 기억, 사진, 가족 질문, 말투, 자서전 챕터가 주입됩니다.'}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {demoReadinessChecks.map((check) => (
            <div key={check.label} className="flex items-center gap-3 rounded-2xl border border-border/70 bg-surface p-4 shadow-sm">
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
          {(role === 'guardian'
            ? [
                ['홈 (자녀)', '/child'],
                ['질문 등록', '/child/questions'],
                ['추억 사진', '/child/photos'],
                ['진척도', '/child/progress'],
                ['챕터 검수', '/child/chapters'],
                ['추억 보관함', '/archive'],
                ['나의 분신', '/persona'],
                ['자서전', '/autobiography'],
              ]
            : [
                ['홈 (부모님)', '/parent'],
                ['말씀 나누기', '/parent/interview'],
                ['진척도', '/parent/progress'],
                ['원문 기록', '/parent/transcript'],
                ['추억 보관함', '/archive'],
                ['나의 분신', '/persona'],
                ['자서전', '/autobiography'],
              ]
          ).map(([label, path]) => (
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
          <div className="bg-surface rounded-[28px] p-7 max-w-sm w-full mx-4 shadow-[0_18px_50px_rgba(15,23,42,0.14)] border border-border space-y-4">
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
