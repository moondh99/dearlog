import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import { BellRing, CalendarDays, Lock, Users, Globe, Save, MessageSquarePlus, Trophy } from 'lucide-react';
import { useStore, PrivacyLevel } from '../store';
import { cn } from '../components/Layout';
import ConsentControls from '../components/ConsentControls';
import TrustSafetyPanel from '../components/TrustSafetyPanel';
import { submitQuestion } from '../lib/agents/family-question-queue';
import { getEffectiveConsentSettings } from '../lib/consent/manager';
import { buildEngagementLoop, buildWeeklyFamilyQuizzes, getFamilyQuestionStats } from '../lib/insights/memory-insights';
import {
  confirmLocalCoverDesign,
  createLocalSchedule,
  fetchLocalFreeSpeech,
  fetchLocalProgress,
  fetchLocalVapidPublicKey,
  generateLocalCoverDesign,
  registerLocalPushSubscription,
  requestLocalPublication,
  sendLocalAppCall,
  sendLocalNudge,
  uploadLocalPhoto,
} from '../lib/local-server';
import type { MemoryConsent, PriorityTag } from '../lib/types';

const COVER_PALETTE_PREVIEW: Record<string, string[]> = {
  warm_archive: ['#5C3420', '#93542C', '#FAF7F2'],
  quiet_blue: ['#263C52', '#6F879D', '#F3F7FA'],
  garden_green: ['#2F5233', '#7C9A65', '#F5F8EF'],
  classic_ink: ['#181A1F', '#6B7280', '#F8FAFC'],
};

const COVER_TEMPLATE_LABELS: Record<string, string> = {
  framed_portrait: '액자형 인물 표지',
  chapter_band: '챕터 띠 표지',
  letterpress: '활판 인쇄형 표지',
  photo_plate: '사진 플레이트 표지',
};

const FAMILY_SPACE_STEPS = [
  {
    label: '질문 모으기',
    description: '자녀와 손주가 궁금한 장면을 질문으로 남깁니다.',
  },
  {
    label: '기억 검수하기',
    description: '원문, AI 교정본, 최종 발행본을 나란히 확인합니다.',
  },
  {
    label: '다시 꺼내기',
    description: '퀴즈와 기념일 알림으로 저장된 기억을 가족 대화에 돌려보냅니다.',
  },
];

export default function ReviewPage() {
  const {
    memories,
    calendar,
    familyQuestions,
    updateMemoryPrivacy,
    updateMemoryPublishVersion,
    updateMemoryConsent,
    updateMemoryConsentSettings,
    revokeMemoryUsage,
    deleteMemory,
  } = useStore();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [questionText, setQuestionText] = useState('');
  const [questionPriority, setQuestionPriority] = useState<PriorityTag>('normal');
  const [anonymous, setAnonymous] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [serverNotice, setServerNotice] = useState('');
  const [scheduleAt, setScheduleAt] = useState(() => new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16));
  const [localProgress, setLocalProgress] = useState<{
    character: string;
    totalRecords: number;
    progress: Array<{ count: number; complete: boolean; chapter: { title: string; minAnswerCount: number } }>;
  } | null>(null);
  const [freeSpeech, setFreeSpeech] = useState<Array<{ id: string; transcriptText: string; chapter: { title: string } }>>([]);
  const [coverDesign, setCoverDesign] = useState<{ id: string; palette: string; template: string; font: string } | null>(null);
  const [coverAnalysis, setCoverAnalysis] = useState<{ tone: string; keywords: string[]; reason: string } | null>(null);
  const questionStats = getFamilyQuestionStats(familyQuestions.questions);
  const weeklyQuizzes = buildWeeklyFamilyQuizzes(memories);
  const engagementLoop = buildEngagementLoop({
    memories,
    familyQuestions: familyQuestions.questions,
    calendarEvents: calendar.events,
  });

  const refreshLocalServerState = async () => {
    try {
      const [progressResult, freeSpeechResult] = await Promise.all([
        fetchLocalProgress(),
        fetchLocalFreeSpeech(),
      ]);
      setLocalProgress({
        character: progressResult.character,
        totalRecords: progressResult.totalRecords,
        progress: progressResult.progress,
      });
      setFreeSpeech(freeSpeechResult.records.slice(0, 4));
    } catch {
      setServerNotice('로컬 서버가 꺼져 있으면 서버 연동 패널은 대기 상태로 표시됩니다.');
    }
  };

  useEffect(() => {
    void refreshLocalServerState();
  }, []);

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

  const handleRevokeUsage = (memoryId: string) => {
    revokeMemoryUsage(memoryId);
    if (deleteConfirmId === memoryId) setDeleteConfirmId(null);
  };

  const handleDeleteMemory = (memoryId: string) => {
    if (deleteConfirmId !== memoryId) {
      setDeleteConfirmId(memoryId);
      return;
    }
    deleteMemory(memoryId);
    setDeleteConfirmId(null);
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
      <div className="mx-auto grid h-full max-w-5xl gap-6 p-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="flex flex-col items-center justify-center text-center">
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
            className="mt-7 inline-flex items-center justify-center rounded-2xl bg-primary px-6 py-3.5 text-[16px] font-black text-white shadow-[0_14px_32px_rgba(15,23,42,0.16)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light"
          >
            기억 기록하러 가기
          </Link>
        </section>
        <section className="premium-panel rounded-[30px] p-6 text-left">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary">Local server operations</p>
          <h2 className="mt-2 text-[22px] font-black text-text">보호자 관리 기능</h2>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-text-muted">
            아직 기억이 없어도 앱 내 음성 인터뷰 예약, 사진 질문 준비, 콕 찌르기 알림은 로컬 서버에 저장할 수 있습니다.
          </p>
          <input
            type="datetime-local"
            value={scheduleAt}
            onChange={(event) => setScheduleAt(event.target.value)}
            className="mt-5 w-full rounded-2xl border border-border bg-surface px-3 py-3 text-[14px] font-bold text-text"
          />
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={async () => {
                await createLocalSchedule(new Date(scheduleAt).toISOString());
                setServerNotice('앱 내 음성 인터뷰 스케줄을 로컬 DB에 저장했습니다.');
              }}
              className="rounded-2xl bg-primary px-4 py-3 text-[14px] font-black text-white"
            >
              앱 연락 시간 저장
            </button>
            <button
              type="button"
              onClick={async () => {
                const result = await sendLocalAppCall();
                setServerNotice(`시니어 앱으로 인터뷰 연락을 보냈습니다. 세션: ${result.session.id}`);
              }}
              className="rounded-2xl bg-secondary px-4 py-3 text-[14px] font-black text-white"
            >
              지금 앱으로 연락
            </button>
          </div>
          <p className="mt-4 text-[13px] font-semibold leading-relaxed text-text-muted">
            {serverNotice || '로컬 서버와 연결되면 작업 결과가 여기에 표시됩니다.'}
          </p>
          <div className="mt-5 rounded-[24px] border border-primary/20 bg-primary-pale/70 p-4 text-center">
            <p className="text-[42px] leading-none">{localProgress?.character ?? '🌰'}</p>
            <p className="mt-2 text-[15px] font-black text-primary">
              기록 {localProgress?.totalRecords ?? 0}개
            </p>
            <p className="mt-1 text-[12px] font-bold text-primary/75">
              로컬 DB 기준 기록량 진척도입니다.
            </p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <section className="premium-panel overflow-hidden rounded-[32px]">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="bg-primary p-6 text-primary-pale sm:p-8">
            <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary-pale/50">Family review</p>
            <h1 className="mt-3 text-[30px] font-black leading-tight sm:text-[36px]">가족 공간</h1>
            <p className="mt-3 max-w-2xl text-[16px] font-semibold leading-relaxed text-primary-pale/75">
              가족 질문을 등록하고, 기록된 이야기를 출판 가능한 문장으로 검수하며 공개 범위를 조정합니다.
            </p>
            <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ['기억', memories.length],
                ['질문', questionStats.total],
                ['대기', questionStats.pending],
                ['답변율', `${Math.round(questionStats.answerRate * 100)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[20px] border border-primary-light/20 bg-primary-light/30 px-4 py-3 shadow-sm backdrop-blur">
                  <p className="text-[11px] font-black text-primary-pale/60">{label}</p>
                  <p className="mt-1 text-[24px] font-black text-primary-pale">{value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col justify-between gap-6 bg-surface p-6 backdrop-blur sm:p-8">
            <div>
              <p className="text-[12px] font-black uppercase tracking-[0.16em] text-primary">동의 기반 공개</p>
              <h2 className="mt-2 text-[22px] font-black text-text">가족에게 보여주기 전에 한 번 더 확인합니다</h2>
              <p className="mt-3 text-[15px] font-semibold leading-relaxed text-text-muted">
                사적 기억, 가족 공개, 전체 공개를 기억별로 분리해 심사위원에게 개인정보 보호 흐름을 보여줄 수 있습니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['나만', memories.filter((memory) => memory.privacy === 'private').length],
                ['가족', memories.filter((memory) => memory.privacy === 'family').length],
                ['공개', memories.filter((memory) => memory.privacy === 'public').length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-2xl border border-border bg-surface-alt px-3 py-3 text-center shadow-sm">
                  <p className="text-[11px] font-black text-text-subtle">{label}</p>
                  <p className="mt-1 text-[20px] font-black text-primary">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <TrustSafetyPanel />

      <section className="premium-panel overflow-hidden rounded-[30px]">
        <div className="border-b border-border bg-surface-alt/80 px-6 py-6 backdrop-blur sm:px-8">
          <p className="text-[12px] font-black uppercase tracking-[0.18em] text-primary">Local server operations</p>
          <h2 className="mt-2 text-[22px] font-black text-text">보호자 관리 기능</h2>
          <p className="mt-2 text-[14px] font-semibold leading-relaxed text-text-muted">
            앱 내 음성 인터뷰 예약, 사진 업로드, 콕 찌르기, 자유 발화 열람, 표지 확정, 출판 신청은 로컬 Express 서버와 SQLite DB에 저장됩니다.
          </p>
        </div>
        <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-3">
          <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-[16px] font-black text-text">앱 내 음성 인터뷰</h3>
            <input
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
              className="mt-3 w-full rounded-2xl border border-border bg-surface px-3 py-3 text-[14px] font-bold text-text"
            />
            <button
              type="button"
              onClick={async () => {
                await createLocalSchedule(new Date(scheduleAt).toISOString());
                setServerNotice('예약 시간이 되면 시니어 앱으로 Web Push 인터뷰 연락이 전송됩니다.');
              }}
              className="mt-3 w-full rounded-2xl bg-primary px-4 py-3 text-[14px] font-black text-white"
            >
              앱 연락 시간 저장
            </button>
            <button
              type="button"
              onClick={async () => {
                const result = await sendLocalAppCall();
                setServerNotice(`시니어 앱으로 인터뷰 연락을 보냈습니다. 푸시 발송 ${result.pushResult.sent}건`);
              }}
              className="mt-2 w-full rounded-2xl bg-secondary px-4 py-3 text-[14px] font-black text-white"
            >
              지금 앱으로 연락하기
            </button>
            <button
              type="button"
              onClick={async () => {
                const { publicKey } = await fetchLocalVapidPublicKey();
                await registerLocalPushSubscription(publicKey, 'guardian');
                setServerNotice('보호자 브라우저 알림 구독을 등록했습니다.');
              }}
              className="mt-2 w-full rounded-2xl border border-primary/20 bg-primary-pale px-4 py-3 text-[14px] font-black text-primary"
            >
              보호자 알림 등록
            </button>
          </div>

          <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-[16px] font-black text-text">사진 기반 질문</h3>
            <label className="mt-3 flex cursor-pointer items-center justify-center rounded-2xl border border-border bg-surface px-4 py-3 text-[14px] font-black text-text-muted">
              사진 업로드
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (!file) return;
                  const result = await uploadLocalPhoto(file);
                  setServerNotice(`사진을 저장하고 ${result.questions.length}개의 사진 질문을 만들었습니다.`);
                }}
              />
            </label>
            <button
              type="button"
              onClick={async () => {
                await sendLocalNudge();
                setServerNotice('시니어에게 콕 찌르기 알림을 저장/발송했습니다.');
              }}
              className="mt-3 w-full rounded-2xl bg-secondary px-4 py-3 text-[14px] font-black text-white"
            >
              콕 찌르기
            </button>
          </div>

          <div className="rounded-[24px] border border-border bg-surface p-4 shadow-sm">
            <h3 className="text-[16px] font-black text-text">진척도와 출판</h3>
            <p className="mt-2 text-[14px] font-bold text-text-muted">
              {localProgress ? `${localProgress.character} 기록 ${localProgress.totalRecords}개` : '로컬 서버 진척도 대기'}
            </p>
            <div className="mt-3 space-y-2">
              {(localProgress?.progress ?? []).slice(0, 4).map((item) => (
                <div key={item.chapter.title} className="rounded-2xl border border-border bg-surface px-3 py-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12px] font-black text-text">{item.chapter.title}</span>
                    <span className="text-[11px] font-black text-text-subtle">{item.count}/{item.chapter.minAnswerCount}</span>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${Math.min(100, (item.count / item.chapter.minAnswerCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={async () => {
                  const result = await generateLocalCoverDesign();
                  setCoverDesign(result.coverDesign);
                  setCoverAnalysis(result.analysis);
                  setServerNotice(`표지 후보: ${result.coverDesign.palette} / ${result.coverDesign.font}`);
                }}
                className="rounded-2xl border border-primary/20 bg-primary-pale px-3 py-2.5 text-[13px] font-black text-primary"
              >
                표지 생성
              </button>
              <button
                type="button"
                disabled={!coverDesign}
                onClick={async () => {
                  if (!coverDesign) return;
                  await confirmLocalCoverDesign(coverDesign.id);
                  setServerNotice('표지 디자인을 최종 확정했습니다.');
                }}
                className="rounded-2xl border border-primary/20 bg-primary-pale px-3 py-2.5 text-[13px] font-black text-primary disabled:opacity-40 animate-none transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary/10"
              >
                표지 확정
              </button>
            </div>
            {coverDesign && (
              <div className="mt-3 overflow-hidden rounded-[22px] border border-border bg-surface shadow-sm">
                <div className="bg-primary px-4 py-4 text-primary-pale">
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-primary-pale/45">Cover agent preview</p>
                  <h4 className="mt-2 text-[18px] font-black text-primary-pale">AI 표지 커스터마이징</h4>
                  <p className="mt-1 text-[12px] font-semibold text-primary-pale/65">
                    {coverAnalysis?.tone ?? '인터뷰 분위기 분석 결과'}
                  </p>
                </div>
                <div className="p-4">
                  <div className="flex gap-2">
                    {(COVER_PALETTE_PREVIEW[coverDesign.palette] ?? COVER_PALETTE_PREVIEW.classic_ink).map((color) => (
                      <span
                        key={color}
                        className="h-7 w-7 rounded-full border border-border"
                        style={{ backgroundColor: color }}
                        aria-label={`표지 색상 ${color}`}
                      />
                    ))}
                  </div>
                  <div className="mt-3 grid gap-2 text-[12px] font-black text-text-muted">
                    <p>팔레트: {coverDesign.palette}</p>
                    <p>레이아웃: {COVER_TEMPLATE_LABELS[coverDesign.template] ?? coverDesign.template}</p>
                    <p>폰트: {coverDesign.font}</p>
                  </div>
                  {coverAnalysis?.keywords?.length ? (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {coverAnalysis.keywords.slice(0, 6).map((keyword) => (
                        <span key={keyword} className="rounded-full bg-primary-pale px-2.5 py-1 text-[11px] font-black text-primary">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {coverAnalysis?.reason && (
                    <p className="mt-3 text-[12px] font-semibold leading-relaxed text-text-subtle">
                      {coverAnalysis.reason}
                    </p>
                  )}
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={async () => {
                const result = await requestLocalPublication('A5');
                setServerNotice(`출판 신청 완료: ${result.publicationRequest.status}`);
              }}
              className="mt-2 w-full rounded-2xl bg-primary px-4 py-3 text-[14px] font-black text-white"
            >
              출판 신청
            </button>
          </div>
        </div>
        <div className="grid gap-4 border-t border-border/70 p-5 sm:p-7 lg:grid-cols-[1fr_2fr]">
          <div className="rounded-[22px] border border-border/70 bg-surface p-4">
            <p className="text-[13px] font-black text-text">서버 상태</p>
            <p className="mt-2 text-[13px] font-semibold leading-relaxed text-text-muted">
              {serverNotice || '로컬 서버와 연결되면 작업 결과가 여기에 표시됩니다.'}
            </p>
          </div>
          <div className="rounded-[22px] border border-border/70 bg-surface p-4">
            <p className="text-[13px] font-black text-text">자유 발화 기록</p>
            {freeSpeech.length === 0 ? (
              <p className="mt-2 text-[13px] font-semibold text-text-muted">저장된 자유 발화가 아직 없습니다.</p>
            ) : (
              <div className="mt-3 grid gap-2">
                {freeSpeech.map((record) => (
                  <div key={record.id} className="rounded-2xl border border-border bg-surface-alt/80 px-3 py-2">
                    <p className="text-[12px] font-black text-primary">{record.chapter.title}</p>
                    <p className="mt-1 line-clamp-2 text-[13px] font-semibold text-text-muted">{record.transcriptText}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-3">
        {FAMILY_SPACE_STEPS.map((step, index) => (
          <div key={step.label} className="premium-panel-soft rounded-[26px] px-5 py-5 transition-all duration-300 ease-out hover:-translate-y-0.5">
            <div className="flex items-center gap-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl bg-primary-pale text-[13px] font-black text-primary">
                {index + 1}
              </span>
              <h3 className="text-[16px] font-black text-text">{step.label}</h3>
            </div>
            <p className="mt-3 text-[13px] font-semibold leading-relaxed text-text-muted">{step.description}</p>
          </div>
        ))}
      </section>

      <section className="premium-panel overflow-hidden rounded-[30px]">
        <div className="flex flex-col gap-4 border-b border-border/70 bg-surface-alt/68 px-6 py-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-secondary-pale text-secondary ring-1 ring-secondary/10">
              <BellRing className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[19px] font-black text-text">월 구독 재방문 루프</h3>
              <p className="mt-0.5 text-[14px] font-bold leading-relaxed text-secondary">
                저장된 기억을 퀴즈, 가족 질문, 기념일 알림으로 다시 꺼내는 주간 운영 흐름입니다.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-secondary/20 bg-secondary-pale px-3 py-1.5 text-[12px] font-black text-secondary">
            장기 관계 유지
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-3">
          {engagementLoop.map((item) => (
            <article key={item.id} className="flex min-h-[190px] flex-col rounded-[24px] border border-border/70 bg-surface/82 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5">
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full bg-secondary-pale px-3 py-1 text-[11px] font-black text-secondary">
                  {item.cadence}
                </span>
                {item.type === 'calendar' ? (
                  <CalendarDays className="h-4 w-4 text-secondary" aria-hidden="true" />
                ) : (
                  <BellRing className="h-4 w-4 text-secondary" aria-hidden="true" />
                )}
              </div>
              <h4 className="mt-4 text-[18px] font-black leading-snug text-text">{item.title}</h4>
              <p className="mt-2 text-[14px] font-semibold leading-relaxed text-text-muted">{item.description}</p>
              <p className="mt-auto pt-4 text-[13px] font-black text-secondary">{item.actionLabel}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="premium-panel overflow-hidden rounded-[30px]">
        <div className="flex flex-col gap-4 border-b border-border/70 bg-surface-alt/68 px-6 py-6 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary-pale text-primary">
              <Trophy className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <h3 className="text-[19px] font-black text-text">이번 주 가족 퀴즈</h3>
              <p className="mt-0.5 text-[14px] font-medium text-text-muted">
                저장된 기억을 가족이 다시 발견하도록 매주 작은 질문으로 돌려보냅니다.
              </p>
            </div>
          </div>
          <span className="w-fit rounded-full border border-primary/20 bg-primary-pale px-3 py-1.5 text-[12px] font-black text-primary">
            구독형 관계 유지 루프
          </span>
        </div>

        <div className="grid gap-4 p-5 sm:p-7 lg:grid-cols-3">
          {weeklyQuizzes.length === 0 ? (
            <div className="rounded-2xl border border-border bg-surface-alt p-5 lg:col-span-3">
              <p className="text-[15px] font-bold text-text-muted">
                퀴즈를 만들려면 인물, 장소, 시기, 감정 태그가 있는 기억이 더 필요합니다.
              </p>
            </div>
          ) : (
            weeklyQuizzes.map((quiz) => (
              <article key={quiz.id} className="flex min-h-[280px] flex-col rounded-[24px] border border-border/70 bg-surface/82 p-5 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[12px] font-black uppercase tracking-wide text-primary">Reverse family quiz</p>
                  <span className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-black text-text-subtle">
                    {quiz.sourceTopic}
                  </span>
                </div>
                <h4 className="mt-4 text-[18px] font-black leading-snug text-text">{quiz.question}</h4>
                <div className="mt-4 space-y-2">
                  {quiz.options.map((option, index) => (
                    <div
                      key={option}
                      className={`rounded-2xl border px-4 py-3 text-[14px] font-bold ${
                        index === quiz.answerIndex
                          ? 'border-secondary/30 bg-secondary-pale text-secondary'
                          : 'border-border bg-surface text-text-muted'
                      }`}
                    >
                      {index + 1}. {option}
                    </div>
                  ))}
                </div>
                <p className="mt-auto pt-4 text-[12px] font-semibold leading-relaxed text-text-subtle">
                  정답을 맞힌 뒤 원본 기억 카드로 이어져 가족 질문이나 추가 인터뷰를 만들 수 있습니다.
                  {quiz.sourceExcerpt ? ` 근거: ${quiz.sourceExcerpt}` : ''}
                </p>
              </article>
            ))
          )}
        </div>
      </section>

      <section className="premium-panel overflow-hidden rounded-[30px]">
        <div className="flex items-center gap-3 border-b border-border/70 bg-surface-alt/68 px-6 py-6 backdrop-blur sm:px-8">
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
                  <p className="mt-1 text-[20px] font-black text-text">{value}</p>
                </div>
              ))}
            </div>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              aria-label="가족 질문 내용"
              placeholder="예: 할머니가 처음 서울에 올라오셨을 때 어떤 마음이셨나요?"
              className="h-24 w-full resize-none rounded-2xl border border-border/80 bg-surface-alt/75 p-4 text-[16px] leading-relaxed text-text shadow-sm outline-none transition-all duration-300 ease-out placeholder:text-text-subtle focus:border-secondary/40 focus:bg-surface focus:ring-4 focus:ring-secondary/10"
            />
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={questionPriority}
                onChange={(e) => setQuestionPriority(e.target.value as PriorityTag)}
                aria-label="질문 우선순위"
                className="rounded-xl border border-border/80 bg-surface-alt/75 px-4 py-2.5 text-[14px] font-semibold text-text-muted shadow-sm outline-none transition-all duration-300 ease-out focus:border-secondary/40 focus:ring-4 focus:ring-secondary/10"
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
                className="ml-auto rounded-2xl bg-secondary px-5 py-2.5 text-[14px] font-black text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-secondary/90 disabled:opacity-40"
              >
                질문 등록
              </button>
            </div>
          </div>

          <div className="rounded-[24px] border border-border/70 bg-surface-alt/76 p-4 shadow-sm">
            <p className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-3">질문 대기열</p>
            {familyQuestions.questions.length === 0 ? (
              <p className="text-[14px] text-text-subtle">아직 등록된 질문이 없습니다.</p>
            ) : (
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {familyQuestions.questions.slice(0, 6).map((question) => (
                  <div key={question.id} className="rounded-xl border border-border/70 bg-surface/82 px-3 py-2 shadow-sm">
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
          <div key={memory.id} className="premium-panel overflow-hidden rounded-[30px]">
            <div className="flex flex-col justify-between gap-4 border-b border-border/70 bg-surface-alt/68 px-6 py-6 backdrop-blur sm:flex-row sm:items-center sm:px-8">
              <div>
                <h3 className="text-[22px] font-black text-text mb-1">{memory.topic}</h3>
                <span className="text-[14px] font-medium text-text-muted">
                  {format(new Date(memory.date), 'yyyy년 M월 d일', { locale: ko })}
                </span>
              </div>
              
              <div className="flex items-center gap-1 rounded-2xl border border-border/70 bg-surface/78 p-1.5 shadow-sm">
                {(['private', 'family', 'public'] as PrivacyLevel[]).map((level) => (
                  <button
                    key={level}
                    onClick={() => updateMemoryPrivacy(memory.id, level)}
                    aria-label={`${memory.topic} 공개 범위 ${level === 'private' ? '나만 보기' : level === 'family' ? '가족 공개' : '전체 공개'}로 변경`}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-xl text-[15px] font-semibold transition-all duration-300 ease-out",
                      memory.privacy === level
                        ? "bg-primary text-white shadow-sm"
                        : "text-text-muted hover:-translate-y-0.5 hover:bg-border/40"
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

            <div className="grid grid-cols-1 divide-y divide-border/70 lg:grid-cols-3 lg:divide-x lg:divide-y-0">
              {/* Column 1: Original */}
              <div className="bg-surface-alt/72 p-7">
                <h4 className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-3">원본 녹취록</h4>
                <p className="text-[16px] text-text-muted whitespace-pre-wrap leading-relaxed italic">
                  "{memory.originalTranscript}"
                </p>
              </div>

              {/* Column 2: Cleaned */}
              <div className="bg-surface/76 p-7">
                <h4 className="text-[12px] font-bold text-text-subtle uppercase tracking-wide mb-3">AI 교정본</h4>
                <p className="text-[16px] text-text whitespace-pre-wrap leading-relaxed font-medium">
                  {memory.cleanedTranscript}
                </p>
              </div>

              {/* Column 3: Publish Version */}
              <div className="bg-primary-pale/40 p-7">
                <div className="flex justify-between items-center mb-3">
                  <h4 className="text-[12px] font-bold text-primary/70 uppercase tracking-wide">최종 발행본</h4>
                  {editingId !== memory.id ? (
                    <button
                      onClick={() => handleEditStart(memory.id, memory.publishVersion)}
                      className="text-[14px] font-semibold text-primary underline underline-offset-4 transition-colors hover:text-primary-light"
                    >
                      수정하기
                    </button>
                  ) : (
                    <button
                      onClick={() => handleEditSave(memory.id)}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-[14px] font-bold text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary-light"
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
                    className="h-44 w-full resize-none rounded-2xl border border-primary/25 bg-surface-alt/82 p-4 text-[16px] font-medium leading-relaxed text-text shadow-sm outline-none transition-all duration-300 ease-out focus:border-primary/40 focus:ring-4 focus:ring-primary/10"
                  />
                ) : (
                  <p className="text-[16px] text-text whitespace-pre-wrap leading-relaxed font-semibold">
                    {memory.publishVersion}
                  </p>
                )}
              </div>
            </div>

            {/* Consent Controls */}
            <div className="space-y-4 border-t border-border/70 px-6 py-6 sm:px-8">
              <div className="rounded-[24px] border border-border/70 bg-surface-alt/76 p-4 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[13px] font-black text-text">안심 제어</p>
                    <p className="mt-1 text-[13px] font-semibold leading-relaxed text-text-muted">
                      이 기억이 부담스럽다면 가족 공개, 자서전, 챗봇, 사후 공개에서 바로 제외하거나 완전히 삭제할 수 있습니다.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleRevokeUsage(memory.id)}
                      className="rounded-2xl border border-primary/20 bg-primary-pale px-4 py-2.5 text-[13px] font-black text-primary shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:bg-primary/10"
                    >
                      모든 활용 중지
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteMemory(memory.id)}
                      className={`rounded-2xl px-4 py-2.5 text-[13px] font-black text-white shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 ${
                        deleteConfirmId === memory.id
                          ? 'bg-error'
                          : 'bg-text-muted hover:bg-error'
                      }`}
                    >
                      {deleteConfirmId === memory.id ? '정말 삭제할까요?' : '기억 삭제'}
                    </button>
                  </div>
                </div>
              </div>
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
